"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check, Handshake, Inbox, Loader2, MapPin, Search, Send, Settings2, Store, Ticket, UserPlus, Wallet, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import LevelCard, { LEVEL_STYLE } from "@/components/club/LevelCard";
import { Btn, EmptyState, Field, Notice, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, parseAmount, toFaDigits } from "@/lib/club";

type Tab = "settings" | "vouchers" | "coop";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "settings", label: "تنظیمات و سطح", icon: Settings2 },
  { id: "vouchers", label: "کوپن‌های همکاری", icon: Ticket },
  { id: "coop", label: "همکاری دستی", icon: Handshake },
];

const TONE: Record<string, string> = {
  ISSUED: "bg-sky-50 text-sky-700", USED: "bg-emerald-50 text-emerald-700", EXPIRED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-600", PENDING_PARTNER: "bg-saffron-50 text-saffron-800", PENDING_ADMIN: "bg-saffron-50 text-saffron-800",
  SENDING: "bg-sky-50 text-sky-700", DONE: "bg-emerald-50 text-emerald-700", PARTNER_REJECTED: "bg-rose-50 text-rose-700",
  REJECTED: "bg-rose-50 text-rose-700",
};
const Badge = ({ s, label }: { s: string; label: string }) => (
  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[s] || "bg-gray-100 text-gray-600"}`}>{label}</span>
);

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-gray-300"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "-translate-x-6" : "-translate-x-1"}`} />
    </button>
  );
}

/** اشتراک‌گذاری مشتری (ShareClub) و همکاری با فروشگاه‌های دیگر */
export default function SharePage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData((await api.get("/loyalty/owner/share/overview/")).data); } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-9 w-9 animate-spin text-brand-500" /></div>;
  const st = data?.stats || {};

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader title="اشتراک‌گذاری مشتری" subtitle="مشتریانتان را به فروشگاه‌های مکمل معرفی کنید و درآمد بگیرید؛ یا از آن‌ها مشتری جدید بپذیرید" />

      {data && !data.enabled && <Notice tone="warn">اشتراک‌گذاری فعلاً توسط مدیریت سایت غیرفعال شده است.</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="مشتریان معرفی‌شده‌ی من" value={toFaDigits(st.out_used ?? 0)} sub={`از ${toFaDigits(st.out_issued ?? 0)} کوپن صادرشده`} icon={Send} />
        <StatCard label="درآمد معرفی و همکاری" value={fmtMoney((st.out_income || 0) + (st.coop_income || 0))} sub="تومان (کل)" icon={Wallet} tone="emerald" />
        <StatCard label="مشتری جدید جذب‌شده" value={toFaDigits(st.in_used ?? 0)} sub={`${toFaDigits(st.in_active ?? 0)} کوپن فعال در دست مشتریان`} icon={UserPlus} tone="saffron" />
        <StatCard label="هزینه‌ی مشتری جدید" value={fmtMoney(st.in_fees)} sub="تومان (کل)" icon={Store} tone="rose" />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-colors ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
            {id === "coop" && st.pending_coop_in > 0 && (
              <span className="rounded-full bg-saffron-500 px-1.5 text-[10px] font-black text-brand-950">{toFaDigits(st.pending_coop_in)}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "settings" && data && <SettingsTab data={data} onSaved={load} />}
      {tab === "vouchers" && <VouchersTab />}
      {tab === "coop" && data && <CoopTab data={data} onChange={load} />}
    </div>
  );
}

/* ------------------------------------------------------------ تنظیمات */
function SettingsTab({ data, onSaved }: { data: any; onSaved: () => void }) {
  const p = data.profile;
  const lim = data.limits;
  const [form, setForm] = useState({
    send_enabled: p.send_enabled, receive_enabled: p.receive_enabled, coop_enabled: p.coop_enabled,
    discount_percent: String(p.discount_percent), max_discount: String(p.max_discount || ""),
    min_purchase: String(p.min_purchase || ""), valid_days: String(p.valid_days),
    fee_per_customer: String(p.fee_per_customer), coop_price: String(p.coop_price),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const fee = parseAmount(form.fee_per_customer);
    if (form.receive_enabled && (fee < lim.min_fee || fee > lim.max_fee)) {
      return toast.error(`هزینه‌ی هر مشتری جدید باید بین ${fmtMoney(lim.min_fee)} و ${fmtMoney(lim.max_fee)} تومان باشد.`);
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        send_enabled: form.send_enabled, receive_enabled: form.receive_enabled, coop_enabled: form.coop_enabled,
      };
      // فیلدهای هر بخش فقط وقتی همان بخش روشن است فرستاده می‌شوند
      if (form.receive_enabled) Object.assign(body, {
        discount_percent: parseAmount(form.discount_percent), max_discount: parseAmount(form.max_discount),
        min_purchase: parseAmount(form.min_purchase), valid_days: parseAmount(form.valid_days), fee_per_customer: fee,
      });
      if (form.coop_enabled) body.coop_price = parseAmount(form.coop_price);
      await api.put("/loyalty/owner/share/overview/", body);
      toast.success("تنظیمات اشتراک‌گذاری ذخیره شد.");
      onSaved();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const money = (k: keyof typeof form, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(String(form[k])) ? parseAmount(String(form[k])).toLocaleString("en-US") : ""}
        onChange={(e) => set(k, e.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-5">
      <LevelCard level={data.level} />
      {!data.is_verified && <Notice tone="warn">کسب‌وکار شما هنوز تأیید نشده است؛ بعد از تأیید مدیریت می‌توانید در اشتراک‌گذاری شرکت کنید.</Notice>}
      {!data.has_location && <Notice tone="warn">برای پیدا شدن فروشگاه‌های همکار نزدیک، در «ویرایش کسب‌وکار» محله و موقعیت روی نقشه را ثبت کنید.</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-black text-brand-900"><Send className="h-5 w-5 text-saffron-600" /> معرفی مشتریانم (کسب درآمد)</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                بعد از هر خرید، مشتری شما از حداکثر {toFaDigits(lim.vouchers_per_purchase)} فروشگاه نزدیک و غیرهم‌صنف کوپن تخفیف می‌گیرد.
                هر بار که با کوپن از آن‌ها خرید کند، «هزینه‌ی مشتری جدید» آن فروشگاه منهای کارمزد سایت ({toFaDigits(data.level?.commission_percent ?? 0)}٪) به درآمد قابل برداشت شما اضافه می‌شود.
                رقبای هم‌صنف هرگز به مشتریان شما معرفی نمی‌شوند و شماره‌ی مشتری تا خرید به کسی نشان داده نمی‌شود.
              </p>
            </div>
            <Switch checked={form.send_enabled} onChange={(v) => set("send_enabled", v)} label="معرفی مشتریان" />
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-black text-brand-900"><Handshake className="h-5 w-5 text-saffron-600" /> ارسال پیشنهاد همکاران به مشتریانم</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                فروشگاه‌های دیگر می‌توانند درخواست بدهند پیشنهادشان با پیامک برای مشتریان شما ارسال شود. هر درخواست باید اول توسط شما و بعد مدیریت تأیید شود.
                هزینه‌ی پیامک را درخواست‌دهنده می‌دهد و برای هر پیامک موفق سهم شما به درآمدتان اضافه می‌شود. شماره‌ها هرگز به درخواست‌دهنده داده نمی‌شود.
              </p>
            </div>
            <Switch checked={form.coop_enabled} onChange={(v) => set("coop_enabled", v)} label="پذیرش همکاری دستی" />
          </div>
          {form.coop_enabled && money("coop_price", "سهم من برای هر گیرنده (تومان)", `بین ${fmtMoney(lim.coop_min_price)} و ${fmtMoney(lim.coop_max_price)} تومان`)}
        </section>
      </div>

      <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-black text-brand-900"><UserPlus className="h-5 w-5 text-saffron-600" /> پذیرش مشتری جدید از فروشگاه‌های همکار</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              مشتریان فروشگاه‌های نزدیک (و غیرهم‌صنف) کوپن تخفیف شما را می‌گیرند. فقط وقتی کسی با کوپن واقعاً از شما خرید کند (با کد خرید تأیید شود)،
              «هزینه‌ی مشتری جدید» از کیف‌پول شما کم می‌شود. اگر موجودی کیف‌پول کمتر از این هزینه باشد، کوپن جدیدی برای شما صادر نمی‌شود.
              کسانی که از قبل مشتری شما هستند یا نزد شما تخفیف/اعتبار فعال دارند کوپن نمی‌گیرند.
            </p>
          </div>
          <Switch checked={form.receive_enabled} onChange={(v) => set("receive_enabled", v)} label="پذیرش مشتری جدید" />
        </div>
        {form.receive_enabled && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="درصد تخفیف کوپن *" hint="۱ تا ۷۰ درصد">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} />
              </Field>
              {money("max_discount", "سقف تخفیف (تومان)", "خالی = بدون سقف")}
              {money("min_purchase", "حداقل مبلغ خرید (تومان)", "خالی = بدون حداقل")}
              <Field label="مدت اعتبار کوپن (روز) *" hint="۳ تا ۱۸۰ روز">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={form.valid_days} onChange={(e) => set("valid_days", e.target.value)} />
              </Field>
              {money("fee_per_customer", "هزینه‌ی هر مشتری جدید (تومان) *", `بین ${fmtMoney(lim.min_fee)} و ${fmtMoney(lim.max_fee)} · پیشنهادی ${fmtMoney(lim.default_fee)}`)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream p-3 text-xs text-brand-900">
              <span>موجودی کیف‌پول شما: <span className="font-black">{fmtMoney(data.wallet?.balance)}</span> تومان</span>
              <Link href="/dashboard/owner/club/wallet" className="font-bold text-saffron-800 underline underline-offset-4">شارژ کیف‌پول</Link>
            </div>
          </>
        )}
      </section>

      <div className="flex justify-end">
        <Btn onClick={save} loading={saving} className="min-w-40">ذخیره‌ی تنظیمات</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ کوپن‌ها */
function VouchersTab() {
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/loyalty/owner/share/vouchers/", { params: { direction, page, status: status || undefined } })
      .then((r) => { setItems(r.data.results); setCount(r.data.count); })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [direction, page, status]);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 p-4">
        <div className="flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="نوع کوپن">
          {([["out", "معرفی‌های من"], ["in", "کوپن‌های فروشگاه من"]] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={direction === v} onClick={() => { setPage(1); setDirection(v); }}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold ${direction === v ? "bg-white text-brand-800 shadow-sm" : "text-gray-600"}`}>{l}</button>
          ))}
        </div>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="وضعیت">
          <option value="">همه‌ی وضعیت‌ها</option><option value="ISSUED">فعال</option><option value="USED">استفاده‌شده</option><option value="EXPIRED">منقضی</option>
        </select>
      </div>
      {direction === "in" && (
        <p className="border-b border-gray-50 bg-brand-50/50 px-4 py-2 text-xs text-brand-800">
          شماره‌ی مشتریان تا وقتی با کوپن از شما خرید نکرده‌اند نمایش داده نمی‌شود. مشتری کوپن‌دار را با «کد خرید» در فرم ثبت خرید تأیید کنید تا تخفیف کوپن خودکار اعمال شود.
        </p>
      )}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={Ticket} title="کوپنی ثبت نشده" text={direction === "out" ? "با فعال کردن «معرفی مشتریانم»، بعد از هر خرید برای مشتری کوپن فروشگاه‌های همکار صادر می‌شود." : "با فعال کردن «پذیرش مشتری جدید»، مشتریان فروشگاه‌های نزدیک کوپن شما را می‌گیرند."} />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">
                      {direction === "out" ? <>به «{v.target_name}»</> : <>از «{v.origin_name}»</>}
                      <span className="mr-2 text-xs font-normal text-gray-500" dir="ltr">{v.customer?.phone || v.phone_masked}</span>
                      {v.customer?.name && <span className="mr-1 text-xs text-gray-600">({v.customer.name})</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {toFaDigits(v.discount_percent)}٪ تخفیف · صدور {toFaDigits(v.created_jalali)}{v.used_jalali ? ` · خرید ${toFaDigits(v.used_jalali)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.status === "USED" && (
                      direction === "out"
                        ? <span className="font-black text-emerald-600">+{fmtMoney(v.origin_income)}</span>
                        : <span className="font-black text-rose-600">−{fmtMoney(v.fee)}</span>
                    )}
                    <Badge s={v.status} label={v.status_display} />
                  </div>
                </li>
              ))}
            </ul>
          )}
      <div className="px-4 pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}

/* ------------------------------------------------------------ همکاری دستی */
function CoopTab({ data, onChange }: { data: any; onChange: () => void }) {
  const [view, setView] = useState<"new" | "in" | "out">(data.stats?.pending_coop_in ? "in" : "new");
  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="همکاری دستی">
        {([["new", "درخواست جدید"], ["in", "درخواست‌های رسیده"], ["out", "درخواست‌های من"]] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-bold ${view === v ? "bg-white text-brand-800 shadow-sm" : "text-gray-600"}`}>{l}</button>
        ))}
      </div>
      {view === "new" && <NewCoop onCreated={() => { onChange(); setView("out"); }} />}
      {view === "in" && <CoopList direction="in" onChange={onChange} />}
      {view === "out" && <CoopList direction="out" onChange={onChange} />}
    </div>
  );
}

function NewCoop({ onCreated }: { onCreated: () => void }) {
  const [q, setQ] = useState("");
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [maxR, setMaxR] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get("/loyalty/owner/share/partners/", { params: { q: q || undefined } })
        .then((r) => setPartners(r.data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!partner || text.trim().length < 3) { setQuote(null); return; }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api.post("/loyalty/owner/share/coop-quote/", { partner: partner.id, text, max_recipients: parseAmount(maxR) || undefined })
        .then((r) => { if (id === reqId.current) setQuote(r.data); })
        .catch((e) => { if (id === reqId.current) { setQuote(null); toast.error(apiError(e)); } });
    }, 400);
    return () => clearTimeout(t);
  }, [partner, text, maxR]);

  const submit = async () => {
    if (!partner) return toast.error("فروشگاه همکار را انتخاب کنید.");
    if (text.trim().length < 10) return toast.error("متن پیشنهاد را کامل‌تر بنویسید.");
    if (quote && quote.cost > quote.balance) return toast.error("موجودی کیف‌پول کافی نیست. از بخش «کیف‌پول» شارژ کنید.");
    setBusy(true);
    try {
      await api.post("/loyalty/owner/share/coops/", { partner: partner.id, title, text, max_recipients: parseAmount(maxR) || undefined });
      toast.success("درخواست ثبت شد و هزینه رزرو شد. بعد از پذیرش فروشگاه همکار و تأیید مدیریت ارسال می‌شود.");
      setPartner(null); setText(""); setTitle(""); setMaxR(""); setQuote(null);
      onCreated();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-black text-brand-900">۱. انتخاب فروشگاه همکار</h3>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className={`${inputCls} pr-9`} placeholder="جستجوی نام فروشگاه" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی فروشگاه همکار" />
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
          : !partners.length ? <p className="py-8 text-center text-sm text-gray-500">فروشگاهی که همکاری دستی را پذیرفته باشد پیدا نشد.</p> : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {partners.map((b) => {
                const L = LEVEL_STYLE[b.level] || LEVEL_STYLE.BRONZE;
                const active = partner?.id === b.id;
                return (
                  <li key={b.id}>
                    <button type="button" disabled={b.competitor || b.audience < 10} onClick={() => { if (partner?.id !== b.id) { setQuote(null); setPartner(b); } }}
                      className={`w-full rounded-2xl border p-3 text-right text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-brand-400 bg-brand-50" : "border-gray-100 hover:border-brand-200"}`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-800">{b.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${L.chip}`}>{b.level_label}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                        {b.category && <span>{b.category}</span>}
                        {b.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{b.location}</span>}
                        <span>{toFaDigits(b.audience)} مشتری</span>
                        <span>سهم همکار: {fmtMoney(b.price)} تومان/نفر</span>
                      </span>
                      {b.competitor && <span className="mt-1 block text-[11px] font-bold text-rose-700">هم‌صنف شماست؛ امکان همکاری نیست.</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-black text-brand-900">۲. متن پیشنهاد</h3>
        {!partner ? <p className="text-sm text-gray-500">اول یک فروشگاه همکار انتخاب کنید.</p> : (
          <>
            <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-800">ارسال برای مشتریان <span className="font-black">{partner.name}</span></p>
            <Field label="عنوان (برای خودتان)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
            <Field label="متن پیشنهاد *" hint="نام فروشگاه شما ابتدای پیامک و «معرفی از …» و متن لغو انتهای آن اضافه می‌شود.">
              <textarea className={`${inputCls} h-28 py-2`} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
            </Field>
            <Field label="حداکثر تعداد گیرنده" hint="خالی = همه‌ی مشتریان قابل ارسال (فعال‌ترها اول)">
              <input className={inputCls} dir="ltr" inputMode="numeric" value={maxR} onChange={(e) => setMaxR(e.target.value)} />
            </Field>
            {quote && (
              <div className="space-y-1.5 rounded-2xl bg-cream p-4 text-sm text-brand-900">
                <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed text-gray-700">{quote.final_text}</p>
                <p className="flex justify-between"><span>گیرنده</span><span className="font-bold">{toFaDigits(quote.recipients)} از {toFaDigits(quote.audience)}</span></p>
                <p className="flex justify-between"><span>هزینه‌ی هر نفر</span><span className="font-bold">{fmtMoney(quote.unit_cost)} تومان <span className="text-xs font-normal">(پیامک {fmtMoney(quote.unit_sms_cost)} + سهم همکار {fmtMoney(quote.partner_price)})</span></span></p>
                <p className="flex justify-between text-base"><span>هزینه‌ی کل (رزرو)</span><span className="font-black">{fmtMoney(quote.cost)} تومان</span></p>
                <p className="flex justify-between text-xs"><span>موجودی شما</span><span className={quote.cost > quote.balance ? "font-bold text-rose-700" : ""}>{fmtMoney(quote.balance)} تومان</span></p>
              </div>
            )}
            <Notice>هزینه همین حالا رزرو می‌شود. اگر فروشگاه همکار یا مدیریت رد کند، یا پیامکی ناموفق شود، هزینه‌اش برمی‌گردد. شماره‌ی مشتریان همکار هرگز به شما نشان داده نمی‌شود.</Notice>
            <Btn variant="accent" className="w-full" onClick={submit} loading={busy}>ثبت درخواست همکاری</Btn>
          </>
        )}
      </section>
    </div>
  );
}

function CoopList({ direction, onChange }: { direction: "in" | "out"; onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/loyalty/owner/share/coops/", { params: { direction, page } });
      setItems(r.data.results); setCount(r.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [direction, page]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, op: "accept" | "reject" | "cancel") => {
    let note = "";
    if (op === "reject") {
      const n = window.prompt("دلیل رد (اختیاری):", "");
      if (n === null) return;
      note = n;
    }
    if (op === "cancel" && !window.confirm("درخواست لغو و هزینه‌ی رزروشده برگردانده شود؟")) return;
    setBusyId(id);
    try {
      await api.post(`/loyalty/owner/share/coops/${id}/${op}/`, { note });
      toast.success(op === "accept" ? "پذیرفته شد؛ بعد از تأیید مدیریت ارسال می‌شود." : op === "reject" ? "درخواست رد شد." : "درخواست لغو شد.");
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusyId(null); }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={Inbox} title="درخواستی نیست" text={direction === "in" ? "اگر «ارسال پیشنهاد همکاران» را در تنظیمات فعال کنید، درخواست‌ها اینجا می‌آیند." : undefined} />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((c) => (
                <li key={c.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{c.title}</p>
                      <p className="text-xs text-gray-500">
                        {direction === "in" ? `از «${c.requester_name}»` : `برای مشتریان «${c.partner_name}»`} · {toFaDigits(c.created_jalali)} · {toFaDigits(c.recipients_count)} گیرنده
                      </p>
                    </div>
                    <Badge s={c.status} label={c.status_display} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{c.final_text}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                    {direction === "in" ? (
                      <span>درآمد شما: {c.status === "DONE" ? <span className="font-black text-emerald-700">{fmtMoney(c.partner_income)} تومان</span>
                        : <>حدود <span className="font-bold">{fmtMoney(c.expected_partner_income)}</span> تومان ({fmtMoney(c.partner_price)} برای هر پیامک موفق، منهای {toFaDigits(c.commission_percent)}٪ کارمزد)</>}</span>
                    ) : (
                      <span>هزینه‌ی رزروشده: <span className="font-bold">{fmtMoney(c.cost)}</span> تومان{c.status === "DONE" || c.status === "SENDING" ? ` · ارسال موفق ${toFaDigits(c.sent_count)} · ناموفق ${toFaDigits(c.failed_count)}` : ""}</span>
                    )}
                    <div className="flex gap-2">
                      {direction === "in" && c.status === "PENDING_PARTNER" && (
                        <>
                          <Btn className="h-10" onClick={() => act(c.id, "accept")} loading={busyId === c.id}><Check className="h-4 w-4" /> می‌پذیرم</Btn>
                          <Btn variant="danger" className="h-10" onClick={() => act(c.id, "reject")} disabled={busyId === c.id}><X className="h-4 w-4" /> رد</Btn>
                        </>
                      )}
                      {direction === "out" && ["PENDING_PARTNER", "PENDING_ADMIN"].includes(c.status) && (
                        <Btn variant="outline" className="h-10" onClick={() => act(c.id, "cancel")} loading={busyId === c.id}>لغو درخواست</Btn>
                      )}
                    </div>
                  </div>
                  {(c.partner_note || c.admin_note) && <p className="text-xs text-rose-700">{c.partner_note || c.admin_note}</p>}
                </li>
              ))}
            </ul>
          )}
      <div className="px-4 pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}
