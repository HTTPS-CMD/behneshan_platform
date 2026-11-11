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
  Crown,
  ImagePlus,
  Package,
  Rocket,
  Activity,
  Receipt,
  MessageSquareText,
  Handshake,
  HeartPulse,
  Mail,
  SearchCheck
} from "lucide-react";

import { SheetContent, SheetTitle } from "@/components/ui/sheet";
import ClearCacheButton from "@/components/ClearCacheButton";
import NotificationBell from "@/components/notifications/NotificationBell";
import UserMenu from "@/components/layout/UserMenu";
import Logo from "@/components/brand/Logo";


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
        { href: "/admin-panel/notifications", label: "اعلان‌ها", icon: Bell },
        { href: "/admin-panel/sms", label: "سامانه پیامکی", icon: MessageSquareText },
        { href: "/admin-panel/merchant-club", label: "باشگاه پذیرندگان", icon: Handshake },
        { href: "/admin-panel/messages", label: "پیام‌های تماس", icon: Mail },
        { href: "/admin-panel/seo", label: "سئو", icon: SearchCheck },
        { href: "/admin-panel/system", label: "سلامت و بکاپ", icon: HeartPulse },
        { href: "/dashboard/account", label: "حساب کاربری", icon: UserIcon },
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
        // همه‌ی بخش‌های باشگاه (تراکنش، مشتری، طرح، پیامک، دیتای هوشمند، شعب) با تب‌های بالای صفحه در دسترس‌اند
        { href: "/dashboard/owner/club/transactions", label: "باشگاه مشتریان", icon: Receipt, match: "/dashboard/owner/club" },
        { href: "/dashboard/owner/products", label: "مدیریت محصولات", icon: Package },
        { href: "/dashboard/owner/requests", label: "درخواست امکانات ویژه", icon: Rocket },
        { href: "/dashboard/notifications", label: "اعلان‌ها", icon: Bell },
      ];
    }
    // پیش‌فرض برای CLIENT
    return [
      ...baseLinks,
      { href: "/dashboard/client", label: "داشبورد من", icon: UserIcon },
      { href: "/dashboard/client/vip", label: "اشتراک VIP", icon: Crown },
      { href: "/dashboard/client/favorites", label: "علاقه‌مندی‌ها", icon: Heart },
      { href: "/dashboard/notifications", label: "اعلان‌ها", icon: Bell },
      { href: "/dashboard/account", label: "حساب کاربری", icon: UserIcon },
    ];
  };

  const menuLinks = getMenuLinks();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // کامپوننت مشترک منوی کناری
  const SidebarContent = () => (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden bg-brand-900 text-brand-200">
      <div className="pointer-events-none absolute inset-0 bg-girih-light opacity-70" aria-hidden="true" />
      <div className="relative h-20 flex items-center px-6 border-b border-brand-800">
        <Logo tone="dark" size={44} tagline="" />
      </div>

      <nav className="sidebar-scroll relative flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain">
        {menuLinks.map((item) => {
          const isActive = "match" in item && item.match ? pathname.startsWith(item.match as string) : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <span className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                ? "bg-saffron-500/15 text-saffron-200 font-bold"
                : "hover:bg-brand-800 hover:text-cream hover:-translate-x-0.5"
                }`}>
                {isActive && <motion.span layoutId="sidebar-active" className="absolute inset-y-2 right-0 w-1 rounded-full bg-saffron-400" />}
                <Icon className={`w-5 h-5 ${isActive ? "text-saffron-300" : "text-brand-300"}`} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="relative p-4 border-t border-brand-800">

        {/* این بخش اضافه می‌شود: نمایش دکمه فقط برای ادمین‌ها */}
        {role === "ADMIN" && (
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
    <div className="min-h-screen bg-cream flex" dir="rtl">

      {/* سایدبار دسکتاپ */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* بخش اصلی محتوا */}
      <main className="flex-1 lg:pr-72 w-full flex flex-col min-h-screen">

        {/* هدر بالای پنل */}
        <header className="h-20 bg-white/85 backdrop-blur-xl border-b border-cream-200 flex items-center justify-between px-4 lg:px-10 sticky top-0 z-40">

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

            <h1 className="text-sm sm:text-lg font-black text-brand-900">
              {role === "ADMIN" ? "پنل مدیریت کل" : "داشبورد اختصاصی"}
            </h1>
          </div>

          {/* سمت چپ: زنگوله‌ی اعلان‌ها و منوی پروفایل */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell />

            <UserMenu />
          </div>
        </header>

        {/* بدنه متغیر داشبورد (اینجا صفحات مختلف رندر میشن) */}
        {/* انیمیشن ورود با CSS تا transform باقی‌مانده، مودال‌ها و عناصر fixed را جابه‌جا نکند */}
        <div className="page-enter flex-1 min-w-0 p-4 sm:p-6 lg:p-10">
          {children}
        </div>

      </main>
    </div>
  );
}