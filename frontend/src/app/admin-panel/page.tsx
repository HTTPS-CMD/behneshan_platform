"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import AdminMenus from "./menus/page";
import AdminSettings from "./settings/page";
import AdminContentSettings from "./content/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SuperAdminPanel() {
  const { isAuthenticated, role, logout } = useAuthStore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState("businesses");

  const [allBusinesses, setAllBusinesses] = useState<any[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [categorySlug, setCategorySlug] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");

  const [locations, setLocations] = useState<any[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const [banners, setBanners] = useState<any[]>([]);
  const [isLoadingCms, setIsLoadingCms] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // --- استیت‌های مربوط به VIP ---
  const [vipPlans, setVipPlans] = useState<any[]>([]);
  const [isLoadingVipPlans, setIsLoadingVipPlans] = useState(false);

  // --- استیت‌های مربوط به تراکنش‌ها ---
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const [hasDemoData, setHasDemoData] = useState(false);
  const [isTogglingDemo, setIsTogglingDemo] = useState(false);


  const checkDemoStatus = async () => {
    try {
      const token = Cookies.get("access_token");
      const res = await api.get("/directory/admin/toggle-demo-data/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHasDemoData(res.data.has_demo);
    } catch (error) {
      console.error("خطا در بررسی وضعیت دمو", error);
    }
  };

  const handleToggleDemoData = async () => {
    setIsTogglingDemo(true);
    try {
      const token = Cookies.get("access_token");
      const res = await api.post("/directory/admin/toggle-demo-data/", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHasDemoData(res.data.has_demo);
      alert(res.data.message);
      fetchAllBusinesses();
      fetchAdminCategories();
    } catch (error) {
      alert("خطا در تغییر وضعیت داده‌های نمونه.");
    } finally {
      setIsTogglingDemo(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (role !== "admin" && role !== "superadmin" && role !== "ADMIN") {
        router.push("/");
      }
    }
  }, [isMounted, isAuthenticated, role, router]);

  useEffect(() => {
    if (isMounted && isAuthenticated && (role === "admin" || role === "superadmin" || role === "ADMIN")) {
      if (activeTab === "businesses") {
        fetchAllBusinesses();
        checkDemoStatus();
      } 
      else if (activeTab === "categories") {
        fetchAdminCategories();
        fetchAdminLocations();
      }
      else if (activeTab === "cms") fetchCmsAdminData();
      else if (activeTab === "users") fetchAllUsers();
      else if (activeTab === "vip_plans") fetchAdminVipPlans();
      else if (activeTab === "transactions") fetchAdminTransactions();
    }
  }, [isMounted, isAuthenticated, role, activeTab]);

  const fetchAllBusinesses = async () => {
    setIsLoadingBusinesses(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/directory/admin/businesses/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllBusinesses(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت لیست کسب‌وکارها", error);
    } finally {
      setIsLoadingBusinesses(false);
    }
  };

  const categoryEmojiMap: Record<string, string> = {
    "beauty": "💅", "salon": "✂️", "hair": "💇‍♀️", "barber": "💈",
    "restaurant": "🍽️", "cafe": "☕", "food": "🍔", "coffee": "☕",
    "clinic": "🏥", "doctor": "🩺", "pharmacy": "💊", "dentist": "🦷",
    "store": "🛒", "shop": "🛍️", "clothing": "👗", "tech": "💻",
    "car": "🚗", "auto": "🚘", "repair": "🔧", "mechanic": "⚙️",
    "gym": "🏋️", "sport": "⚽", "fitness": "💪",
    "school": "🏫", "education": "📚", "book": "📖",
    "pet": "🐾", "vet": "🐕", "hotel": "🏨", "travel": "✈️"
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCategorySlug(val);

    // جستجو برای پیدا کردن ایموجی مرتبط
    const lowerText = val.toLowerCase();
    let foundEmoji = "";
    for (const [key, emoji] of Object.entries(categoryEmojiMap)) {
      if (lowerText.includes(key)) {
        foundEmoji = emoji;
        break;
      }
    }
    // اگر کلمه آشنا بود، ایموجی رو به صورت خودکار جایگذاری کن
    if (foundEmoji) {
      setCategoryIcon(foundEmoji);
    }
  };





  const toggleVerification = async (businessId: string, currentStatus: boolean) => {
    try {
      const token = Cookies.get("access_token");
      await api.patch(
        `/directory/admin/businesses/${businessId}/verify/`,
        { is_verified: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllBusinesses((prev) =>
        prev.map((biz) => (biz.id === businessId ? { ...biz, is_verified: !currentStatus } : biz))
      );
    } catch (error) {
      alert("مشکلی در تغییر وضعیت رخ داد.");
    }
  };

  const fetchAdminCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/taxonomy/admin/categories/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت دسته‌بندی‌ها", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchAdminLocations = async () => {
    setIsLoadingLocations(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/taxonomy/admin/locations/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLocations(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت مکان‌ها", error);
    } finally {
      setIsLoadingLocations(false);
    }
  };


  const updateCategoryPrice = async (categoryId: string, newPrice: string) => {
    try {
      const token = Cookies.get("access_token");
      await api.patch(
        `/taxonomy/admin/categories/${categoryId}/`,
        { price: newPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("قیمت با موفقیت بروزرسانی شد.");
      fetchAdminCategories();
    } catch (error) {
      alert("مشکلی در تغییر قیمت رخ داد.");
    }
  };

  const fetchCmsAdminData = async () => {
    setIsLoadingCms(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/cms/admin/banners/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBanners(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت اطلاعات CMS", error);
    } finally {
      setIsLoadingCms(false);
    }
  };

  const handleAddBanner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const token = Cookies.get("access_token");
      await api.post("/cms/admin/banners/", formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      alert("بنر با موفقیت اضافه شد.");
      (e.target as HTMLFormElement).reset();
      fetchCmsAdminData();
    } catch (error) {
      alert("خطا در ثبت بنر.");
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("آیا از حذف این بنر مطمئن هستید؟")) return;
    try {
      const token = Cookies.get("access_token");
      await api.delete(`/cms/admin/banners/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCmsAdminData();
    } catch (error) {
      alert("خطا در حذف بنر");
    }
  };


  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/identity/admin/users/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت لیست کاربران", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // تابع تغییر وضعیت کاربر (مسدود یا فعال کردن)
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`آیا از ${currentStatus ? 'مسدود کردن' : 'فعال‌سازی'} این کاربر مطمئن هستید؟`)) return;

    try {
      const token = Cookies.get("access_token");
      await api.patch(
        `/identity/admin/users/${userId}/`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // آپدیت سریع لیست در فرانت‌اند بدون نیاز به رفرش
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
      );
      alert("وضعیت کاربر با موفقیت تغییر کرد.");
    } catch (error) {
      alert("خطا در تغییر وضعیت کاربر.");
    }
  };

  // تابع حذف کامل یک کسب‌وکار توسط ادمین
  const deleteBusiness = async (businessId: string) => {
    if (!confirm("هشدار: آیا از حذف کامل این کسب‌وکار مطمئن هستید؟ این عملیات غیرقابل بازگشت است!")) return;

    try {
      const token = Cookies.get("access_token");
      await api.delete(`/directory/admin/businesses/${businessId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // حذف از استیت
      setAllBusinesses((prev) => prev.filter((biz) => biz.id !== businessId));
      alert("کسب‌وکار با موفقیت حذف شد.");
    } catch (error) {
      alert("خطا در حذف کسب‌وکار.");
    }
  };


  // توابع دریافت داده
  const fetchAdminVipPlans = async () => {
    setIsLoadingVipPlans(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/directory/admin/subscription-plans/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVipPlans(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت پلن‌های VIP", error);
    } finally {
      setIsLoadingVipPlans(false);
    }
  };

  const fetchAdminTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const token = Cookies.get("access_token");
      const response = await api.get("/directory/admin/transactions/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(response.data.results || response.data);
    } catch (error) {
      console.error("خطا در دریافت لیست تراکنش‌ها", error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // تابع تغییر وضعیت پلن VIP
  const toggleVipPlanStatus = async (planId: number, currentStatus: boolean) => {
    try {
      const token = Cookies.get("access_token");
      await api.patch(
        `/directory/admin/subscription-plans/${planId}/`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVipPlans((prev) =>
        prev.map((plan) => (plan.id === planId ? { ...plan, is_active: !currentStatus } : plan))
      );
      alert("وضعیت پلن با موفقیت تغییر کرد.");
    } catch (error) {
      alert("خطا در تغییر وضعیت پلن.");
    }
  };



  if (!isMounted || !isAuthenticated || (role !== "admin" && role !== "superadmin" && role !== "ADMIN")) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500" dir="rtl">در حال بررسی دسترسی...</div>;
  }

  const roleTranslator: Record<string, string> = {
    ADMIN: "مدیر کل",
    superadmin: "مدیر کل",
    BUSINESS_OWNER: "صاحب کسب‌وکار",
    CLIENT: "مشتری عادی",
  };

  const tabs = [
    { id: "businesses", label: "کسب‌وکارها" },
    { id: "categories", label: "دسته‌بندی‌ها و قیمت‌ها" },
    { id: "cms", label: "مدیریت محتوا " },
    { id: "settings", label: "تنظیمات متون سایت" },
    { id: "page_content", label: "صفحات (درباره ما، قوانین)" }, // این خط اضافه شود
    { id: "menus", label: "مدیریت منوها" },
    { id: "users", label: "کاربران پلتفرم" },
    { id: "vip_plans", label: "پلن‌های VIP" },
    { id: "transactions", label: "تراکنش‌های پلتفرم" },
  ];

  return (
    <div className="space-y-6" dir="rtl">

      {/* منوی تب‌ها */}
      <div className="flex overflow-x-auto gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.id
              ? "bg-slate-900 text-white shadow-md"
              : "bg-transparent text-gray-600 hover:bg-gray-100"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* محتوای تب‌ها */}
      <Card className="shadow-sm border-gray-200 min-h-[500px]">
        {activeTab === "menus" && (
          <CardContent className="p-6">
            <AdminMenus />
          </CardContent>
        )}

        {activeTab === "settings" && (
          <CardContent className="p-6">
            <AdminSettings />
          </CardContent>
        )}

        {activeTab === "page_content" && (
          <CardContent className="p-6">
            <AdminContentSettings />
          </CardContent>
        )}

        {activeTab === "businesses" && (
          <>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50 border-b pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">بررسی اصالت کسب‌وکارها</CardTitle>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                  {allBusinesses.length} مورد
                </span>
              </div>

              {/* دکمه هوشمند افزودن / حذف کسب‌وکارهای نمونه */}
              <Button
                onClick={handleToggleDemoData}
                disabled={isTogglingDemo}
                className={
                  hasDemoData
                    ? "bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm"
                }
              >
                {isTogglingDemo
                  ? "در حال انجام..."
                  : hasDemoData
                  ? "🗑️ حذف کسب‌وکارهای نمونه (دمو)"
                  : "✨ افزودن کسب‌وکارهای نمونه (دمو)"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">شناسه</th>
                      <th className="p-4 font-semibold">نام کسب‌وکار</th>
                      <th className="p-4 font-semibold text-center">وضعیت تایید</th>
                      <th className="p-4 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingBusinesses ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : allBusinesses.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">موردی یافت نشد.</td></tr>
                    ) : (
                      allBusinesses.map((biz) => (
                        <tr key={biz.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 text-gray-500 font-mono text-xs">{biz.id.slice(0, 8)}...</td>
                          <td className="p-4 font-bold text-gray-800">{biz.name}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold ${biz.is_verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {biz.is_verified ? "تایید شده" : "در انتظار"}
                            </span>
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant={biz.is_verified ? "secondary" : "default"}
                              className={!biz.is_verified ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                              onClick={() => toggleVerification(biz.id, biz.is_verified)}
                            >
                              {biz.is_verified ? "لغو تایید" : "تایید کردن"}
                            </Button>
                            <Link href={`/business/${biz.slug}`} target="_blank">
                              <Button size="sm" variant="outline">مشاهده</Button>
                            </Link>
                            {/* دکمه جدید حذف کسب‌وکار */}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteBusiness(biz.id)}
                            >
                              حذف
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </>
        )}

        {activeTab === "categories" && (
          <CardContent className="p-6 space-y-12">

            {/* بخش اول: مدیریت دسته‌بندی‌ها */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-black text-lg text-slate-800">مدیریت دسته‌بندی‌ها و قیمت‌گذاری</h3>
              </div>

              {/* فرم افزودن دسته‌بندی جدید */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  const token = Cookies.get("access_token");
                  await api.post("/taxonomy/admin/categories/", {
                    name: formData.get("name"),
                    slug: formData.get("slug"),
                    price: formData.get("price") || 0,
                    icon: formData.get("icon") // دریافت و ارسال آیکون به بک‌اند
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  alert("دسته‌بندی با موفقیت اضافه شد.");
                  (e.target as HTMLFormElement).reset();

                  // --- این دو خط اینجا اضافه می‌شوند تا فرم خالی شود ---
                  setCategorySlug("");
                  setCategoryIcon("");
                  // ----------------------------------------------------

                  fetchAdminCategories();
                } catch (error) {
                  alert("خطا در ثبت دسته‌بندی. ممکن است اسلاگ تکراری باشد.");
                }
              }} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">نام دسته‌بندی</label>
                  <Input type="text" name="name" required placeholder="مثلاً: آرایشگاه زنانه" className="bg-white" />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">اسلاگ (انگلیسی)</label>
                  <Input
                    type="text"
                    name="slug"
                    required
                    placeholder="beauty-salon"
                    dir="ltr"
                    className="bg-white"
                    value={categorySlug}
                    onChange={handleSlugChange}
                  />
                </div>
                <div className="w-full md:w-32 space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">آیکون (ایموجی)</label>
                  <Input
                    type="text"
                    name="icon"
                    placeholder="مثلاً: ✂️"
                    className="bg-white text-center"
                    value={categoryIcon}
                    onChange={(e) => setCategoryIcon(e.target.value)}
                  />
                </div>
                {/* --------------------------- */}
                <div className="w-full md:w-48 space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">هزینه ثبت (تومان)</label>
                  <Input type="number" name="price" defaultValue="0" className="bg-white" />
                </div>
                <Button type="submit" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700">افزودن دسته</Button>
              </form>

              {/* جدول دسته‌بندی‌ها */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">نام دسته‌بندی</th>
                      <th className="p-4 font-semibold">اسلاگ</th>
                      <th className="p-4 font-semibold">قیمت فعلی</th>
                      <th className="p-4 font-semibold">تغییر قیمت</th>
                      <th className="p-4 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingCategories ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : categories.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">دسته‌بندی یافت نشد.</td></tr>
                    ) : (
                      categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 font-bold text-gray-800">{cat.name}</td>
                          <td className="p-4 text-gray-500 font-mono text-xs">{cat.slug}</td>
                          <td className="p-4 text-blue-600 font-bold">{Number(cat.price || 0).toLocaleString()} تومان</td>
                          <td className="p-4">
                            <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); updateCategoryPrice(cat.id, formData.get("price") as string); }} className="flex gap-2">
                              <Input type="number" name="price" defaultValue={cat.price || 0} className="w-28 h-9" />
                              <Button type="submit" size="sm" variant="secondary">ثبت</Button>
                            </form>
                          </td>
                          <td className="p-4 text-center">
                            <Button variant="destructive" size="sm" onClick={async () => {
                              if (confirm("آیا از حذف این دسته‌بندی مطمئن هستید؟")) {
                                const token = Cookies.get("access_token");
                                await api.delete(`/taxonomy/admin/categories/${cat.id}/`, { headers: { Authorization: `Bearer ${token}` } });
                                fetchAdminCategories();
                              }
                            }}>حذف</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* بخش دوم: مدیریت شهرها و مکان‌ها */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-black text-lg text-slate-800">مدیریت شهرها و مناطق تحت پوشش</h3>
              </div>

              {/* فرم افزودن شهر جدید */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  const token = Cookies.get("access_token");
                  await api.post("/taxonomy/admin/locations/", {
                    name: formData.get("name"),
                    slug: formData.get("slug")
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  alert("شهر با موفقیت اضافه شد.");
                  (e.target as HTMLFormElement).reset();
                  fetchAdminLocations();
                } catch (error) {
                  alert("خطا در ثبت شهر. ممکن است اسلاگ تکراری باشد.");
                }
              }} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">نام شهر</label>
                  <Input type="text" name="name" required placeholder="مثلاً: اصفهان" className="bg-white" />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">اسلاگ (انگلیسی)</label>
                  <Input type="text" name="slug" required placeholder="isfahan" dir="ltr" className="bg-white" />
                </div>
                <Button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">افزودن شهر</Button>
              </form>

              {/* جدول شهرها */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">شناسه</th>
                      <th className="p-4 font-semibold">نام شهر</th>
                      <th className="p-4 font-semibold">اسلاگ</th>
                      <th className="p-4 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingLocations ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : locations.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">شهری ثبت نشده است.</td></tr>
                    ) : (
                      locations.map((loc) => (
                        <tr key={loc.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 text-gray-500 font-mono text-xs">{loc.id}</td>
                          <td className="p-4 font-bold text-gray-800">{loc.name}</td>
                          <td className="p-4 text-gray-500 font-mono text-xs">{loc.slug}</td>
                          <td className="p-4 text-center">
                            <Button variant="destructive" size="sm" onClick={async () => {
                              if (confirm("آیا از حذف این شهر مطمئن هستید؟ کسب‌وکارهای وابسته ممکن است دچار مشکل شوند.")) {
                                const token = Cookies.get("access_token");
                                await api.delete(`/taxonomy/admin/locations/${loc.id}/`, { headers: { Authorization: `Bearer ${token}` } });
                                fetchAdminLocations();
                              }
                            }}>حذف شهر</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}

        {activeTab === "cms" && (
          <CardContent className="p-6 space-y-8">
            {isLoadingCms && <p className="text-center text-gray-500 text-sm">در حال بارگذاری...</p>}

            <div className="space-y-4">
              <h3 className="font-bold text-lg text-slate-800 border-b pb-2">بنرهای تبلیغاتی و اسلایدرها</h3>
              <form onSubmit={handleAddBanner} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">عنوان بنر</label>
                  <Input type="text" name="title" required className="bg-white" />
                </div>
                <div className="w-full md:w-48 space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">جایگاه در سایت</label>
                  <select name="position" className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="main_slider">اسلایدر اصلی</option>
                    <option value="sidebar">سایدبار</option>
                    <option value="promotional">ردیف تبلیغاتی</option>
                  </select>
                </div>
                <div className="w-full md:w-64 space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">فایل تصویر</label>
                  <Input type="file" name="image" required accept="image/*" className="bg-white cursor-pointer" />
                </div>
                <Button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">آپلود بنر</Button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {banners.map((banner) => (
                  <Card key={banner.id} className="overflow-hidden">
                    <img src={`http://127.0.0.1:8000${banner.image}`} alt={banner.title} className="w-full h-32 object-cover" />
                    <CardContent className="p-3">
                      <p className="font-bold text-sm truncate">{banner.title}</p>
                      <p className="text-xs text-gray-500 mt-1 mb-3">جایگاه: {banner.position}</p>
                      <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDeleteBanner(banner.id)}>حذف بنر</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        )}

        {activeTab === "users" && (
          <>
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b pb-4">
              <CardTitle className="text-lg">مدیریت کاربران پلتفرم</CardTitle>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{users.length} کاربر</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">شناسه</th>
                      <th className="p-4 font-semibold">شماره موبایل</th>
                      <th className="p-4 font-semibold">نقش کاربری</th>
                      <th className="p-4 font-semibold">تاریخ عضویت</th>
                      <th className="p-4 font-semibold text-center">عملیات</th>
                      <th className="p-4 font-semibold text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingUsers ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 text-gray-500 font-mono text-xs">{u.id?.toString().slice(0, 8)}...</td>
                          <td className="p-4 font-bold text-gray-800">{u.phone_number || "نامشخص"}</td>
                          <td className="p-4"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-bold">{roleTranslator[u.role] || u.role}</span></td>
                          <td className="p-4 text-gray-600">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString("fa-IR") : "نامشخص"}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${u.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {u.is_active !== false ? "فعال" : "مسدود"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {/* جلوگیری از مسدود کردن مدیر کل توسط خودش */}
                            {u.role !== 'ADMIN' && u.role !== 'superadmin' ? (
                              <Button
                                size="sm"
                                variant={u.is_active !== false ? "destructive" : "default"}
                                className={u.is_active === false ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                onClick={() => toggleUserStatus(u.id, u.is_active !== false)}
                              >
                                {u.is_active !== false ? "مسدود کردن" : "رفع مسدودی"}
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-xs font-bold">غیرقابل تغییر</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </>
        )}


        {/* تب مدیریت پلن‌های VIP */}
        {activeTab === "vip_plans" && (
          <CardContent className="p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-black text-lg text-slate-800">مدیریت اشتراک‌های VIP</h3>
              </div>

              {/* فرم افزودن پلن جدید */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  const token = Cookies.get("access_token");
                  await api.post("/directory/admin/subscription-plans/", {
                    name: formData.get("name"),
                    base_discount_percentage: formData.get("base_discount_percentage"),
                    price_per_month: formData.get("price_per_month"),
                    is_active: true
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  alert("پلن VIP با موفقیت اضافه شد.");
                  (e.target as HTMLFormElement).reset();
                  fetchAdminVipPlans();
                } catch (error) {
                  alert("خطا در ثبت پلن VIP.");
                }
              }} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">نام پلن (مثل: طلایی)</label>
                  <Input type="text" name="name" required className="bg-white" />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">درصد تخفیف ثابت</label>
                  <Input type="number" name="base_discount_percentage" required className="bg-white" />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">قیمت ماهانه (تومان)</label>
                  <Input type="number" name="price_per_month" required className="bg-white" />
                </div>
                <Button type="submit" className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold">افزودن پلن</Button>
              </form>

              {/* جدول پلن‌ها */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">نام پلن</th>
                      <th className="p-4 font-semibold">درصد تخفیف</th>
                      <th className="p-4 font-semibold">قیمت ماهانه</th>
                      <th className="p-4 font-semibold text-center">وضعیت</th>
                      <th className="p-4 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingVipPlans ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : vipPlans.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">پلنی یافت نشد.</td></tr>
                    ) : (
                      vipPlans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 font-bold text-gray-800">{plan.name}</td>
                          <td className="p-4 font-bold text-emerald-600">{plan.base_discount_percentage}٪</td>
                          <td className="p-4 text-blue-600 font-bold">{Number(plan.price_per_month).toLocaleString()} تومان</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${plan.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {plan.is_active ? "فعال" : "غیرفعال"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Button size="sm" variant={plan.is_active ? "destructive" : "default"} onClick={() => toggleVipPlanStatus(plan.id, plan.is_active)}>
                              {plan.is_active ? "غیرفعال کردن" : "فعال کردن"}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}

        {/* تب تاریخچه تراکنش‌ها (CRM مرکزی) */}
        {activeTab === "transactions" && (
          <>
            <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b pb-4">
              <CardTitle className="text-lg">تاریخچه کل تراکنش‌های پلتفرم</CardTitle>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{transactions.length} تراکنش</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold">کسب‌وکار</th>
                      <th className="p-4 font-semibold">مشتری</th>
                      <th className="p-4 font-semibold">مبلغ اولیه</th>
                      <th className="p-4 font-semibold">درصد اعمال شده</th>
                      <th className="p-4 font-semibold">منبع تخفیف</th>
                      <th className="p-4 font-semibold">مبلغ نهایی (پرداختی)</th>
                      <th className="p-4 font-semibold">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingTransactions ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                    ) : transactions.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500">تراکنشی ثبت نشده است.</td></tr>
                    ) : (
                      transactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 font-bold text-gray-800">{trx.business_name || "نامشخص"}</td>
                          <td className="p-4 text-gray-600">{trx.customer_phone || "نامشخص"}</td>
                          <td className="p-4 text-gray-500">{Number(trx.original_amount).toLocaleString()}</td>
                          <td className="p-4 font-bold text-emerald-600">{trx.applied_discount_percentage}٪</td>
                          <td className="p-4 text-xs font-bold text-slate-500">
                            {trx.discount_source === 'SUBSCRIPTION' ? 'اشتراک VIP' : trx.discount_source === 'CAMPAIGN' ? 'کمپین' : 'بدون تخفیف'}
                          </td>
                          <td className="p-4 text-blue-600 font-black">{Number(trx.final_amount).toLocaleString()} تومان</td>
                          <td className="p-4 text-gray-500 text-xs">
                            {new Date(trx.created_at).toLocaleDateString("fa-IR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </>
        )}
      </Card>

    </div>

  );
}