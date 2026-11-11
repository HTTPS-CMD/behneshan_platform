"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import Link from "next/link";
import { refreshSession } from "@/lib/auth";
import BrandAssetsManager from "@/components/ui/BrandAssetsManager";
import { toast } from "@/components/ui/toaster";

export default function CreateBusinessPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // استیت‌های ذخیره فایل‌های کراپ‌شده
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // دریافت لیست شهرها و دسته‌بندی‌ها به محض لود شدن صفحه
  useEffect(() => {
    const fetchTaxonomies = async () => {
      try {
        const [catsRes, locsRes] = await Promise.all([
          api.get("/taxonomy/categories/"),
          api.get("/taxonomy/locations/"),
        ]);
        setCategories(catsRes.data);
        setLocations(locsRes.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات پایه", error);
      }
    };
    fetchTaxonomies();
  }, []);


  // ارسال فرم به بک‌اند
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("slug", data.slug);
      formData.append("category", data.category);
      formData.append("location", data.location);
      formData.append("description", data.description);

      // استفاده از فایل‌های جدید کراپ‌شده
      if (logoFile) {
        formData.append("logo", logoFile);
      }
      if (bannerFile) {
        formData.append("banner", bannerFile);
      }

      // پاسخ بک‌اند را در یک متغیر ذخیره می‌کنیم
      const response = await api.post(
        "/directory/businesses/create/",
        formData,
      );

      // --- تغییر کلیدی: بررسی ارتقای نقش کاربر ---
      if (response.data.new_tokens) {
        // نقش عوض شده؛ نشست از مسیر امن تمدید می‌شود تا توکن و کوکی نقش جدید را داشته باشند (H6)
        await refreshSession();
      }

      toast.success("کسب‌وکار با موفقیت ثبت شد!");
      // هدایت مستقیم کاربر به پنل مخصوص صاحبان کسب‌وکار
      router.push("/dashboard/owner");
    } catch (error) {
      console.error(error);
      toast.error("خطایی در ثبت کسب‌وکار رخ داد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            ثبت کسب‌وکار جدید
          </h1>
          <Link
            href="/dashboard/owner"
            className="text-brand-600 hover:underline"
          >
            بازگشت به داشبورد
          </Link>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6"
        >
          {/* نام کسب‌وکار */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              نام کسب‌وکار
            </label>
            <input
              {...register("name", { required: true })}
              placeholder="مثال: استودیو وبانو"
              className="w-full p-3 border rounded-lg focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* نامک (Slug) */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              لینک اختصاصی (انگلیسی)
            </label>
            <input
              {...register("slug", { required: true })}
              placeholder="مثال: webano-studio"
              className="w-full p-3 border rounded-lg focus:outline-none focus:border-brand-500 text-left"
              dir="ltr"
            />
          </div>

          {/* دسته‌بندی و شهر */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                دسته‌بندی
              </label>
              <select
                {...register("category", { required: true })}
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-brand-500 bg-white"
              >
                <option value="">انتخاب کنید...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                شهر
              </label>
              <select
                {...register("location", { required: true })}
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-brand-500 bg-white"
              >
                <option value="">انتخاب کنید...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* توضیحات */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              توضیحات
            </label>
            <textarea
              {...register("description", { required: true })}
              placeholder="خدمات و ویژگی‌های کسب‌وکار خود را بنویسید..."
              rows={4}
              className="w-full p-3 border rounded-lg focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* بخش آپلود حرفه‌ای عکس‌ها */}
          <div className="grid grid-cols-1 gap-8 border-t border-gray-100 pt-8 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-gray-700 font-semibold mb-2">
                لوگوی برند (نسبت ۱:۱)
              </label>
              {logoFile ? (
                <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 font-medium">
                    لوگو با موفقیت تنظیم شد.
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    حذف و تغییر
                  </button>
                </div>
              ) : (
                <BrandAssetsManager
                  title="آپلود و تنظیم کادر لوگو"
                  aspectRatio={1}
                  onSave={(file) => setLogoFile(file)}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-gray-700 font-semibold mb-2">
                بنر کاور (نسبت ۱۶:۹)
              </label>
              {bannerFile ? (
                <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 font-medium">
                    بنر تبلیغاتی با موفقیت تنظیم شد.
                  </span>
                  <button
                    type="button"
                    onClick={() => setBannerFile(null)}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    حذف و تغییر
                  </button>
                </div>
              ) : (
                <BrandAssetsManager
                  title="آپلود و تنظیم کادر بنر"
                  aspectRatio={16 / 9}
                  onSave={(file) => setBannerFile(file)}
                />
              )}
            </div>
          </div>

          {/* دکمه ثبت */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 bg-brand-600 text-white p-4 rounded-lg font-bold hover:bg-brand-700 transition disabled:bg-gray-400 text-lg shadow-md"
          >
            {isSubmitting ? "در حال ثبت..." : "ثبت نهایی اطلاعات"}
          </button>
        </form>
      </div>
    </div>
  );
}
