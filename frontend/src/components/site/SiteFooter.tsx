"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCmsData } from "@/lib/cms";
import Logo from "@/components/brand/Logo";
import MobileMenu from "@/components/MobileMenu";

/**
 * فوتر مشترک سایت + منوی پایین موبایل.
 * لینک‌های «لینک‌های مفید» از پنل ادمین ← «منوها» (جایگاه footer) خوانده می‌شوند.
 */
export default function SiteFooter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [footerMenus, setFooterMenus] = useState<any[]>([]);

  useEffect(() => {
    getCmsData()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((cms) => setFooterMenus((cms?.menus || []).filter((m: any) => m.position === "footer")))
      .catch(() => setFooterMenus([]));
  }, []);

  return (
    <>
    <footer className="relative overflow-hidden bg-brand-900 text-brand-100">
      <div className="absolute inset-0 bg-girih-light opacity-60" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-16 pb-28 md:pb-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <Logo tone="dark" size={52} />
            <p className="max-w-xs text-sm leading-7 text-brand-200">
              چهارسوق؛ بازار شهر در یک نگاه. کسب‌وکارهای محلی، تخفیف‌های واقعی و اشتراک VIP، همه یک‌جا.
            </p>
          </div>
          <nav aria-label="لینک‌های فوتر" className="md:col-span-2 grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-4 text-sm font-black text-cream">چهارسوق</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/about" className="transition-colors hover:text-saffron-300">درباره ما</Link></li>
                <li><Link href="/contact" className="transition-colors hover:text-saffron-300">تماس با ما</Link></li>
                <li><Link href="/landing" className="transition-colors hover:text-saffron-300">معرفی چهارسوق</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-black text-cream">کاربران</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/daily-discounts" className="transition-colors hover:text-saffron-300">تخفیف‌های امروز</Link></li>
                <li><Link href="/terms/client" className="transition-colors hover:text-saffron-300">قوانین مشتریان</Link></li>
                <li><Link href="/terms/business" className="transition-colors hover:text-saffron-300">قوانین کسب‌وکار</Link></li>
              </ul>
            </div>
            {footerMenus.length > 0 && (
              <div>
                <h3 className="mb-4 text-sm font-black text-cream">لینک‌های مفید</h3>
                <ul className="space-y-2.5 text-sm">
                  {[...footerMenus].sort((a: any, b: any) => a.order - b.order).map((m: any) => (
                    <li key={m.id}><Link href={m.url} className="transition-colors hover:text-saffron-300">{m.title}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </nav>
        </div>
        <div className="mt-12 border-t border-brand-700/70 pt-6 text-center text-sm font-medium text-brand-300">
          تمامی حقوق مادی و معنوی برای پلتفرم چهارسوق محفوظ است.
        </div>
      </div>
    </footer>

      <div className="block md:hidden">
        <MobileMenu />
      </div>
    </>
  );
}
