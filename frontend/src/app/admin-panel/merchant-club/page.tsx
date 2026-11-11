"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, Check, Crown, Handshake, Loader2, Percent, Settings2, Ticket, Wallet, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { LEVEL_STYLE } from "@/components/club/LevelCard";
import { Btn, EmptyState, Field, Notice, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, parseAmount, toFaDigits } from "@/lib/club";

type Tab = "withdrawals" | "coops" | "levels" | "settings";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "withdrawals", label: "برداشت درآمد", icon: ArrowDownToLine },
  { id: "coops", label: "اشتراک‌گذاری دستی", icon: Handshake },
  { id: "levels", label: "سطح فروشگاه‌ها", icon: Crown },
  { id: "settings", label: "تنظیمات و کارمزد", icon: Settings2 },
];
const TONE: Record<string, string> = {
  PENDING: "bg-saffron-50 text-saffron-800", PENDING_ADMIN: "bg-saffron-50 text-saffron-800", PENDING_PARTNER: "bg-gray-100 text-gray-600",
  PAID: "bg-emerald-50 text-emerald-700", DONE: "bg-emerald-50 text-emerald-700", SENDING: "bg-sky-50 text-sky-700",
  REJECTED: "bg-rose-50 text-rose-700", PARTNER_REJECTED: "bg-rose-50 text-rose-700", CANCELLED: "bg-gray-100 text-gray-600",
};
const Badge = ({ s, label }: { s: string; label: string }) => (
  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[s] || "bg-gray-100 text-gray-600"}`}>{label}</span>
);

/** مدیریت باشگاه پذیرندگان: برداشت درآمد، اشتراک‌گذاری دستی، سطح‌ها و کارمزد (ادمین سایت) */
export default function AdminMerchantClubPage() {
  const [tab, setTab] = useState<Tab>("withdrawals");
  const [ov, setOv] = useState<any>(null);

  const load = useCallback(async () => {
    try { setOv((await api.get("/loyalty/admin/share/overview/")).data); } catch (e) { toast.error(apiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-saffron-700">مدیریت سایت</p>
          <h1 className="mt-1 text-2xl font-black text-brand-900">باشگاه پذیرندگان و اشتراک‌گذاری</h1>
        </div>
        <Link href="/admin-panel/sms" className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:border-brand-300">
          <Wallet className="h-4 w-4" /> کیف‌پول‌ها و شارژها
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کوپن صادر / استفاده‌شده" value={`${toFaDigits(ov?.vouchers_issued ?? 0)} / ${toFaDigits(ov?.vouchers_used ?? 0)}`} icon={Ticket} />
        <StatCard label="درآمد کارمزد سایت" value={fmtMoney((ov?.voucher_commission || 0) + (ov?.coop_commission || 0))} sub={`از ${fmtMoney(ov?.voucher_fees)} تومان هزینه‌ی مشتری جدید`} icon={Percent} tone="emerald" />
        <StatCard label="برداشت در انتظار" value={toFaDigits(ov?.pending_withdrawals ?? 0)} icon={ArrowDownToLine} tone="saffron" />
        <StatCard label="همکاری در انتظار تأیید" value={toFaDigits(ov?.pending_coops ?? 0)} icon={Handshake} tone="rose" />
      </div>
      {ov && (
        <p className="text-xs text-gray-600">
          فروشگاه‌های شرکت‌کننده: معرفی {toFaDigits(ov.participants.send)} · پذیرش {toFaDigits(ov.participants.receive)} · همکاری دستی {toFaDigits(ov.participants.coop)}
          {" "}— سطح‌ها: {Object.entries(ov.levels).map(([k, n]) => `${({ BRONZE: "برنزی", SILVER: "نقره‌ای", GOLD: "طلایی", DIAMOND: "الماس" } as any)[k]} ${toFaDigits(n as number)}`).join("، ")}
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${tab === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "withdrawals" && <Withdrawals onChange={load} />}
      {tab === "coops" && <Coops onChange={load} />}
      {tab === "levels" && <Levels />}
      {tab === "settings" && <SettingsForm />}
    </div>
  );
}

function useList(url: string, status: string, page: number) {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(url, { params: { status: status || undefined, page } });
      setItems(r.data.results); setCount(r.data.count);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [url, status, page]);
  useEffect(() => { load(); }, [load]);
  return { items, count, loading, load };
}

function Withdrawals({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const { items, count, loading, load } = useList("/loyalty/admin/share/withdrawals/", status, page);
  const [busy, setBusy] = useState<number | null>(null);

  const review = async (id: number, paid: boolean) => {
    let bank_ref = "";
    if (paid) {
      const r = window.prompt("مبلغ را به شبا واریز کنید و کد پیگیری واریز را وارد کنید:", "");
      if (!r) return;
      bank_ref = r;
    }
    const note = paid ? "" : window.prompt("دلیل رد (به فروشنده نمایش داده می‌شود):", "");
    if (note === null) return;
    setBusy(id);
    try {
      await api.post(`/loyalty/admin/share/withdrawals/${id}/${paid ? "pay" : "reject"}/`, { bank_ref, note });
      toast.success(paid ? "واریز ثبت شد." : "درخواست رد شد و مبلغ به درآمد فروشنده برگشت.");
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(null); }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 p-4">
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="وضعیت">
          <option value="PENDING">در انتظار</option><option value="PAID">واریزشده</option><option value="REJECTED">ردشده</option><option value="">همه</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={ArrowDownToLine} title="درخواستی نیست" />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">{r.business_name} · <span className="text-saffron-700">{fmtMoney(r.amount)} تومان</span></p>
                    <p className="mt-0.5 text-xs text-gray-600"><span dir="ltr" className="font-mono">{r.sheba}</span> · {r.account_holder}</p>
                    <p className="text-[11px] text-gray-500">{toFaDigits(r.created_jalali)}{r.bank_ref ? ` · کد پیگیری ${r.bank_ref}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "PENDING" ? (
                      <>
                        <Btn className="h-10" onClick={() => review(r.id, true)} loading={busy === r.id}><Check className="h-4 w-4" /> واریز شد</Btn>
                        <Btn variant="danger" className="h-10" onClick={() => review(r.id, false)} disabled={busy === r.id}><X className="h-4 w-4" /> رد</Btn>
                      </>
                    ) : <Badge s={r.status} label={r.status_display} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
      <div className="px-4 pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}

function Coops({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState("PENDING_ADMIN");
  const [page, setPage] = useState(1);
  const { items, count, loading, load } = useList("/loyalty/admin/share/coops/", status, page);
  const [busy, setBusy] = useState<number | null>(null);

  const review = async (id: number, approve: boolean) => {
    const note = approve ? "" : window.prompt("دلیل رد:", "");
    if (note === null) return;
    setBusy(id);
    try {
      await api.post(`/loyalty/admin/share/coops/${id}/${approve ? "approve" : "reject"}/`, { note });
      toast.success(approve ? "تأیید شد و ارسال شروع شد." : "رد شد و هزینه برگشت.");
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(null); }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 p-4">
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="وضعیت">
          <option value="PENDING_ADMIN">در انتظار تأیید</option><option value="PENDING_PARTNER">در انتظار همکار</option>
          <option value="SENDING">در حال ارسال</option><option value="DONE">ارسال‌شده</option><option value="REJECTED">ردشده</option><option value="">همه</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
        : !items.length ? <EmptyState icon={Handshake} title="درخواستی نیست" />
          : (
            <ul className="divide-y divide-gray-50">
              {items.map((c) => (
                <li key={c.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{c.requester_name} ← مشتریان {c.partner_name}</p>
                      <p className="text-xs text-gray-500">{toFaDigits(c.created_jalali)} · {toFaDigits(c.recipients_count)} گیرنده · {toFaDigits(c.parts)} بخش · هزینه {fmtMoney(c.cost)} تومان · سهم همکار {fmtMoney(c.partner_price)}/نفر</p>
                    </div>
                    <Badge s={c.status} label={c.status_display} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{c.final_text}</p>
                  {c.status === "PENDING_ADMIN" && (
                    <div className="flex gap-2">
                      <Btn className="h-10" onClick={() => review(c.id, true)} loading={busy === c.id}><Check className="h-4 w-4" /> تأیید و ارسال</Btn>
                      <Btn variant="danger" className="h-10" onClick={() => review(c.id, false)} disabled={busy === c.id}><X className="h-4 w-4" /> رد</Btn>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      <div className="px-4 pb-4"><Pagination page={page} count={count} pageSize={20} onChange={setPage} /></div>
    </section>
  );
}

function Levels() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await api.get("/loyalty/admin/share/levels/", { params: { q: q || undefined } })).data); }
    catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const setLevel = async (id: string, value: string) => {
    try {
      const body = value === "AUTO" ? { business: id, manual: false } : { business: id, manual: true, level: value };
      const r = await api.post("/loyalty/admin/share/levels/", body);
      setRows((rs) => rs.map((x) => x.id === id ? { ...x, ...r.data } : x));
      toast.success("سطح به‌روز شد.");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <input className={`${inputCls} mb-3 max-w-xs`} placeholder="جستجوی کسب‌وکار" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی کسب‌وکار" />
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div> : (
        <ul className="divide-y divide-gray-50">
          {rows.map((r) => {
            const L = LEVEL_STYLE[r.level] || LEVEL_STYLE.BRONZE;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-2 font-bold text-gray-800">
                  {r.name}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${L.chip}`}>{r.level_label}</span>
                  <span className="text-xs font-normal text-gray-500">امتیاز {toFaDigits(r.score)}{r.manual ? " · دستی" : ""}</span>
                </span>
                <select className={`${inputCls} w-auto`} value={r.manual ? r.level : "AUTO"} onChange={(e) => setLevel(r.id, e.target.value)} aria-label={`سطح ${r.name}`}>
                  <option value="AUTO">خودکار (بر اساس امتیاز)</option>
                  <option value="BRONZE">برنزی (دستی)</option><option value="SILVER">نقره‌ای (دستی)</option>
                  <option value="GOLD">طلایی (دستی)</option><option value="DIAMOND">الماس (دستی)</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const NUM_FIELDS: [string, string, string?][] = [
  ["commission_percent", "کارمزد سایت (٪)", "از هزینه‌ی مشتری جدید و سهم همکاری"],
  ["min_fee", "حداقل هزینه‌ی مشتری جدید (تومان)"],
  ["max_fee", "حداکثر هزینه‌ی مشتری جدید (تومان)"],
  ["default_fee", "هزینه‌ی پیش‌فرض مشتری جدید (تومان)"],
  ["vouchers_per_purchase", "حداکثر کوپن بعد از هر خرید", "۱ تا ۵"],
  ["issue_cooldown_days", "فاصله‌ی صدور کوپن برای یک مشتری (روز)"],
  ["max_distance_km", "حداکثر فاصله‌ی فروشگاه همکار (کیلومتر)"],
  ["coop_min_price", "حداقل سهم همکار برای هر گیرنده (تومان)"],
  ["coop_max_price", "حداکثر سهم همکار برای هر گیرنده (تومان)"],
  ["min_withdraw", "حداقل مبلغ برداشت (تومان)"],
  ["silver_min_score", "امتیاز سطح نقره‌ای"],
  ["gold_min_score", "امتیاز سطح طلایی"],
  ["diamond_min_score", "امتیاز سطح الماس"],
  ["silver_commission_off", "کاهش کارمزد نقره‌ای (واحد درصد)"],
  ["gold_commission_off", "کاهش کارمزد طلایی (واحد درصد)"],
  ["diamond_commission_off", "کاهش کارمزد الماس (واحد درصد)"],
];

function SettingsForm() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/loyalty/admin/share/settings/").then((r) => setForm(r.data)).catch((e) => toast.error(apiError(e)));
  }, []);
  if (!form) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { enabled: form.enabled };
      NUM_FIELDS.forEach(([k]) => { body[k] = parseAmount(String(form[k] ?? "")); });
      setForm((await api.put("/loyalty/admin/share/settings/", body)).data);
      toast.success("تنظیمات ذخیره شد.");
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gray-700">
        <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        اشتراک‌گذاری مشتری (صدور کوپن همکاری) فعال باشد
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NUM_FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}>
            <input className={inputCls} dir="ltr" inputMode="numeric" value={String(form[k] ?? "")} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <Notice>
        امتیاز ماهانه‌ی هر فروشگاه = مشتریان متمایز خریدکرده + ۲ × خریدهای تأییدشده با کد + ۵ × مشتری جذب/معرفی‌شده (۳۰ روز اخیر). سطح‌ها روزانه به‌روز می‌شوند
        (دستور <span dir="ltr" className="font-mono">python manage.py share_daily</span>). سطح طلایی و الماس نشان «دکان برتر» در صفحه‌ی عمومی می‌گیرند.
      </Notice>
      <Btn onClick={save} loading={saving}>ذخیره‌ی تنظیمات</Btn>
    </section>
  );
}
