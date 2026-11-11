"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, AtSign, Globe, Star, Share2, ArrowRight, Ticket, CheckCircle2, X, Crown } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import Logo from "@/components/brand/Logo";

// --- تعریف اینترفیس‌ها ---
interface Review {
  id: number;
  user_phone: string;
  rating: number;
  comment: string;
  created_at: string;
  owner_reply?: string | null;
  reply_date?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  merchant_level?: { level: string; label: string; is_top: boolean } | null;
  description: string;
  average_rating: number;
  review_count: number;
  category: Category;
  location: Location;
  logo?: string | null;
  banner?: string | null;
  // فیلدهای اضافه شده برای طراحی جدید و O2O
  public_phone?: string;
  instagram_id?: string;
  website?: string;
  address?: string;
  // باید با خروجی get_active_campaign در بک‌اند یکی باشد
  active_campaign?: {
    id: number;
    title: string;
    description?: string;
    discount_percent: number;
    code: string;
  };
}
// -------------------------

export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  // استیت‌های مربوط به اطلاعات کسب‌وکار و نظرات
  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // استیت‌های مربوط به مودال تخفیف
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { isAuthenticated } = useAuthStore();
  const { register, handleSubmit, reset } = useForm();

  // دریافت لیست نظرات
  const fetchReviews = async () => {
    try {
      const res = await api.get(`/directory/businesses/${slug}/reviews/`);
      setReviews(res.data);
    } catch (error) {
      console.error("خطا در دریافت نظرات", error);
    }
  };

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const response = await api.get(`/directory/businesses/${slug}/`);

        // کدهای مربوط به businessData تستی (mock) کاملاً پاک شد
        // و دیتای واقعی مستقیم در استیت قرار می‌گیرد
        setBusiness(response.data);

        await fetchReviews();
      } catch (error: any) {
        if (error?.response?.status === 404) setMissing(true);
        else console.error("خطا در دریافت اطلاعات", error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchBusinessData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ارسال نظر جدید
  const onSubmitReview = async (data: any) => {
    setIsSubmitting(true);
    try {
      await api.post(
        `/directory/businesses/${slug}/reviews/`,
        { ...data, rating: parseInt(data.rating) },
      );

      toast.success("نظر شما با موفقیت ثبت شد.");
      reset();
      fetchReviews();
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error("شما قبلاً برای این کسب‌وکار نظر ثبت کرده‌اید یا اطلاعات نامعتبر است.");
      } else {
        toast.error("خطایی رخ داد. لطفا دوباره تلاش کنید.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // شبیه‌سازی تولید کد تخفیف
  const handleGenerateDiscount = async () => {
    if (!isAuthenticated) {
      toast.info("برای دریافت کد تخفیف ابتدا باید وارد سایت شوید.");
      return;
    }

    setIsGenerating(true);
    try {
        const res = await api.post("/directory/client/campaigns/claim/", {
            campaign_id: business?.active_campaign?.id
        });
        
        setDiscountCode(res.data.code);
    } catch (error: any) {
        toast.error(error.response?.data?.error || "خطا در دریافت کد. ممکن است ظرفیت پر شده باشد.");
        setIsModalOpen(false);
    } finally {
        setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="font-bold">در حال بارگذاری اطلاعات...</p>
        </div>
      </div>
    );
  }

  // کسب‌وکاری با این آدرس وجود ندارد ← صفحه‌ی اختصاصی ۴۰۴
  if (missing) notFound();

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-slate-500">
        <div className="text-center">
          <h2 className="text-2xl font-black text-brand-800 mb-2">کسب‌وکار یافت نشد!</h2>
          <Link href="/" className="text-brand-600 hover:underline font-bold">بازگشت به صفحه اصلی</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-20 font-sans selection:bg-brand-500 selection:text-white" dir="rtl">

      {/* نوار ناوبری */}
      <nav className="bg-cream/80 backdrop-blur-xl border-b border-cream-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo variant="mark" size={40} />
            <Link href="/" className="flex items-center gap-2 text-brand-600 hover:text-saffron-700 transition font-bold text-sm">
              <ArrowRight className="w-4 h-4" /> بازگشت به لیست
            </Link>
          </div>
          <button className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg text-sm font-bold">
            <Share2 className="w-4 h-4" /> اشتراک‌گذاری
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-8 mt-6">

        {/* سکشن بنر و پروفایل اصلی */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-cream-200 overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-full h-48 md:h-72 bg-slate-200 relative">
            {business.banner ? (
              <img src={business.banner} alt={`بنر ${business.name}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-100 to-teal-50"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/60 to-transparent"></div>
          </div>

          <div className="px-6 md:px-10 pb-8 relative">
            {/* رفع مشکل: حاشیه منفی از اینجا حذف شد */}
            <div className="flex flex-col md:flex-row gap-6 relative z-10 mb-6">

              {/* لوگو: حاشیه منفی (-mt-20) فقط به خود لوگو داده شد تا به تنهایی روی بنر برود */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white p-2 shadow-xl border border-slate-100 shrink-0 -mt-16 md:-mt-20 mx-auto md:mx-0 z-20">
                {business.logo ? (
                  <img src={business.logo} alt="لوگو" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 flex items-center justify-center text-4xl font-black text-brand-600">
                    {business.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* اطلاعات متن: با pt-4 کمی هول داده شد پایین تا با لوگو هم‌تراز شود */}
              <div className="flex-1 pt-2 md:pt-4 text-center md:text-right flex flex-col justify-center">
                <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black text-brand-900 mb-3 tracking-tight">
                      {business.name}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <span className="bg-brand-100 text-brand-800 text-sm font-bold px-3 py-1.5 rounded-lg">
                        {business.category?.name}
                      </span>
                      <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2 py-1.5 rounded-lg text-sm border border-amber-100">
                        <Star className="w-4 h-4 fill-amber-500" /> {business.average_rating} از {business.review_count} رأی
                      </div>
                      {business.merchant_level?.is_top && (
                        <span className="flex items-center gap-1 rounded-lg bg-saffron-500 px-2.5 py-1.5 text-sm font-black text-brand-950"
                          title={`سطح ${business.merchant_level.label} در باشگاه پذیرندگان چهارسوق`}>
                          <Crown className="h-4 w-4" /> دکان برتر
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* ستون اصلی (تخفیف، توضیحات و نظرات) */}
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">

            {/* باکس پیشنهاد ویژه (O2O) */}
            {business.active_campaign && (
              <div className="bg-gradient-to-br from-saffron-500 to-brand-700 rounded-[2rem] p-1 shadow-lg shadow-saffron-500/20">
                <div className="bg-white/95 backdrop-blur-sm rounded-[1.8rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-right">
                    <div className="inline-flex items-center gap-2 bg-saffron-100 text-saffron-700 font-black text-xs px-3 py-1.5 rounded-full mb-3 animate-pulse">
                      <Ticket className="w-4 h-4" /> پیشنهاد فعال
                    </div>
                    <h3 className="text-2xl font-black text-brand-900 mb-2">{business.active_campaign.title}</h3>
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                      {business.active_campaign.description}
                    </p>
                  </div>

                  <div className="w-full md:w-auto shrink-0">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="w-full md:w-auto bg-saffron-500 hover:bg-saffron-600 text-brand-950 font-black text-lg px-8 py-4 rounded-2xl shadow-xl shadow-saffron-500/30 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                    >
                      <Ticket className="w-6 h-6" /> دریافت کد تخفیف
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* توضیحات کسب‌وکار */}
            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-brand-800 mb-4">درباره {business.name}</h3>
              <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap text-justify">
                {business.description || "توضیحاتی برای این کسب‌وکار ثبت نشده است."}
              </p>
            </div>

            {/* بخش نظرات (با استایل جدید و منطق قبلی شما) */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 w-full">
              <h2 className="text-2xl font-black mb-6 text-brand-900">نظرات کاربران</h2>

              {isAuthenticated ? (
                <form onSubmit={handleSubmit(onSubmitReview)} className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <h3 className="font-bold mb-6 text-brand-800">ثبت نظر جدید</h3>

                  <div className="mb-5">
                    <label className="block text-sm font-bold mb-2 text-slate-700">امتیاز (۱ تا ۵)</label>
                    <select
                      {...register("rating", { required: true })}
                      className="p-3 border border-slate-300 rounded-xl bg-white w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    >
                      <option value="5">۵ - عالی</option>
                      <option value="4">۴ - خوب</option>
                      <option value="3">۳ - متوسط</option>
                      <option value="2">۲ - ضعیف</option>
                      <option value="1">۱ - خیلی بد</option>
                    </select>
                  </div>

                  <div className="mb-5">
                    <label className="block text-sm font-bold mb-2 text-slate-700">متن نظر</label>
                    <textarea
                      {...register("comment", { required: true })}
                      rows={4}
                      className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                      placeholder="نظر خود را درباره این کسب‌وکار بنویسید..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 transition disabled:bg-slate-400 w-full md:w-auto shadow-md shadow-brand-600/20"
                  >
                    {isSubmitting ? "در حال ارسال..." : "ارسال نظر"}
                  </button>
                </form>
              ) : (
                <div className="mb-10 p-5 bg-amber-50 text-amber-800 rounded-2xl text-sm border border-amber-200 flex items-center gap-2 font-medium">
                  برای ثبت نظر باید <Link href="/login" className="font-black underline hover:text-amber-900 transition">وارد حساب کاربری</Link> خود شوید.
                </div>
              )}

              {/* لیست نظرات */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-slate-500 text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium">
                    هنوز نظری ثبت نشده است.
                  </p>
                ) : (
                  reviews.map((review: Review) => (
                    <div key={review.id} className="p-6 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-slate-200 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-brand-800 text-left" dir="ltr">
                          {review.user_phone.slice(0, 7) + "****"}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 border border-amber-100/50">
                          <Star className="w-4 h-4 fill-amber-500" /> {review.rating}
                        </span>
                      </div>

                      <p className="text-slate-700 leading-relaxed mb-4 font-medium">
                        {review.comment}
                      </p>

                      {review.owner_reply && (
                        <div className="mt-4 bg-brand-50/50 p-5 rounded-2xl border-r-4 border-brand-500 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-black text-brand-800 text-sm">پاسخ مدیر کسب‌وکار:</span>
                          </div>
                          <p className="text-slate-700 text-sm leading-relaxed font-medium">
                            {review.owner_reply}
                          </p>
                        </div>
                      )}

                      <span className="text-xs text-slate-400 mt-5 block font-medium border-t border-slate-50 pt-4">
                        {new Date(review.created_at).toLocaleDateString("fa-IR")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ستون کناری (اطلاعات تماس و مسیریابی) */}
          <aside className="w-full lg:w-[320px] shrink-0 space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 sticky top-24">
              <h3 className="text-lg font-black text-brand-800 mb-6">اطلاعات تماس</h3>

              <ul className="space-y-6">
                {business.public_phone && (
                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div className="pt-1">
                      <span className="block text-[11px] font-black text-slate-400 mb-1 tracking-wider uppercase">شماره تماس</span>
                      <a href={`tel:${business.public_phone}`} className="text-brand-800 font-bold hover:text-brand-600 transition block text-[15px]" dir="ltr">
                        {business.public_phone}
                      </a>
                    </div>
                  </li>
                )}

                {business.instagram_id && (
                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-saffron-50 text-saffron-500 flex items-center justify-center shrink-0 shadow-sm text-[11px]">
                      <AtSign className="w-5 h-5" />
                    </div>
                    <div className="pt-1">
                      <span className="block text-[11px] font-black text-slate-400 mb-1 tracking-wider uppercase">اینستاگرام</span>
                      <a href={`https://instagram.com/${business.instagram_id.replace('@', '')}`} target="_blank" className="text-brand-800 font-bold hover:text-rose-500 transition block text-[15px]" dir="ltr">
                        {business.instagram_id}
                      </a>
                    </div>
                  </li>
                )}

                {business.website && (
                  <li className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="pt-1">
                      <span className="block text-[11px] font-black text-slate-400 mb-1 tracking-wider uppercase">وب‌سایت</span>
                      <a href={business.website} target="_blank" className="text-brand-800 font-bold hover:text-brand-900 transition line-clamp-1 text-[15px]" dir="ltr">
                        {business.website}
                      </a>
                    </div>
                  </li>
                )}

                <li className="flex items-start gap-4 pt-6 border-t border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="pt-1">
                    <span className="block text-[11px] font-black text-slate-400 mb-1 tracking-wider uppercase">{business.location?.name || "آدرس"}</span>
                    <span className="text-brand-800 font-bold text-sm leading-relaxed block">
                      {business.address || "آدرسی ثبت نشده است."}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* مودال دریافت کد تخفیف */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm" onClick={() => !isGenerating && setIsModalOpen(false)}></div>

          <div className="relative bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl border border-slate-100 z-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>

            {discountCode ? (
              <>
                <div className="w-20 h-20 bg-brand-100 text-brand-500 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-brand-900 mb-2">کد شما صادر شد!</h3>
                <p className="text-slate-500 text-sm font-medium mb-6">این کد را هنگام مراجعه به فروشنده نشان دهید.</p>

                <div className="w-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 mb-6">
                  <span className="block text-3xl font-black text-brand-800 tracking-[0.2em]" dir="ltr">
                    {discountCode}
                  </span>
                </div>

                <button onClick={() => setIsModalOpen(false)} className="w-full bg-brand-900 text-white font-bold py-4 rounded-xl hover:bg-brand-800 transition">
                  متوجه شدم
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-saffron-100 text-saffron-500 rounded-full flex items-center justify-center mb-6">
                  <Ticket className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-brand-900 mb-2">دریافت کد تخفیف</h3>
                <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                  با دریافت این کد، می‌توانید از پیشنهاد <strong>{business.active_campaign?.title}</strong> در مراجعه حضوری استفاده کنید.
                </p>

                <button
                  onClick={handleGenerateDiscount}
                  disabled={isGenerating}
                  className="w-full bg-saffron-500 text-brand-950 font-black py-4 rounded-xl hover:bg-saffron-600 transition flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-saffron-500/30"
                >
                  {isGenerating ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "تایید و دریافت کد یکتا"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}