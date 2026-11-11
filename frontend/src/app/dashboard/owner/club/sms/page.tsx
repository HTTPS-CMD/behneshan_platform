"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CreditCard, History, Loader2, Megaphone, MessageSquareText, Send, Settings2, Wallet, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import AudienceFilters, { Audience } from "@/components/club/AudienceFilters";
import { Btn, EmptyState, Field, Notice, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, toFaDigits } from "@/lib/club";

type Tab = "send" | "campaigns" | "auto" | "log";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "send", label: "ارسال انبوه", icon: Megaphone },
  { id: "campaigns", label: "کمپین‌ها", icon: Send },
  { id: "auto", label: "پیامک خودکار", icon: Settings2 },
  { id: "log", label: "گزارش ارسال", icon: History },
];

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-saffron-50 text-saffron-800", SENDING: "bg-sky-50 text-sky-700", DONE: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700", CANCELLED: "bg-gray-100 text-gray-500", APPROVED: "bg-emerald-50 text-emerald-700",
  QUEUED: "bg-saffron-50 text-saffron-800", SENT: "bg-emerald-50 text-emerald-700", FAILED: "bg-rose-50 text-rose-700",
};
const Badge = ({ s, label }: { s: string; label: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[s] || "bg-gray-100 text-gray-600"}`}>{label}</span>
);

export default function SmsPage() {
  const [tab, setTab] = useState<Tab>("send");
  const [overview, setOverview] = useState<any>(null);

  const loadOverview = useCallback(async () => {
    try { setOverview((await api.get("/loyalty/owner/sms/overview/")).data); } catch (e) { toast.error(apiError(e)); }
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader title="سامانه پیامکی" subtitle="ارسال پیامک به مشتریان فروشگاه، پیامک خودکار بعد از خرید و هدیه‌ها" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="موجودی کیف‌پول فروشنده" value={fmtMoney(overview?.balance)} sub="تومان" icon={Wallet} tone="saffron" />
        <StatCard label="قیمت هر بخش پیامک" value={fmtMoney(overview?.price_per_part)} sub="تومان" icon={CreditCard} />
        <StatCard label="ارسال‌شده (۳۰ روز)" value={toFaDigits(overview?.stats_30d?.sent ?? 0)} icon={Send} tone="emerald" />
        <StatCard label="ناموفق / در صف" value={`${toFaDigits(overview?.stats_30d?.failed ?? 0)} / ${toFaDigits(overview?.stats_30d?.queued ?? 0)}`} icon={History} tone="rose" />
      </div>
      <Link href="/dashboard/owner/club/wallet" className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-saffron-200 bg-saffron-50 px-4 py-2 text-sm font-bold text-saffron-800 hover:bg-saffron-100">
        <span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> شارژ کیف‌پول، گردش حساب و برداشت درآمد</span>
        <span aria-hidden>←</span>
      </Link>
      {overview?.provider === "console" && (
        <Notice tone="warn">سرویس پیامک در حالت آزمایشی (console) است؛ پیامک‌ها واقعاً ارسال نمی‌شوند و فقط در ترمینال بک‌اند چاپ می‌شوند.</Notice>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-colors ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "send" && <SendTab overview={overview} onSent={() => { loadOverview(); setTab("campaigns"); }} />}
      {tab === "campaigns" && <CampaignsTab onChange={loadOverview} />}
      {tab === "auto" && overview && <AutoTab overview={overview} onSaved={loadOverview} />}
      {tab === "log" && <LogTab />}
    </div>
  );
}

/* ------------------------------------------------------------ ارسال انبوه */
function SendTab({ overview, onSent }: { overview: any; onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<Audience>({});
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [segments, setSegments] = useState<{ key: string; label: string }[]>([]);

  // ورود از «دیتای هوشمند» با ?segment=...
  useEffect(() => {
    const seg = new URLSearchParams(window.location.search).get("segment");
    if (seg) setFilters((f) => ({ ...f, segment: seg }));
    api.get("/loyalty/owner/segments/")
      .then((r) => setSegments(r.data.map((s: any) => ({ key: s.key, label: `${s.label} (${Number(s.count).toLocaleString("fa-IR")})` }))))
      .catch(() => {});
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await api.post("/loyalty/owner/sms/preview/", { text, filters });
        if (id === reqId.current) setQuote(res.data);
      } catch { /* بی‌صدا */ }
    }, 400);
  }, [text, filters]);

  const submit = async () => {
    if (!quote?.recipients) return toast.error("هیچ گیرنده‌ای انتخاب نشده.");
    if (quote.cost > quote.balance) return toast.error("موجودی کیف‌پول فروشنده کافی نیست. از بخش «کیف‌پول» شارژ کنید.");
    if (!window.confirm(`ارسال به ${quote.recipients.toLocaleString("fa-IR")} مشتری با هزینه‌ی ${fmtMoney(quote.cost)} تومان؟`)) return;
    setBusy(true);
    try {
      await api.post("/loyalty/owner/sms/campaigns/", { title, text, filters });
      toast.success(quote.require_approval ? "کمپین ثبت شد و پس از تأیید مدیریت ارسال می‌شود." : "ارسال شروع شد.");
      setTitle(""); setText(""); setFilters({});
      onSent();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <h3 className="mb-3 font-black text-brand-900">۱. مخاطبان</h3>
          <AudienceFilters value={filters} onChange={setFilters} segments={segments} />
          <p className="mt-2 text-xs text-gray-500">فقط به مشتریان فروشگاه خودتان ارسال می‌شود و مشتریانی که «لغو» کرده‌اند حذف می‌شوند.</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-black text-brand-900">۲. متن پیامک</h3>
          <Field label="عنوان کمپین (فقط برای خودتان)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
          <Field label="متن" hint={`«${overview?.opt_out_text || "لغو۱۱"}» خودکار به انتهای پیامک اضافه می‌شود.`}>
            <textarea className={`${inputCls} h-36 py-2 leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} maxLength={600}
              placeholder="مثلاً: جشنواره‌ی پاییزه‌ی فروشگاه ما شروع شد! تا آخر هفته ۲۰٪ تخفیف روی همه‌ی محصولات." />
          </Field>
        </div>
      </section>

      <aside className="h-fit space-y-3 rounded-3xl bg-brand-900 p-5 text-brand-100 lg:sticky lg:top-24">
        <p className="flex items-center gap-2 font-black text-white"><MessageSquareText className="h-4 w-4 text-saffron-300" /> پیش‌نمایش</p>
        <div className="whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm leading-relaxed text-gray-800 min-h-20">{quote?.final_text || "…"}</div>
        <Row label="تعداد گیرنده" value={toFaDigits(quote?.recipients ?? 0)} />
        <Row label="نویسه / بخش" value={`${toFaDigits(quote?.chars ?? 0)} / ${toFaDigits(quote?.parts ?? 0)}`} />
        <div className="border-t border-brand-700 pt-3">
          <p className="text-xs text-brand-300">هزینه‌ی کل</p>
          <p className="text-2xl font-black text-saffron-300">{fmtMoney(quote?.cost)} <span className="text-xs font-normal text-brand-300">تومان</span></p>
          <p className="mt-1 text-[11px] text-brand-300">موجودی: {fmtMoney(quote?.balance)} تومان</p>
        </div>
        {quote?.require_approval && <p className="text-[11px] leading-relaxed text-brand-300">کمپین بعد از تأیید مدیریت ارسال می‌شود. هزینه همین حالا رزرو و در صورت رد، کامل برگشت داده می‌شود.</p>}
        <Btn variant="accent" className="w-full" onClick={submit} loading={busy} disabled={!quote?.recipients || (text || "").trim().length < 5}>
          <Send className="h-4 w-4" /> ثبت و ارسال
        </Btn>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-brand-300">{label}</span><span className="font-bold text-white">{value}</span></div>;
}

/* ------------------------------------------------------------ کمپین‌ها */
function CampaignsTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/loyalty/owner/sms/campaigns/", { params: { page } });
      setItems(res.data.results); setCount(res.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (c: any) => {
    if (!window.confirm(`کمپین «${c.title}» لغو و هزینه‌اش برگشت داده شود؟`)) return;
    try { await api.post(`/loyalty/owner/sms/campaigns/${c.id}/cancel/`); load(); onChange(); } catch (e) { toast.error(apiError(e)); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>;
  if (!items.length) return <EmptyState icon={Send} title="هنوز کمپینی ارسال نکرده‌اید" />;
  return (
    <>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-gray-900">{c.title}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{c.text}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {toFaDigits(c.created_jalali)} · {toFaDigits(c.recipients_count)} گیرنده · {toFaDigits(c.parts)} بخش · هزینه {fmtMoney(c.cost)} تومان
                </p>
                {c.status !== "PENDING" && c.status !== "REJECTED" && c.status !== "CANCELLED" && (
                  <p className="mt-1 text-xs text-gray-500">ارسال‌شده {toFaDigits(c.sent_count)} · ناموفق {toFaDigits(c.failed_count)}{c.queued_count ? ` · در صف ${toFaDigits(c.queued_count)}` : ""}</p>
                )}
                {c.admin_note && <p className="mt-1 text-xs font-bold text-rose-700">یادداشت مدیریت: {c.admin_note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge s={c.status} label={c.status_display} />
                {c.status === "PENDING" && (
                  <button onClick={() => cancel(c)} aria-label="لغو کمپین" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"><XCircle className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={page} count={count} pageSize={20} onChange={setPage} />
    </>
  );
}

/* ------------------------------------------------------------ پیامک خودکار */
function AutoTab({ overview, onSaved }: { overview: any; onSaved: () => void }) {
  const [form, setForm] = useState(overview.auto);
  const [sample, setSample] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setSample((await api.post("/loyalty/owner/sms/template-preview/", { template: form.purchase_sms_template })).data); } catch { /* */ }
    }, 400);
    return () => clearTimeout(t);
  }, [form.purchase_sms_template]);

  const save = async () => {
    setSaving(true);
    try { await api.put("/loyalty/owner/sms/overview/", form); toast.success("تنظیمات پیامک خودکار ذخیره شد."); onSaved(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-700" checked={form.purchase_sms_enabled}
          onChange={(e) => setForm({ ...form, purchase_sms_enabled: e.target.checked })} />
        <span>
          <span className="block font-black text-gray-900">پیامک بعد از هر خرید</span>
          <span className="block text-sm text-gray-500">بعد از ثبت تراکنش، مبلغ خرید، کش‌بک و موجودی اعتبار برای مشتری پیامک می‌شود (هر مشتری روزی حداکثر یک پیامک خرید).</span>
        </span>
      </label>
      <Field label="قالب پیامک خرید" hint={`متغیرها: ${overview.template_vars.slice(0, 5).map((v: string) => `{${v}}`).join("، ")} — هر بخش فروش می‌تواند قالب جداگانه داشته باشد (تب «شعب و تنظیمات»).`}>
        <textarea className={`${inputCls} h-28 py-2 leading-relaxed`} value={form.purchase_sms_template} maxLength={400}
          onChange={(e) => setForm({ ...form, purchase_sms_template: e.target.value })} />
      </Field>
      {sample && (
        <div className="rounded-2xl bg-cream p-3 text-sm">
          <p className="mb-1 text-xs font-bold text-gray-500">نمونه ({toFaDigits(sample.parts)} بخش · {fmtMoney(sample.cost)} تومان):</p>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{sample.text}</p>
        </div>
      )}
      <label className="flex min-h-11 items-start gap-3 border-t border-gray-100 pt-5">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-700" checked={form.incentive_sms_enabled}
          onChange={(e) => setForm({ ...form, incentive_sms_enabled: e.target.checked })} />
        <span>
          <span className="block font-black text-gray-900">پیامک هدیه‌های طرح‌های تشویقی</span>
          <span className="block text-sm text-gray-500">وقتی هدیه‌ی تولد، سالگرد یا بازگشت صادر می‌شود، «متن پیام» همان طرح برای مشتری پیامک می‌شود. متغیرهای {"{هدیه}"} و {"{اعتبار_تا}"} هم قابل استفاده‌اند.</span>
        </span>
      </label>
      <Notice>هزینه‌ی پیامک‌های خودکار از کیف‌پول فروشنده کم می‌شود؛ اگر موجودی کافی نباشد، پیامک ارسال نمی‌شود (ثبت خرید و هدیه بدون مشکل انجام می‌شود).</Notice>
      <div className="flex justify-end"><Btn onClick={save} loading={saving}>ذخیره</Btn></div>
    </section>
  );
}

/* ------------------------------------------------------------ گزارش ارسال */
function LogTab() {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/loyalty/owner/sms/messages/", { params: { page, status: status || undefined, kind: kind || undefined } });
      setItems(res.data.results); setCount(res.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [page, status, kind]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-gray-50 p-4">
        <select className={`${inputCls} w-auto`} value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} aria-label="نوع پیامک">
          <option value="">همه‌ی انواع</option><option value="BULK">انبوه</option><option value="PURCHASE">بعد از خرید</option><option value="INCENTIVE">طرح تشویقی</option><option value="COOP">همکاری با فروشگاه دیگر</option>
        </select>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="وضعیت">
          <option value="">همه‌ی وضعیت‌ها</option><option value="SENT">ارسال‌شده</option><option value="QUEUED">در صف</option><option value="FAILED">ناموفق</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={History} title="پیامکی ثبت نشده" />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800">{m.customer_name || "—"} <span dir="ltr" className="text-xs font-normal text-gray-500">{m.phone}</span></p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-gray-600">{m.text}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{toFaDigits(m.created_jalali)} · {m.kind_display} · {toFaDigits(m.parts)} بخش · {m.kind === "COOP" ? "هزینه با فروشگاه درخواست‌دهنده" : `${fmtMoney(m.cost)} تومان`}{m.error ? ` · ${m.error}` : ""}</p>
                  </div>
                  <Badge s={m.status} label={m.status_display} />
                </li>
              ))}
            </ul>
          )}
      <div className="pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}

