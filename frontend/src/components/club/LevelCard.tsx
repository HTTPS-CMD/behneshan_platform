"use client";

import { Award, Crown, Gem, Medal } from "lucide-react";
import { toFaDigits } from "@/lib/club";

export const LEVEL_STYLE: Record<string, { icon: React.ElementType; chip: string; ring: string; bar: string }> = {
  BRONZE: { icon: Medal, chip: "bg-orange-50 text-orange-800 border-orange-200", ring: "from-orange-100 to-white", bar: "bg-orange-400" },
  SILVER: { icon: Award, chip: "bg-gray-100 text-gray-700 border-gray-300", ring: "from-gray-100 to-white", bar: "bg-gray-400" },
  GOLD: { icon: Crown, chip: "bg-saffron-50 text-saffron-800 border-saffron-300", ring: "from-saffron-100 to-white", bar: "bg-saffron-500" },
  DIAMOND: { icon: Gem, chip: "bg-sky-50 text-sky-800 border-sky-200", ring: "from-sky-100 to-white", bar: "bg-sky-500" },
};

/** کارت سطح فروشگاه در «باشگاه پذیرندگان» */
export default function LevelCard({ level }: { level: any }) {
  if (!level) return null;
  const st = LEVEL_STYLE[level.level] || LEVEL_STYLE.BRONZE;
  const Icon = st.icon;
  const progress = level.next_score ? Math.min(100, Math.round((level.score / level.next_score) * 100)) : 100;

  return (
    <section className={`rounded-3xl border border-gray-100 bg-gradient-to-l ${st.ring} p-5 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${st.chip}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">سطح شما در باشگاه پذیرندگان</p>
            <p className="text-xl font-black text-brand-900">
              {level.label}
              {level.is_top && <span className="mr-2 rounded-full bg-saffron-500 px-2.5 py-0.5 align-middle text-[11px] font-black text-brand-950">دکان برتر</span>}
            </p>
            <p className="text-xs text-gray-600">امتیاز ۳۰ روز اخیر: <span className="font-bold">{toFaDigits(level.score)}</span> · کارمزد سایت از درآمد شما: <span className="font-bold">{toFaDigits(level.commission_percent)}٪</span></p>
          </div>
        </div>
        {level.next_level && (
          <div className="w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs text-gray-600">
              <span>تا سطح {level.next_label}</span>
              <span className="font-bold">{toFaDigits(level.score)} / {toFaDigits(level.next_score)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تا سطح بعد">
              <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(level.levels || []).map((l: any) => {
          const s = LEVEL_STYLE[l.level] || LEVEL_STYLE.BRONZE;
          const I = s.icon;
          const active = l.level === level.level;
          return (
            <div key={l.level} className={`rounded-2xl border p-3 text-xs ${active ? s.chip + " font-bold" : "border-gray-100 bg-white/70 text-gray-600"}`}>
              <p className="flex items-center gap-1.5 font-black"><I className="h-4 w-4" /> {l.label}</p>
              <p className="mt-1">از امتیاز {toFaDigits(l.min_score)}</p>
              <p>کارمزد {toFaDigits(l.commission)}٪</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-600">
        امتیاز = مشتریان متمایز خریدکرده + ۲ × خریدهای تأییدشده با کد خرید + ۵ × مشتری جذب‌شده یا معرفی‌شده از همکاری (۳۰ روز اخیر).
        سطح بالاتر یعنی کارمزد کمتر، اولویت در معرفی مشتری و نشان «دکان برتر» (طلایی و الماس) در صفحه‌ی عمومی فروشگاه.
      </p>
    </section>
  );
}
