"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, SearchCheck, Settings2, ListChecks } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { EmptyState, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, toFaDigits } from "@/lib/club";
import PageEditor, { ScoreBadge } from "@/components/admin/seo/PageEditor";
import SeoSettingsForm from "@/components/admin/seo/SeoSettingsForm";

type Tab = "pages" | "settings";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "pages", label: "صفحه‌ها", icon: ListChecks },
  { id: "settings", label: "تنظیمات کلی", icon: Settings2 },
];

const TYPES = [
  { id: "all", label: "همه" },
  { id: "static", label: "ثابت" },
  { id: "business", label: "کسب‌وکارها" },
  { id: "category", label: "دسته‌ها" },
  { id: "location", label: "محله‌ها" },
];
const STATUSES = [
  { id: "", label: "همه‌ی وضعیت‌ها" },
  { id: "bad", label: "ضعیف" },
  { id: "warn", label: "نیازمند بهبود" },
  { id: "good", label: "خوب" },
  { id: "noindex", label: "noindex" },
  { id: "customized", label: "ویرایش‌شده" },
];
const TYPE_LABEL: Record<string, string> = { static: "ثابت", business: "کسب‌وکار", category: "دسته", location: "محله" };
const PAGE_SIZE = 20;

type Row = { type: string; key: string; label: string; path: string; title: string; description: string; score: number | null; status: string; customized: boolean };
type Summary = { total: number; avg_score: number | null; good: number; warn: number; bad: number; noindex: number; customized: number };

/** سئوی سایت (فقط ادمین): نمره، ویرایش و پیش‌نمایش گوگل */
export default function AdminSeoPage() {
  const [tab, setTab] = useState<Tab>("pages");

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div>
        <p className="text-xs font-bold text-saffron-700">مدیریت سایت</p>
        <h1 className="mt-1 text-2xl font-black text-brand-900">سئو</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "pages" && <PagesTab />}
      {tab === "settings" && <SeoSettingsForm />}
    </div>
  );
}

function PagesTab() {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ type: string; key: string; label: string } | null>(null);

  // جستجو با کمی تأخیر
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const d = (await api.get("/seo/admin/pages/", { params: { type, status, q: query, page, page_size: PAGE_SIZE } })).data;
      setRows(d.results || []); setCount(d.count || 0); setSummary(d.summary || null);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, [type, status, query, page]);

  useEffect(() => { load(); }, [load]);

  const avgTone = summary?.avg_score == null ? "brand" : summary.avg_score >= 80 ? "emerald" : summary.avg_score >= 50 ? "saffron" : "rose";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="میانگین نمره‌ی سئو" value={summary?.avg_score == null ? "—" : toFaDigits(summary.avg_score)} sub={summary ? `${toFaDigits(summary.total)} صفحه` : undefined} icon={SearchCheck} tone={avgTone} />
        <StatCard label="خوب" value={toFaDigits(summary?.good ?? 0)} icon={SearchCheck} tone="emerald" />
        <StatCard label="نیازمند بهبود" value={toFaDigits(summary?.warn ?? 0)} icon={SearchCheck} tone="saffron" />
        <StatCard label="ضعیف" value={toFaDigits(summary?.bad ?? 0)} icon={SearchCheck} tone="rose" />
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="نوع صفحه">
          {TYPES.map((t) => (
            <button key={t.id} role="tab" aria-selected={type === t.id} onClick={() => { setType(t.id); setPage(1); }}
              className={`min-h-10 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${type === t.id ? "bg-brand-50 text-brand-800" : "text-gray-500 hover:text-brand-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <label className="relative block">
            <span className="sr-only">جستجوی صفحه</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا آدرس صفحه…" className={`${inputCls} pr-9`} />
          </label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="فیلتر وضعیت" className={`${inputCls} cursor-pointer`}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title="صفحه‌ای پیدا نشد" text="فیلتر یا جستجو را تغییر دهید." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={`${r.type}:${r.key}`}>
                <button onClick={() => setEditing({ type: r.type, key: r.key, label: r.label })}
                  className="flex min-h-[72px] w-full items-center justify-between gap-3 p-4 text-right hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-black text-gray-900">{r.label}</span>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{TYPE_LABEL[r.type]}</span>
                      {r.customized && <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">ویرایش‌شده</span>}
                    </span>
                    <span dir="ltr" className="mt-0.5 block truncate text-left text-[11px] text-gray-400">{decodeURIComponent(r.path)}</span>
                    <span className="mt-1 block truncate text-xs text-gray-600">{r.title}</span>
                  </span>
                  <ScoreBadge score={r.score} status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination page={page} count={count} pageSize={PAGE_SIZE} onChange={setPage} />

      <PageEditor target={editing} onClose={() => setEditing(null)} onChanged={load} />
    </div>
  );
}
