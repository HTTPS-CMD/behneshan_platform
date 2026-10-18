"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import {
  Save, Image as ImageIcon, MapPin,
  Phone, AtSign, Loader2, UploadCloud, Link as LinkIcon, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function EditBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const { slug } = use(params);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // استیت جدید برای ذخیره ارورهای بک‌اند
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: number, name: string }[]>([]);

  // استیت‌های فرم
  const [formData, setFormData] = useState({
    name: "",
    new_slug: "",
    category: "",
    location: "",
    description: "",
    address: "",
    public_phone: "",
    instagram_id: "",
    latitude: "",
    longitude: "",
    website: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // دیکشنری برای ترجمه نام فیلدهای بک‌اند به فارسی برای نمایش در ارورها
  const fieldNamesFa: Record<string, string> = {
    name: "نام کسب‌وکار",
    new_slug: "لینک اختصاصی",
    category: "دسته‌بندی",
    location: "شهر/منطقه",
    description: "توضیحات",
    address: "آدرس",
    public_phone: "تلفن تماس",
    instagram_id: "آیدی اینستاگرام",
    latitude: "عرض جغرافیایی",
    longitude: "طول جغرافیایی",
    website: "وب‌سایت",
    logo: "لوگو",
    banner: "بنر کاور",
    non_field_errors: "خطای کلی",
    detail: "خطا"
  };

  // دریافت اطلاعات اولیه و اطلاعات کسب‌وکار
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = Cookies.get("access_token");
        const [catsRes, locsRes, bizRes] = await Promise.all([
          api.get("/taxonomy/categories/").catch(() => ({ data: [] })),
          api.get("/taxonomy/locations/").catch(() => ({ data: [] })),
          api.get(`/directory/businesses/${slug}/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setCategories(catsRes.data || []);
        setLocations(locsRes.data || []);

        const businessData = bizRes.data;
        setFormData({
          name: businessData.name || "",
          new_slug: businessData.slug || "",
          category: businessData.category?.id || businessData.category || "",
          location: businessData.location?.id || businessData.location || "",
          description: businessData.description || "",
          address: businessData.address || "",
          public_phone: businessData.public_phone || "",
          instagram_id: businessData.instagram_id || "",
          latitude: businessData.latitude || "",
          longitude: businessData.longitude || "",
          website: businessData.website || "",
        });

        if (businessData.logo) setLogoPreview(businessData.logo);
        if (businessData.banner) setBannerPreview(businessData.banner);

      } catch (error) {
        console.error("خطا در دریافت اطلاعات", error);
        alert("مشکلی در دریافت اطلاعات کسب‌وکار به وجود آمد.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchInitialData();
  }, [slug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // پاک کردن ارور فیلد هنگام تایپ کردن کاربر
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: [] });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      if (type === "logo") {
        setLogoFile(file);
        setLogoPreview(previewUrl);
        if (errors.logo) setErrors({ ...errors, logo: [] });
      } else {
        setBannerFile(file);
        setBannerPreview(previewUrl);
        if (errors.banner) setErrors({ ...errors, banner: [] });
      }
    }
  };

  // ارسال اطلاعات ویرایش شده به سرور
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({}); // پاک کردن ارورهای قبلی

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      // حالا حتی مقادیر خالی هم برای پاک شدن از دیتابیس ارسال می‌شوند
      if (value !== null && value !== undefined) {
        submitData.append(key, value);
      }
    });

    if (logoFile) submitData.append("logo", logoFile);
    if (bannerFile) submitData.append("banner", bannerFile);

    try {
      const token = Cookies.get("access_token");
      await api.patch(
        `/directory/businesses/${slug}/update/`,
        submitData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      alert("ویرایش با موفقیت انجام شد!");
      router.push("/dashboard/owner");
    } catch (error: any) {
      console.error(error);
      // مدیریت نمایش خطاها در UI
      if (error.response && error.response.data) {
        setErrors(error.response.data);
      } else {
        setErrors({ general: ["خطایی در ارتباط با سرور رخ داد. لطفا مجددا تلاش کنید."] });
      }
      // اسکرول به بالای صفحه برای دیدن ارورها
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        در حال بارگذاری اطلاعات...
      </div>
    );
  }

  // بررسی اینکه آیا اروری برای نمایش وجود دارد یا خیر
  const hasErrors = Object.values(errors).some((errArray) => errArray && errArray.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">

        <header className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">ویرایش اطلاعات کسب‌وکار</h1>
            <p className="text-sm text-gray-500 mt-2">اطلاعات و ویترین عمومی شعبه خود را مدیریت کنید.</p>
          </div>
          <Link href="/dashboard/owner" className="text-blue-600 hover:underline text-sm font-bold">
            بازگشت به داشبورد
          </Link>
        </header>

        {/* باکس نمایش ارورها */}
        {hasErrors && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-200 rounded-xl">
            <div className="flex items-center gap-2 text-rose-700 font-black mb-3">
              <AlertCircle className="w-5 h-5" />
              <span>لطفاً خطاهای زیر را برطرف کنید:</span>
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-rose-600 font-bold">
              {Object.entries(errors).map(([field, errArray]) => {
                if (!errArray || errArray.length === 0) return null;
                const fieldName = fieldNamesFa[field] || field;
                return (
                  <li key={field}>
                    <span className="text-rose-800 ml-1">{fieldName}:</span>
                    {errArray.join(" و ")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* اطلاعات پایه */}
          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold text-gray-800 mb-2 block">نام کسب‌وکار</label>
              <Input name="name" value={formData.name} onChange={handleChange} className={`h-12 bg-gray-50/50 rounded-xl ${errors.name ? 'border-rose-500 bg-rose-50/50' : ''}`} required />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800 mb-2 block">لینک اختصاصی (انگلیسی)</label>
              <div className="relative">
                <Input name="new_slug" value={formData.new_slug} onChange={handleChange} dir="ltr" className={`h-12 text-left bg-gray-50/50 rounded-xl pl-10 ${errors.new_slug ? 'border-rose-500 bg-rose-50/50' : ''}`} />
                <LinkIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-gray-800 mb-2 block">دسته‌بندی</label>
                <select name="category" value={formData.category} onChange={handleChange} className={`w-full h-12 px-3 border border-input bg-gray-50/50 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none ${errors.category ? 'border-rose-500 bg-rose-50/50' : ''}`}>
                  <option value="">انتخاب کنید...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-800 mb-2 block">شهر / منطقه</label>
                <select name="location" value={formData.location} onChange={handleChange} className={`w-full h-12 px-3 border border-input bg-gray-50/50 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none ${errors.location ? 'border-rose-500 bg-rose-50/50' : ''}`}>
                  <option value="">انتخاب کنید...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800 mb-2 block">توضیحات تکمیلی</label>
              <Textarea name="description" value={formData.description} onChange={handleChange} className={`min-h-[120px] bg-gray-50/50 rounded-xl resize-y p-4 ${errors.description ? 'border-rose-500 bg-rose-50/50' : ''}`} />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* راه‌های ارتباطی و مسیریابی */}
          <div className="space-y-5">
            <h3 className="text-lg font-black text-gray-800 mb-4">راه‌های ارتباطی و موقعیت</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Phone className="w-4 h-4 text-blue-600" /> تلفن تماس</label>
                <Input name="public_phone" value={formData.public_phone} onChange={handleChange} dir="ltr" className={`h-12 text-left bg-gray-50/50 rounded-xl ${errors.public_phone ? 'border-rose-500 bg-rose-50/50' : ''}`} />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><AtSign className="w-4 h-4 text-rose-500" /> آیدی اینستاگرام</label>
                <Input name="instagram_id" value={formData.instagram_id} onChange={handleChange} dir="ltr" className={`h-12 text-left bg-gray-50/50 rounded-xl ${errors.instagram_id ? 'border-rose-500 bg-rose-50/50' : ''}`} />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> آدرس دقیق فیزیکی</label>
              <Textarea name="address" value={formData.address} onChange={handleChange} className={`h-20 bg-gray-50/50 rounded-xl ${errors.address ? 'border-rose-500 bg-rose-50/50' : ''}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div>
                <label className="text-xs font-bold text-blue-800 mb-1 block">طول جغرافیایی (Longitude)</label>
                <Input name="longitude" value={formData.longitude} onChange={handleChange} dir="ltr" className={`h-10 text-left bg-white ${errors.longitude ? 'border-rose-500' : ''}`} />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-800 mb-1 block">عرض جغرافیایی (Latitude)</label>
                <Input name="latitude" value={formData.latitude} onChange={handleChange} dir="ltr" className={`h-10 text-left bg-white ${errors.latitude ? 'border-rose-500' : ''}`} />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* تصاویر */}
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gray-800 mb-3 block">لوگوی برند (نسبت ۱:۱)</label>
              <div onClick={() => logoInputRef.current?.click()} className={`border-2 border-dashed ${errors.logo ? 'border-rose-500 bg-rose-50' : 'border-gray-300 hover:border-blue-500 bg-gray-50/50'} rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden h-48`}>
                <input type="file" ref={logoInputRef} onChange={(e) => handleFileChange(e, "logo")} accept="image/*" className="hidden" />
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="absolute inset-0 w-full h-full object-contain bg-white" />
                ) : (
                  <>
                    <UploadCloud className={`w-10 h-10 mb-3 ${errors.logo ? 'text-rose-400' : 'text-gray-400'}`} />
                    <span className={`text-sm font-bold ${errors.logo ? 'text-rose-600' : 'text-gray-600'}`}>برای آپلود کلیک کنید</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-800 mb-3 block">بنر کاور (نسبت ۱۶:۹)</label>
              <div onClick={() => bannerInputRef.current?.click()} className={`border-2 border-dashed ${errors.banner ? 'border-rose-500 bg-rose-50' : 'border-gray-300 hover:border-blue-500 bg-gray-50/50'} rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden h-64`}>
                <input type="file" ref={bannerInputRef} onChange={(e) => handleFileChange(e, "banner")} accept="image/*" className="hidden" />
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className={`w-10 h-10 mb-3 ${errors.banner ? 'text-rose-400' : 'text-gray-400'}`} />
                    <span className={`text-sm font-bold ${errors.banner ? 'text-rose-600' : 'text-gray-600'}`}>برای آپلود کلیک کنید</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Button type="submit" disabled={isLoading} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-lg">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ذخیره تغییرات نهایی"}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}