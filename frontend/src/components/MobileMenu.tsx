"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronLeft,
  Heart,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Search,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { getCmsData } from "@/lib/cms";
import { useAuthStore } from "@/store/useAuthStore";
import { accountPageFor } from "@/components/layout/profileUtils";

/**
 * منوی پایین موبایل (۵ تب ثابت، شبیه اپلیکیشن):
 * خانه | دسته‌بندی‌ها | جستجو (دکمه‌ی وسط) | تخفیف‌ها | حساب من
 * - تب‌ها ثابت‌اند و از پنل ادمین تغییر نمی‌کنند.
 * - داخل «حساب من» همان لینک‌های منوی هدر دسکتاپ (پنل ادمین ← منوها، جایگاه هدر) نمایش داده می‌شود
 *   تا منوی موبایل و دسکتاپ یکی باشند.
 * - دسته‌بندی و جستجو کاربر را به صفحه‌ی اصلی با پارامتر آدرس می‌برند (‎/?category=…‎ و ‎/?search=…‎).
 */

type Sheet = "categories" | "search" | "account" | null;

interface Taxonomy {
  id: string;
  name: string;
  icon?: string;
}

interface MenuItem {
  id: number | string;
  title: string;
  url: string;
  order: number;
  position: string;
}

const FALLBACK_LINKS = [
  { id: "about", title: "درباره ما", url: "/about" },
  { id: "contact", title: "تماس با ما", url: "/contact" },
  { id: "terms", title: "قوانین مشتریان", url: "/terms/client" },
];

export default function MobileMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, role, logout } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [hidden, setHidden] = useState(false);

  const [categories, setCategories] = useState<Taxonomy[] | null>(null);
  const [locations, setLocations] = useState<Taxonomy[] | null>(null);
  const [headerMenus, setHeaderMenus] = useState<MenuItem[]>([]);

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // منوی هدر (همان منوی دسکتاپ) برای بخش «حساب من»
  useEffect(() => {
    getCmsData()
      .then((cms) =>
        setHeaderMenus(
          ((cms?.menus || []) as MenuItem[])
            .filter((m) => m.position === "header")
            .sort((a, b) => a.order - b.order),
        ),
      )
      .catch(() => setHeaderMenus([]));
  }, []);

  // پنهان شدن نوار هنگام اسکرول به پایین و نمایش دوباره هنگام اسکرول به بالا
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // با تغییر صفحه، پنل باز بسته شود
  useEffect(() => setSheet(null), [pathname]);

  // قفل اسکرول صفحه و بستن با Escape وقتی پنل باز است
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet]);

  // داده‌ها فقط وقتی پنل مربوط باز شود گرفته می‌شوند
  useEffect(() => {
    if (sheet === "categories" && categories === null) {
      api.get("/taxonomy/categories/").then(({ data }) => setCategories(data.results || data)).catch(() => setCategories([]));
    }
    if (sheet === "search") {
      if (locations === null) {
        api.get("/taxonomy/locations/").then(({ data }) => setLocations(data.results || data)).catch(() => setLocations([]));
      }
      setTimeout(() => searchInput.current?.focus(), 250);
    }
  }, [sheet, categories, locations]);

  const toggle = (s: Exclude<Sheet, null>) => setSheet((cur) => (cur === s ? null : s));

  const goToResults = (params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    setSheet(null);
    router.push(qs ? `/?${qs}` : "/");
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToResults({ search: query.trim(), location });
  };

  const active: Sheet | "home" | "discounts" | null =
    sheet ?? (pathname === "/" ? "home" : pathname.startsWith("/daily-discounts") ? "discounts" : null);

  const panelHref = role === "ADMIN" ? "/admin-panel" : role === "BUSINESS_OWNER" ? "/dashboard/owner" : "/dashboard/client";
  const panelLabel = role === "ADMIN" ? "پنل مدیریت" : role === "BUSINESS_OWNER" ? "پنل کسب‌وکار" : "پنل کاربری";
  const notificationsHref = role === "ADMIN" ? "/admin-panel/notifications" : "/dashboard/notifications";
  const siteLinks = headerMenus.length > 0 ? headerMenus : FALLBACK_LINKS;

  const tabClass = "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px] text-[11px] font-bold transition-colors active:scale-95";
  const tabColor = (key: string) => (active === key ? "text-brand-800" : "text-brand-400");
  const Indicator = ({ k }: { k: string }) =>
    active === k ? (
      <motion.span layoutId="mobile-tab-indicator" className="absolute top-0 h-1 w-8 rounded-b-full bg-saffron-500" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
    ) : null;

  return (
    <>
      {/* ===== پنل‌های بازشونده از پایین ===== */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[60] bg-brand-950/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheet(null)}
            />
            <motion.div
              key={sheet}
              role="dialog"
              aria-modal="true"
              aria-label={sheet === "categories" ? "دسته‌بندی‌ها" : sheet === "search" ? "جستجو" : "حساب من"}
              className="fixed inset-x-0 bottom-0 z-[70] max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-cream px-5 pt-3 shadow-2xl shadow-brand-950/30 pb-[calc(6rem+env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && setSheet(null)}
              dir="rtl"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cream-200" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="بستن"
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm"
              >
                <X className="h-5 w-5" />
              </button>

              {/* --- دسته‌بندی‌ها --- */}
              {sheet === "categories" && (
                <div>
                  <h2 className="mb-4 text-lg font-black text-brand-900">دسته‌بندی‌ها</h2>
                  {categories === null ? (
                    <div className="flex justify-center py-10 text-brand-400"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
                  ) : categories.length === 0 ? (
                    <p className="py-8 text-center text-sm text-brand-500">دسته‌بندی‌ای ثبت نشده است.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => goToResults({})}
                        className="flex flex-col items-center gap-2 rounded-2xl border border-cream-200 bg-white px-2 py-4 text-xs font-bold text-brand-800 transition active:scale-95"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><LayoutGrid className="h-5 w-5" /></span>
                        همه
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => goToResults({ category: String(c.id) })}
                          className="flex flex-col items-center gap-2 rounded-2xl border border-cream-200 bg-white px-2 py-4 text-xs font-bold text-brand-800 transition active:scale-95"
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700">
                            {c.icon ? c.icon : <Tag className="h-5 w-5" />}
                          </span>
                          <span className="line-clamp-1">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* --- جستجو --- */}
              {sheet === "search" && (
                <form onSubmit={submitSearch}>
                  <h2 className="mb-4 text-lg font-black text-brand-900">جستجو</h2>
                  <label className="flex items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 transition focus-within:border-saffron-400 focus-within:ring-4 focus-within:ring-saffron-100">
                    <Search className="h-5 w-5 shrink-0 text-brand-400" />
                    <span className="sr-only">نام کسب‌وکار یا خدمات</span>
                    <input
                      ref={searchInput}
                      type="search"
                      enterKeyHint="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="نام کسب‌وکار یا خدمات..."
                      className="no-focus-ring w-full appearance-none bg-transparent py-4 text-base text-brand-900 placeholder-brand-300"
                    />
                  </label>

                  <p className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-bold text-brand-700"><MapPin className="h-4 w-4" /> محدوده</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLocation("")}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${location === "" ? "bg-brand-800 text-cream" : "bg-white text-brand-700 ring-1 ring-cream-200"}`}
                    >
                      همه
                    </button>
                    {(locations || []).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLocation(String(l.id))}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition ${location === String(l.id) ? "bg-brand-800 text-cream" : "bg-white text-brand-700 ring-1 ring-cream-200"}`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>

                  <button type="submit" className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-saffron-500 font-black text-brand-950 shadow-lg shadow-saffron-500/30 transition active:scale-[0.98]">
                    <Search className="h-5 w-5" />
                    جستجو کن
                  </button>
                </form>
              )}

              {/* --- حساب من --- */}
              {sheet === "account" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-4 text-lg font-black text-brand-900">حساب من</h2>
                    {mounted && isAuthenticated ? (
                      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
                        <SheetLink href={panelHref} icon={LayoutDashboard} label={panelLabel} />
                        <SheetLink href={accountPageFor(role)} icon={UserRound} label="حساب کاربری" />
                        <SheetLink href={notificationsHref} icon={Bell} label="اعلان‌ها" />
                        {role === "CLIENT" && <SheetLink href="/dashboard/client/favorites" icon={Heart} label="علاقه‌مندی‌ها" />}
                        <button
                          type="button"
                          onClick={() => { logout(); window.location.href = "/"; }}
                          className="flex w-full items-center gap-3 px-4 py-4 text-sm font-bold text-rose-700 transition active:bg-rose-50"
                        >
                          <LogOut className="h-5 w-5" />
                          خروج از حساب
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Link href="/login" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-800 text-sm font-bold text-cream">
                          <LogIn className="h-4 w-4" /> ورود
                        </Link>
                        <Link href="/register" className="flex h-12 items-center justify-center rounded-2xl bg-saffron-500 text-sm font-black text-brand-950">
                          ثبت‌نام
                        </Link>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-black text-brand-500">صفحات سایت</h3>
                    <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
                      {siteLinks.map((m) => (
                        <SheetLink key={m.id} href={m.url} label={m.title} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== نوار تب پایین ===== */}
      <motion.nav
        aria-label="منوی اصلی موبایل"
        className="fixed inset-x-0 bottom-0 z-[80] border-t border-cream-200/80 bg-cream/90 backdrop-blur-xl supports-[backdrop-filter]:bg-cream/75 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(16,48,79,0.08)]"
        animate={{ y: hidden && !sheet ? "110%" : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        dir="rtl"
      >
        <div className="mx-auto flex max-w-md items-end px-2">
          <Link href="/" onClick={() => setSheet(null)} className={`${tabClass} ${tabColor("home")}`} aria-current={active === "home" ? "page" : undefined}>
            <Indicator k="home" />
            <Home className="h-6 w-6" strokeWidth={active === "home" ? 2.4 : 1.8} />
            خانه
          </Link>

          <button type="button" onClick={() => toggle("categories")} className={`${tabClass} ${tabColor("categories")}`} aria-expanded={sheet === "categories"}>
            <Indicator k="categories" />
            <LayoutGrid className="h-6 w-6" strokeWidth={active === "categories" ? 2.4 : 1.8} />
            دسته‌بندی‌ها
          </button>

          {/* دکمه‌ی وسط: جستجو */}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => toggle("search")}
              aria-label="جستجو"
              aria-expanded={sheet === "search"}
              className={`-mt-6 mb-1.5 flex h-14 w-14 items-center justify-center rounded-2xl text-brand-950 shadow-lg shadow-saffron-500/40 ring-4 ring-cream transition-transform active:scale-90 ${sheet === "search" ? "bg-saffron-400 rotate-45" : "bg-saffron-500"}`}
            >
              {sheet === "search" ? <X className="h-6 w-6 -rotate-45" /> : <Search className="h-6 w-6" strokeWidth={2.4} />}
            </button>
          </div>

          <Link href="/daily-discounts" onClick={() => setSheet(null)} className={`${tabClass} ${tabColor("discounts")}`} aria-current={active === "discounts" ? "page" : undefined}>
            <Indicator k="discounts" />
            <Tag className="h-6 w-6" strokeWidth={active === "discounts" ? 2.4 : 1.8} />
            تخفیف‌ها
          </Link>

          <button type="button" onClick={() => toggle("account")} className={`${tabClass} ${tabColor("account")}`} aria-expanded={sheet === "account"}>
            <Indicator k="account" />
            <UserRound className="h-6 w-6" strokeWidth={active === "account" ? 2.4 : 1.8} />
            حساب من
          </button>
        </div>
      </motion.nav>
    </>
  );
}

function SheetLink({ href, label, icon: Icon }: { href: string; label: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-cream-100 px-4 py-4 text-sm font-bold text-brand-800 transition last:border-b-0 active:bg-cream-100">
      {Icon && <Icon className="h-5 w-5 text-brand-500" />}
      <span className="flex-1">{label}</span>
      <ChevronLeft className="h-4 w-4 text-brand-300" />
    </Link>
  );
}
