"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Clock, Coins, Loader2, MessageSquareText, Repeat, ShoppingBag, Trophy, Users } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import { EmptyState, Notice, StatCard } from "@/components/club/ui";
import { apiError, fmtMoney, toFaDigits } from "@/lib/club";

const COLOR: Record<string, { card: string; dot: string; bar: string }> = {
  saffron: { card: "border-saffron-200 bg-saffron-50/60", dot: "bg-saffron-500", bar: "bg-saffron-500" },
  brand: { card: "border-brand-200 bg-brand-50/60", dot: "bg-brand-600", bar: "bg-brand-600" },
  emerald: { card: "border-emerald-200 bg-emerald-50/60", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  sky: { card: "border-sky-200 bg-sky-50/60", dot: "bg-sky-500", bar: "bg-sky-500" },
  rose: { card: "border-rose-200 bg-rose-50/60", dot: "bg-rose-500", bar: "bg-rose-500" },
  violet: { card: "border-violet-200 bg-violet-50/60", dot: "bg-violet-500", bar: "bg-violet-500" },
  slate: { card: "border-gray-200 bg-gray-50", dot: "bg-gray-400", bar: "bg-gray-400" },
};
const DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/loyalty/owner/insights/").then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e, "دریافت تحلیل‌ها ناموفق بود.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-9 w-9 animate-spin text-brand-500" /></div>;

  const k = data?.kpis;
  const maxHeat = Math.max(1, ...(data?.heatmap || []).flat());
  const hasData = k && k.buyers > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader title="دیتای هوشمند" subtitle="بخش‌بندی مشتریان بر اساس رفتار خرید (RFM) و پیشنهاد اقدام برای هر گروه" />

      {!hasData ? (
        <EmptyState icon={Activity} title="هنوز داده‌ی کافی نیست" text="بعد از ثبت چند خرید در «تراکنش‌ها»، مشتریان شما خودکار بخش‌بندی می‌شوند." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="مشتریان خریدکرده" value={toFaDigits(k.buyers)} sub={`از ${toFaDigits(k.customers)} مشتری`} icon={Users} />
            <StatCard label="نرخ خرید تکراری" value={`${toFaDigits(k.repeat_rate)}٪`} sub="بیش از یک خرید" icon={Repeat} tone="emerald" />
            <StatCard label="میانگین هر فاکتور" value={fmtMoney(k.avg_basket)} sub="تومان" icon={ShoppingBag} tone="saffron" />
            <StatCard label="فاصله‌ی میانگین خریدها" value={k.avg_interval_days != null ? `${toFaDigits(k.avg_interval_days)} روز` : "—"} sub={`فعال در ۹۰ روز: ${toFaDigits(k.active_90d)}`} icon={Clock} tone="rose" />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-black text-brand-900">گروه‌های مشتریان</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.segments.map((s: any) => {
                const c = COLOR[s.color] || COLOR.slate;
                return (
                  <article key={s.key} className={`flex flex-col rounded-3xl border p-4 ${c.card}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-black text-gray-900"><span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />{s.label}</h3>
                      <span className="text-2xl font-black text-gray-900">{toFaDigits(s.count)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{s.description}</p>
                    <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                      <div className="flex justify-between"><span>سهم از مشتریان</span><span className="font-bold">{toFaDigits(s.share)}٪</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, s.share)}%` }} /></div>
                      <div className="flex justify-between"><span>سهم از فروش</span><span className="font-bold">{toFaDigits(s.revenue_share)}٪</span></div>
                      {s.count > 0 && <div className="flex justify-between"><span>میانگین خرید هر نفر</span><span className="font-bold">{fmtMoney(s.avg_spend)}</span></div>}
                    </div>
                    <p className="mt-3 rounded-2xl bg-white/80 p-2.5 text-xs leading-relaxed text-gray-700"><span className="font-bold text-brand-800">پیشنهاد: </span>{s.action}</p>
                    {s.count > 0 && (
                      <div className="mt-3 flex gap-2">
                        <Link href={`/dashboard/owner/club/customers?segment=${s.key}`} className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:border-brand-300">
                          مشاهده‌ی مشتریان
                        </Link>
                        <Link href={`/dashboard/owner/club/sms?segment=${s.key}`} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-700 text-xs font-bold text-white hover:bg-brand-800">
                            <MessageSquareText className="h-3.5 w-3.5" /> پیامک به این گروه
                          </Link>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 font-black text-brand-900"><Activity className="h-5 w-5 text-saffron-600" /> زمان‌های پرفروش (۹۰ روز اخیر)</h2>
              <p className="mb-4 text-xs text-gray-500">هر خانه تعداد خرید در آن روز و ساعت است؛ پررنگ‌تر یعنی شلوغ‌تر. برای زمان ارسال پیامک و برنامه‌ریزی نیرو کمک می‌کند.</p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
                  <thead>
                    <tr>
                      <th />
                      {Array.from({ length: 24 }, (_, h) => (
                        <th key={h} className="text-[9px] font-normal text-gray-500">{h % 3 === 0 ? toFaDigits(h) : ""}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.heatmap.map((row: number[], d: number) => (
                      <tr key={d}>
                        <th className="whitespace-nowrap pl-2 text-right text-[11px] font-bold text-gray-600">{DAYS[d]}</th>
                        {row.map((n, h) => (
                          <td key={h} title={`${DAYS[d]} ساعت ${h}: ${n} خرید`}
                            className="h-5 min-w-3 rounded-[3px]"
                            style={{ backgroundColor: n ? `rgba(218,127,55,${0.15 + 0.85 * (n / maxHeat)})` : "#f3f4f6" }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-black text-brand-900"><Trophy className="h-5 w-5 text-saffron-600" /> ۱۰ مشتری برتر</h2>
              <ol className="space-y-2">
                {data.top_customers.map((c: any, i: number) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-900 text-[11px] font-black text-white">{toFaDigits(i + 1)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-gray-800">{c.name || c.phone}</span>
                        <span className="block text-[11px] text-gray-500">{c.segment} · {toFaDigits(c.purchases)} خرید</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-black text-saffron-700">{fmtMoney(c.total)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <Notice>
            <span className="font-bold">بخش‌بندی چطور انجام می‌شود؟ </span>
            هر مشتری سه امتیاز ۱ تا ۵ می‌گیرد: تازگی آخرین خرید (R)، تعداد خرید (F) و مبلغ خرید نسبت به بقیه‌ی مشتریان شما (M).
            گروه‌ها از ترکیب این سه امتیاز ساخته می‌شوند و با هر خرید جدید به‌روز می‌شوند. فقط داده‌های مشتریان فروشگاه خودتان استفاده می‌شود.
          </Notice>
        </>
      )}
      {k && <p className="text-center text-xs text-gray-500"><Coins className="ml-1 inline h-3.5 w-3.5" />جمع فروش ثبت‌شده: {fmtMoney(k.revenue)} تومان</p>}
    </div>
  );
}
