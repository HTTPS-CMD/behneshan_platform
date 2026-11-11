import type { Metadata } from "next";
import Link from "next/link";
import { Home, Percent, Search, Store } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BackButton from "@/components/site/BackButton";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد | چهارسوق",
  robots: { index: false, follow: false },
};

/**
 * صفحه‌ی اختصاصی ۴۰۴.
 * برای هر آدرس اشتباه، کسب‌وکاری که وجود ندارد، و تلاش برای ورود به مسیرهای مدیریتی بدون دسترسی نمایش داده می‌شود.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-cream" dir="rtl">
      <SiteHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-girih-light opacity-60" aria-hidden="true" />

        <section className="relative w-full max-w-2xl text-center">
          {/* طاق بازار و عدد ۴۰۴ */}
          <div className="relative mx-auto mb-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
            <svg viewBox="0 0 400 230" className="w-full" aria-hidden="true">
              <defs>
                <linearGradient id="nf-arch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1f466f" />
                  <stop offset="1" stopColor="#10304f" />
                </linearGradient>
              </defs>
              <path d="M40 230 V120 Q40 20 200 20 Q360 20 360 120 V230 Z" fill="url(#nf-arch)" />
              <path d="M70 230 V125 Q70 50 200 50 Q330 50 330 125 V230" fill="none" stroke="#da7f37" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
              <circle cx="200" cy="20" r="9" fill="#da7f37" />
            </svg>
            <p className="absolute inset-x-0 top-[38%] text-7xl font-black tracking-tight text-cream md:text-8xl">
              ۴۰۴
            </p>
          </div>

          <h1 className="text-2xl font-black text-brand-900 md:text-3xl animate-in fade-in slide-in-from-bottom-2 duration-700">
            این راسته در بازار چهارسوق پیدا نشد!
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-brand-700/80 animate-in fade-in slide-in-from-bottom-2 duration-700">
            صفحه‌ای که دنبالش هستید وجود ندارد، جابه‌جا شده یا اجازه‌ی دسترسی به آن را ندارید.
            از جستجو کمک بگیرید یا به صفحه‌ی اصلی برگردید.
          </p>

          {/* جستجو (بدون نیاز به جاوااسکریپت هم کار می‌کند) */}
          <form action="/" method="get" role="search" className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-2xl border border-cream-200 bg-white p-2 shadow-sm focus-within:ring-3 focus-within:ring-brand-100">
            <Search className="mr-2 h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
            <label htmlFor="nf-search" className="sr-only">جستجوی کسب‌وکار</label>
            <input
              id="nf-search"
              type="search"
              name="search"
              placeholder="نام فروشگاه، رستوران، خدمات..."
              className="no-focus-ring h-11 min-w-0 flex-1 bg-transparent text-sm text-brand-900 placeholder:text-gray-500"
            />
            <button type="submit" className="h-11 shrink-0 rounded-xl bg-saffron-500 px-5 text-sm font-black text-brand-950 transition-colors hover:bg-saffron-400">
              جستجو
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-800">
              <Home className="h-4 w-4" aria-hidden="true" /> صفحه‌ی اصلی
            </Link>
            <Link href="/daily-discounts" className="inline-flex h-11 items-center gap-2 rounded-xl border border-cream-200 bg-white px-5 text-sm font-bold text-brand-800 transition-colors hover:border-brand-200 hover:bg-brand-50">
              <Percent className="h-4 w-4" aria-hidden="true" /> تخفیف‌های روز
            </Link>
            <Link href="/#latest-title" className="inline-flex h-11 items-center gap-2 rounded-xl border border-cream-200 bg-white px-5 text-sm font-bold text-brand-800 transition-colors hover:border-brand-200 hover:bg-brand-50">
              <Store className="h-4 w-4" aria-hidden="true" /> همه‌ی کسب‌وکارها
            </Link>
            <BackButton />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
