"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, History, Loader2, Megaphone, Settings2, Wallet, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, EmptyState, Field, Notice, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, parseAmount, toFaDigits } from "@/lib/club";

type Tab = "charges" | "campaigns" | "messages" | "wallets" | "settings";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "charges", label: "درخواست‌های شارژ", icon: CreditCard },
  { id: "campaigns", label: "کمپین‌های انبوه", icon: Megaphone },
  { id: "messages", label: "گزارش ارسال", icon: History },
  { id: "wallets", label: "کیف‌پول فروشندگان", icon: Wallet },
  { id: "settings", label: "تنظیمات", icon: Settings2 },
];

const TONE: Record<string, string> = {
  PENDING: "bg-saffron-50 text-saffron-800", APPROVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-rose-50 text-rose-700",
  SENDING: "bg-sky-50 text-sky-700", DONE: "bg-emerald-50 text-emerald-700", CANCELLED: "bg-gray-100 text-gray-500",
  QUEUED: "bg-saffron-50 text-saffron-800", SENT: "bg-emerald-50 text-emerald-700", FAILED: "bg-rose-50 text-rose-700",
};
const Badge = ({ s, label }: { s: string; label: string }) => (
  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[s] || "bg-gray-100 text-gray-600"}`}>{label}</span>
);

/** مدیریت سامانه پیامکی (ادمین سایت) */
export default function AdminSmsPage() {
  const [tab, setTab] = useState<Tab>("charges");
  const [cfg, setCfg] = useState<any>(null);

  const loadCfg = useCallback(async () => {
    try { setCfg((await api.get("/loyalty/admin/sms/settings/")).data); } catch (e) { toast.error(apiError(e)); }
  }, []);
  useEffect(() => { loadCfg(); }, [loadCfg]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div>
        <p className="text-xs font-bold text-saffron-700">مدیریت سایت</p>
        <h1 className="mt-1 text-2xl font-black text-brand-900">سامانه پیامکی</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="شارژ در انتظار" value={toFaDigits(cfg?.totals?.pending_charges ?? 0)} icon={CreditCard} tone="saffron" />
        <StatCard label="کمپین در انتظار" value={toFaDigits(cfg?.totals?.pending_campaigns ?? 0)} icon={Megaphone} tone="rose" />
        <StatCard label="ارسال‌شده (۳۰ روز)" value={toFaDigits(cfg?.totals?.sent_30d ?? 0)} icon={History} tone="emerald" />
        <StatCard label="جمع موجودی کیف‌پول‌ها" value={fmtMoney(cfg?.totals?.wallets_balance)} sub="تومان" icon={Wallet} />
      </div>
      {cfg?.provider === "console" && <Notice tone="warn">سرویس پیامک روی حالت آزمایشی (console) است. برای ارسال واقعی SMS_PROVIDER و SMS_API_KEY و SMS_LINE_NUMBER را در backend/.env تنظیم کنید.</Notice>}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "charges" && <ReviewList kind="charges" onChange={loadCfg} />}
      {tab === "campaigns" && <ReviewList kind="campaigns" onChange={loadCfg} />}
      {tab === "messages" && <Messages />}
      {tab === "wallets" && <Wallets />}
      {tab === "settings" && cfg && <SettingsForm cfg={cfg} onSaved={loadCfg} />}
    </div>
  );
}

function ReviewList({ kind, onChange }: { kind: "charges" | "campaigns"; onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/loyalty/admin/sms/${kind}/`, { params: { page, status: status || undefined } });
      setItems(res.data.results); setCount(res.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [kind, page, status]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: "approve" | "reject") => {
    let note = "";
    if (action === "reject") {
      const n = window.prompt("دلیل رد (برای فروشنده نمایش داده می‌شود):");
      if (n === null) return;
      note = n;
    } else if (!window.confirm(kind === "charges" ? "مبلغ دریافت شد؟ کیف‌پول شارژ شود؟" : "این کمپین تأیید و ارسال شود؟")) return;
    setBusyId(id);
    try {
      await api.post(`/loyalty/admin/sms/${kind}/${id}/${action}/`, { note });
      toast.success(action === "approve" ? "تأیید شد." : "رد شد.");
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusyId(null); }
  };

  const filters = kind === "charges"
    ? [["PENDING", "در انتظار"], ["APPROVED", "تأییدشده"], ["REJECTED", "ردشده"], ["", "همه"]]
    : [["PENDING", "در انتظار"], ["SENDING", "در حال ارسال"], ["DONE", "ارسال‌شده"], ["REJECTED", "ردشده"], ["", "همه"]];

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-gray-50 p-4">
        {filters.map(([v, l]) => (
          <button key={v} onClick={() => { setPage(1); setStatus(v); }}
            className={`min-h-9 rounded-full px-4 text-xs font-bold ${status === v ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{l}</button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={kind === "charges" ? CreditCard : Megaphone} title="موردی وجود ندارد" />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900">{it.business_name}</p>
                    {kind === "charges" ? (
                      <>
                        <p className="mt-1 text-gray-700">{fmtMoney(it.amount)} تومان {it.ref_code && <span className="text-xs text-gray-500">· کد پیگیری <span dir="ltr">{it.ref_code}</span></span>}</p>
                        {it.note && <p className="text-xs text-gray-500">{it.note}</p>}
                        {it.receipt && <a href={it.receipt} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-brand-600 hover:underline">مشاهده‌ی تصویر رسید</a>}
                      </>
                    ) : (
                      <>
                        <p className="mt-1 font-bold text-gray-700">{it.title}</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-xl bg-gray-50 p-2 text-gray-700">{it.text}</p>
                        <p className="mt-1 text-xs text-gray-500">{toFaDigits(it.recipients_count)} گیرنده · {toFaDigits(it.parts)} بخش · {fmtMoney(it.cost)} تومان{it.status !== "PENDING" ? ` · ارسال ${toFaDigits(it.sent_count)} · ناموفق ${toFaDigits(it.failed_count)}` : ""}</p>
                      </>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500">{toFaDigits(it.created_jalali)}{it.admin_note ? ` · ${it.admin_note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge s={it.status} label={it.status_display} />
                    {it.status === "PENDING" && (
                      <>
                        <Btn className="h-9 px-3" loading={busyId === it.id} onClick={() => act(it.id, "approve")}><Check className="h-4 w-4" /> تأیید</Btn>
                        <Btn variant="danger" className="h-9 px-3" disabled={busyId === it.id} onClick={() => act(it.id, "reject")}><X className="h-4 w-4" /> رد</Btn>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
      <div className="pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}

function Messages() {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/loyalty/admin/sms/messages/", { params: { page, q: q || undefined, status: status || undefined } });
      setItems(res.data.results); setCount(res.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [page, q, status]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-gray-50 p-4">
        <input className={`${inputCls} max-w-xs`} placeholder="شماره یا نام کسب‌وکار" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="وضعیت">
          <option value="">همه</option><option value="SENT">ارسال‌شده</option><option value="QUEUED">در صف</option><option value="FAILED">ناموفق</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={History} title="پیامکی یافت نشد" />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800">{m.business_name} <span dir="ltr" className="text-xs font-normal text-gray-500">→ {m.phone}</span></p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-gray-600">{m.text}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{toFaDigits(m.created_jalali)} · {m.kind_display} · {fmtMoney(m.cost)} تومان{m.error ? ` · ${m.error}` : ""}</p>
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

function Wallets() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [adjust, setAdjust] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setRows((await api.get("/loyalty/admin/sms/wallets/", { params: { q: q || undefined } })).data); } catch (e) { toast.error(apiError(e)); }
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const apply = async (id: string, sign: 1 | -1) => {
    const amount = parseAmount(adjust[id] || "") * sign;
    if (!amount) return;
    const note = window.prompt("توضیح اصلاح موجودی:", sign > 0 ? "افزایش دستی" : "کاهش دستی");
    if (note === null) return;
    try {
      await api.post("/loyalty/admin/sms/wallets/adjust/", { business: id, amount, note });
      toast.success("موجودی اصلاح شد.");
      setAdjust({ ...adjust, [id]: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <input className={`${inputCls} mb-3 max-w-xs`} placeholder="جستجوی کسب‌وکار" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-gray-50">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="font-bold text-gray-800">{r.name} <span className="text-xs font-normal text-gray-500">· موجودی {fmtMoney(r.balance)} تومان{r.withdrawable ? ` · درآمد قابل برداشت ${fmtMoney(r.withdrawable)}` : ""}</span></span>
            <div className="flex items-center gap-2">
              <input className={`${inputCls} w-36`} dir="ltr" inputMode="numeric" placeholder="مبلغ"
                value={parseAmount(adjust[r.id] || "") ? parseAmount(adjust[r.id]).toLocaleString("en-US") : ""}
                onChange={(e) => setAdjust({ ...adjust, [r.id]: e.target.value })} />
              <Btn className="h-11 px-3" onClick={() => apply(r.id, 1)} aria-label="افزایش">+</Btn>
              <Btn variant="danger" className="h-11 px-3" onClick={() => apply(r.id, -1)} aria-label="کاهش">−</Btn>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SettingsForm({ cfg, onSaved }: { cfg: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    price_per_part: String(cfg.price_per_part), require_approval: cfg.require_approval,
    card_info: cfg.card_info || "", opt_out_text: cfg.opt_out_text || "لغو۱۱",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.put("/loyalty/admin/sms/settings/", { ...form, price_per_part: parseAmount(form.price_per_part) });
      toast.success("تنظیمات ذخیره شد."); onSaved();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <section className="max-w-2xl space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="قیمت هر بخش پیامک (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={form.price_per_part} onChange={(e) => setForm({ ...form, price_per_part: e.target.value })} /></Field>
        <Field label="متن لغو در انتهای پیامک تبلیغاتی"><input className={inputCls} value={form.opt_out_text} onChange={(e) => setForm({ ...form, opt_out_text: e.target.value })} maxLength={30} /></Field>
      </div>
      <Field label="اطلاعات کارت برای شارژ" hint="به فروشنده‌ها در صفحه‌ی شارژ نمایش داده می‌شود.">
        <textarea className={`${inputCls} h-24 py-2`} value={form.card_info} onChange={(e) => setForm({ ...form, card_info: e.target.value })} placeholder={"شماره کارت: ...\nبه نام: ..."} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gray-700">
        <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.require_approval} onChange={(e) => setForm({ ...form, require_approval: e.target.checked })} />
        کمپین‌های انبوه قبل از ارسال نیاز به تأیید مدیریت دارند
      </label>
      <Btn onClick={save} loading={saving}>ذخیره</Btn>
    </section>
  );
}
