"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, Eye, Heart, LoaderCircle, Receipt, Star, Ticket, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { faNumber } from "@/lib/format";

interface Point {
  date: string;
  views: number;
  engagement: number;
}

interface OwnerStats {
  period_days: number;
  total_views: number;
  views_period: number;
  views_change: number | null;
  total_engagements: number;
  engagements_change: number | null;
  campaign_uses: number;
  campaign_redeemed: number;
  average_rating: number;
  review_count: number;
  followers_count: number;
  transactions_period: number;
  sales_today: number | string;
  sales_period: number | string;
  series: Point[];
}

const PERIODS = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۹۰ روز" },
];

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-500">بدون داده‌ی دوره‌ی قبل</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? "text-brand-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {faNumber(Math.abs(value))}٪ نسبت به دوره‌ی قبل
    </span>
  );
}

export default function OwnerAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    api
      .get<OwnerStats>("/directory/owner/analytics/", { params: { days } })
      .then(({ data }) => setStats(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [days]);

  const fmtDate = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });
  const chart = (stats?.series ?? []).map((p) => ({ ...p, name: fmtDate.format(new Date(p.date)) }));
  const hasActivity = chart.some((p) => p.views || p.engagement);

  const cards = stats
    ? [
        { label: `بازدید ${PERIODS.find((p) => p.days === days)?.label} اخیر`, value: faNumber(stats.views_period), icon: Eye, color: "bg-brand-50 text-brand-600", extra: <Change value={stats.views_change} /> },
        { label: "تعاملات (نظر، کد، خرید)", value: faNumber(stats.total_engagements), icon: TrendingUp, color: "bg-brand-50 text-brand-600", extra: <Change value={stats.engagements_change} /> },
        { label: "کدهای تخفیف دریافت‌شده", value: faNumber(stats.campaign_uses), icon: Ticket, color: "bg-saffron-50 text-saffron-700", extra: <span className="text-xs text-gray-500">{faNumber(stats.campaign_redeemed)} مورد استفاده شده</span> },
        { label: "میانگین امتیاز", value: faNumber(stats.average_rating), icon: Star, color: "bg-brand-50 text-brand-600", extra: <span className="text-xs text-gray-500">از {faNumber(stats.review_count)} نظر</span> },
        { label: "فروش ثبت‌شده در دوره", value: `${faNumber(stats.sales_period)} تومان`, icon: Receipt, color: "bg-emerald-50 text-emerald-700", extra: <span className="text-xs text-gray-500">امروز: {faNumber(stats.sales_today)} تومان · {faNumber(stats.transactions_period)} تراکنش</span> },
        { label: "دنبال‌کنندگان", value: faNumber(stats.followers_count), icon: Heart, color: "bg-rose-50 text-rose-500", extra: <span className="text-xs text-gray-500">کل بازدیدها: {faNumber(stats.total_views)}</span> },
      ]
    : [];

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">آمار و گزارشات بازدید</h1>
          <p className="mt-1 text-sm text-gray-500">آمار واقعی همه‌ی کسب‌وکارهای شما؛ بازدید صفحه، نظرها، دریافت کد تخفیف و خریدها.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="بازه‌ی زمانی">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                role="tab"
                aria-selected={days === p.days}
                onClick={() => setDays(p.days)}
                className={`min-h-9 rounded-lg px-4 text-sm font-bold transition ${days === p.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Link href="/dashboard/owner" className="text-sm font-bold text-brand-600 hover:underline">بازگشت</Link>
        </div>
      </header>

      {isLoading && !stats ? (
        <div className="flex justify-center py-24 text-gray-500"><LoaderCircle className="h-7 w-7 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center text-sm font-medium text-rose-600">
          دریافت آمار با خطا مواجه شد. دوباره تلاش کنید.
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            {cards.map(({ label, value, icon: Icon, color, extra }) => (
              <div key={label} className="flex items-start justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500">{label}</p>
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                  {extra}
                </div>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-6 w-6" />
                </span>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-900">
              روند بازدید و تعامل {days === 90 ? "(هفتگی)" : "(روزانه)"}
            </h2>
            {hasActivity ? (
              <div className="h-80 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3f6e9c" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3f6e9c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#da7f37" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#da7f37" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", direction: "rtl" }} />
                    <Area type="monotone" dataKey="views" name="بازدید" stroke="#153a5f" strokeWidth={2.5} fill="url(#gViews)" />
                    <Area type="monotone" dataKey="engagement" name="تعامل" stroke="#da7f37" strokeWidth={2.5} fill="url(#gEng)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center text-gray-400">
                <BarChart3 className="h-12 w-12 text-gray-300" />
                <p className="px-6 text-sm font-medium">در این بازه هنوز بازدید یا تعاملی ثبت نشده است.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
