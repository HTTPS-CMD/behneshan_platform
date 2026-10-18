"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  Store,
  Settings,
  LogOut,
  Menu,
  Bell,
  User as UserIcon,
  Heart,
  Ticket,
  UserCheck,
  Users,
  Crown,
  ImagePlus,
  Package,
  Rocket,
  Activity
} from "lucide-react";

// ایمپورت‌های shadcn
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button as RACButton } from "react-aria-components";
import ClearCacheButton from "@/components/ClearCacheButton";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  // خواندن نقش کاربر از Zustand برای نمایش منوهای اختصاصی
  const { isAuthenticated, role, logout } = useAuthStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // یا می‌توانید اینجا یک اسپینر لودینگ ساده قرار دهید
  }

  // تعریف منوها بر اساس نقش
  const getMenuLinks = () => {
    const baseLinks = [
      { href: "/", label: "صفحه اصلی سایت", icon: LayoutDashboard },
    ];

    if (role === "ADMIN") {
      return [
        ...baseLinks,
        { href: "/admin-panel", label: "پنل مدیریت", icon: Settings },
        { href: "/admin-panel/analytics", label: "آمار و عملکرد", icon: Activity },
      ];
    }
    if (role === "BUSINESS_OWNER") {
      return [
        ...baseLinks,
        { href: "/dashboard/owner", label: "مدیریت کسب‌وکار", icon: Store },
        { href: "/dashboard/owner/stories", label: "مدیریت استوری‌ها", icon: ImagePlus },
        { href: "/dashboard/owner/account", label: "حساب کاربری", icon: UserIcon },
        { href: "/dashboard/owner/analytics", label: "آمار و بازدید", icon: Settings },
        { href: "/dashboard/owner/campaigns", label: "کدهای تخفیف", icon: Ticket },
        { href: "/dashboard/owner/crm", label: "پذیرش مشتری ", icon: UserCheck },
        { href: "/dashboard/owner/customers", label: "مشتریان من", icon: Users },
        { href: "/dashboard/owner/products", label: "مدیریت محصولات", icon: Package },
        { href: "/dashboard/owner/requests", label: "درخواست امکانات ویژه", icon: Rocket },
      ];
    }
    // پیش‌فرض برای CLIENT
    return [
      ...baseLinks,
      { href: "/dashboard/client", label: "داشبورد من", icon: UserIcon },
      { href: "/dashboard/client/vip", label: "اشتراک VIP", icon: Crown },
      { href: "/dashboard/client/favorites", label: "علاقه‌مندی‌ها", icon: Heart },
    ];
  };

  const menuLinks = getMenuLinks();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // کامپوننت مشترک منوی کناری
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="h-20 flex items-center px-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
            📍
          </div>
          <span className="text-xl font-black text-white">چهارسوق</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuLinks.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <span className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${isActive
                ? "bg-emerald-500/10 text-emerald-400"
                : "hover:bg-slate-800 hover:text-white"
                }`}>
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">

        {/* این بخش اضافه می‌شود: نمایش دکمه فقط برای ادمین‌ها */}
        {(role === "ADMIN" || role === "admin" || role === "superadmin") && (
            <ClearCacheButton />
        )}


        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-rose-400 hover:bg-rose-500/10 rounded-xl font-medium transition-all"
        >
          <LogOut className="w-5 h-5" />
          خروج از حساب
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">

      {/* سایدبار دسکتاپ */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* بخش اصلی محتوا */}
      <main className="flex-1 lg:pr-72 w-full flex flex-col min-h-screen">

        {/* هدر بالای پنل */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-10 sticky top-0 z-40">

          {/* سمت راست: دکمه منوی موبایل و عنوان */}
          <div className="flex items-center gap-3">

            {/* کلید اصلی باز کردن منو در موبایل */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-all focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* اصلاح مهم: حذف تگ اضافه Sheet و استفاده مستقیم از isOpen در SheetContent */}
            <SheetContent
              isOpen={isMobileMenuOpen}
              onOpenChange={setIsMobileMenuOpen}
              side="right"
              className="p-0 w-72 border-none"
            >
              <SheetTitle className="sr-only">منوی ناوبری موبایل</SheetTitle>
              <SidebarContent />
            </SheetContent>

            <h1 className="text-sm sm:text-lg font-black text-gray-800">
              {role === "ADMIN" || role === "admin" || role === "superadmin" ? "پنل مدیریت کل" : "داشبورد اختصاصی"}
            </h1>
          </div>

          {/* سمت چپ: آیکون زنگوله و آواتار ثابت (بدون کلیک) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative p-2 text-gray-500 hover:text-emerald-600 transition-colors rounded-full hover:bg-gray-50 focus:outline-none">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>

            {/* آواتار ثابت - فقط برای زیبایی سایت */}
            <div className="h-11 w-11 rounded-full border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center">
              U
            </div>
          </div>
        </header>

        {/* بدنه متغیر داشبورد (اینجا صفحات مختلف رندر میشن) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 p-6 lg:p-10"
        >
          {children}
        </motion.div>

      </main>
    </div>
  );
}