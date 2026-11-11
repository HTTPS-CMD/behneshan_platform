import { BadgePercent, Store, Ticket } from "lucide-react";

/**
 * ستون تصویری کنار فرم ورود و ثبت‌نام (مشترک بین هر دو صفحه).
 * قبلاً عکس از سایت خارجی (unsplash) لود می‌شد که روی سرور ایران باز نمی‌شود.
 */
export default function AuthSidePanel() {
  return (
    <div className="relative hidden w-1/2 overflow-hidden bg-brand-900 lg:flex" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(218,127,55,0.35),transparent_60%),radial-gradient(50%_50%_at_10%_90%,rgba(63,110,156,0.35),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M30 0l7 23 23 7-23 7-7 23-7-23L0 30l23-7z' fill='white'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative m-auto max-w-md space-y-6 p-12 text-white animate-in fade-in slide-in-from-bottom-6 duration-1000" dir="rtl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-full.webp" alt="" className="mb-2 h-40 w-auto rounded-3xl bg-cream p-4 shadow-2xl shadow-black/30" />
        <h2 className="text-4xl font-black leading-tight">چهارسوق؛ بازار شهرت، توی جیبت</h2>
        <p className="text-lg leading-8 text-slate-300">کسب‌وکارهای تأییدشده، کد تخفیف اختصاصی و اشتراک VIP، همه یک‌جا.</p>
        <ul className="space-y-3 text-sm font-bold text-slate-200">
          <li className="flex items-center gap-3"><Ticket className="h-5 w-5 text-saffron-400" /> کد تخفیف اختصاصی از کسب‌وکارهای محلی</li>
          <li className="flex items-center gap-3"><BadgePercent className="h-5 w-5 text-amber-400" /> تخفیف ثابت با اشتراک VIP</li>
          <li className="flex items-center gap-3"><Store className="h-5 w-5 text-sky-400" /> پنل مدیریت رایگان برای فروشندگان</li>
        </ul>
      </div>
    </div>
  );
}
