"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogIn, LogOut, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { getCmsData } from "@/lib/cms";
import Logo from "@/components/brand/Logo";

/**
 * هدر مشترک سایت (صفحه‌ی اصلی، درباره ما، تماس با ما، قوانین).
 * منوها از پنل ادمین ← «منوها» (جایگاه header) خوانده می‌شوند.
 */
export default function SiteHeader() {
  const { isAuthenticated, logout, role } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [headerMenus, setHeaderMenus] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    getCmsData()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((cms) => setHeaderMenus((cms?.menus || []).filter((m: any) => m.position === "header")))
      .catch(() => setHeaderMenus([]));
  }, []);

  const panelHref = role === "ADMIN" ? "/admin-panel" : role === "BUSINESS_OWNER" ? "/dashboard/owner" : "/dashboard/client";
  const panelLabel = role === "ADMIN" ? "پنل مدیریت کل" : role === "BUSINESS_OWNER" ? "پنل کسب‌وکار" : "پنل کاربری";

  return (
    <header className="sticky top-0 z-50 border-b border-cream-200/80 bg-cream/80 backdrop-blur-xl supports-[backdrop-filter]:bg-cream/70">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center gap-4">
        <div className="flex items-center gap-10 min-w-0">
          <Logo size={46} />

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-brand-700">
            {headerMenus.length > 0 ? (
              [...headerMenus].sort((a: any, b: any) => a.order - b.order).map((menuItem: any) => (
                <Link
                  key={menuItem.id}
                  href={menuItem.url}
                  className="relative py-1 transition-colors hover:text-saffron-700 after:absolute after:-bottom-0.5 after:right-0 after:h-[2px] after:w-0 after:rounded-full after:bg-saffron-500 after:transition-all after:duration-300 hover:after:w-full"
                >
                  {menuItem.title}
                </Link>
              ))
            ) : (
              <Link href="/" className="text-saffron-700 font-bold">صفحه اصلی</Link>
            )}
          </nav>
        </div>

        {/* در موبایل ورود/پنل/خروج داخل تب «حساب من» منوی پایین است */}
        <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
          {isMounted ? (
            isAuthenticated ? (
              <>
                <span className="hidden xl:block text-sm font-bold text-brand-700">سلام، خوش آمدید</span>
                <Link
                  href={panelHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-bold text-cream shadow-lg shadow-brand-900/15 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">{panelLabel}</span>
                </Link>
                <button
                  onClick={() => { logout(); window.location.reload(); }}
                  aria-label="خروج از حساب"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white/70 px-4 py-2.5 text-sm font-bold text-brand-800 transition-all duration-300 hover:border-brand-300 hover:bg-white hover:shadow-md"
                >
                  <LogIn className="h-4 w-4" />
                  ورود
                </Link>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-saffron-500 px-5 py-2.5 text-sm font-black text-brand-950 shadow-lg shadow-saffron-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-saffron-400"
                >
                  <Store className="h-4 w-4" />
                  ثبت کسب‌وکار
                </Link>
              </>
            )
          ) : (
            <div className="flex gap-3">
              <div className="hidden sm:block w-32 h-10 bg-cream-200 rounded-xl animate-pulse"></div>
              <div className="w-24 h-10 bg-cream-200 rounded-xl animate-pulse"></div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
