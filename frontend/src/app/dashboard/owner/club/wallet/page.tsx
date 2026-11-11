"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CreditCard, History, Landmark, Loader2, TrendingUp, Upload, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import { Btn, Field, Notice, Pagination, StatCard, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, parseAmount, toEnDigits, toFaDigits } from "@/lib/club";

const TONE: Record<string, string> = {
  PENDING: "bg-saffron-50 text-saffron-800", APPROVED: "bg-emerald-50 text-emerald-700", PAID: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};
const Badge = ({ s, label }: { s: string; label: string }) => (
  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[s] || "bg-gray-100 text-gray-600"}`}>{label}</span>
);
const INCOME_KINDS = new Set(["SHARE_IN", "COOP_IN", "WD_REFUND"]);

/** کیف‌پول فروشنده: شارژ، درآمد اشتراک‌گذاری و برداشت به حساب بانکی */
export default function WalletPage() {
  const [w, setW] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerKey, setLedgerKey] = useState(0);

  const load = useCallback(async () => {
    try { setW((await api.get("/loyalty/owner/wallet/")).data); } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); setLedgerKey((k) => k + 1); };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-9 w-9 animate-spin text-brand-500" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader title="کیف‌پول فروشنده" subtitle="یک کیف‌پول برای هزینه‌ی پیامک و مشتری جدید، و درآمد معرفی مشتری به فروشگاه‌های همکار" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="موجودی کل" value={fmtMoney(w?.balance)} sub="تومان" icon={Wallet} tone="saffron" />
        <StatCard label="درآمد قابل برداشت" value={fmtMoney(w?.withdrawable)} sub="تومان" icon={Landmark} tone="emerald" />
        <StatCard label="درآمد ۳۰ روز" value={fmtMoney(w?.income_30d)} sub="معرفی مشتری و همکاری" icon={TrendingUp} />
        <StatCard label="هزینه‌ی ۳۰ روز" value={fmtMoney((w?.sms_30d || 0) + (w?.share_fees_30d || 0))} sub={`پیامک ${fmtMoney(w?.sms_30d)} · مشتری جدید ${fmtMoney(w?.share_fees_30d)}`} icon={History} tone="rose" />
      </div>
      <Notice>
        موجودی شارژی شما برای پیامک و «هزینه‌ی مشتری جدید» خرج می‌شود. درآمدی که از معرفی مشتری یا ارسال پیشنهاد همکاران به‌دست می‌آورید
        هم به همین کیف‌پول اضافه می‌شود و فقط این بخش (درآمد) قابل برداشت به حساب بانکی است. هزینه‌ها اول از موجودی شارژی کم می‌شوند.
      </Notice>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChargeForm cardInfo={w?.card_info} onChange={changed} />
        <WithdrawForm wallet={w} onChange={changed} />
      </div>
      <Ledger key={ledgerKey} />
    </div>
  );
}

function ChargeForm({ cardInfo, onChange }: { cardInfo?: string; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setRequests((await api.get("/loyalty/owner/sms/charges/")).data.results); } catch (e) { toast.error(apiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const amt = parseAmount(amount);
    if (amt < 10000) return toast.error("حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است.");
    if (!ref.trim() && !file) return toast.error("کد پیگیری یا تصویر رسید را وارد کنید.");
    const form = new FormData();
    form.append("amount", String(amt));
    form.append("ref_code", ref.trim());
    form.append("note", note);
    if (file) form.append("receipt", file);
    setBusy(true);
    try {
      await api.post("/loyalty/owner/sms/charges/", form);
      toast.success("درخواست شارژ ثبت شد و پس از بررسی مدیریت، موجودی شارژ می‌شود.");
      setAmount(""); setRef(""); setNote(""); setFile(null);
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-black text-brand-900"><CreditCard className="h-5 w-5 text-saffron-600" /> شارژ کیف‌پول</h2>
      {cardInfo ? (
        <div className="whitespace-pre-wrap rounded-2xl bg-cream p-4 text-sm font-bold leading-relaxed text-brand-900">{cardInfo}</div>
      ) : <Notice tone="warn">اطلاعات کارت هنوز توسط مدیریت ثبت نشده است.</Notice>}
      <p className="text-xs text-gray-500">مبلغ را کارت‌به‌کارت کنید و کد پیگیری یا تصویر رسید را ثبت کنید.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="مبلغ (تومان) *"><input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(amount) ? parseAmount(amount).toLocaleString("en-US") : ""} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="کد پیگیری"><input className={inputCls} dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} /></Field>
      </div>
      <button type="button" onClick={() => fileRef.current?.click()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 hover:border-brand-300">
        <Upload className="h-4 w-4" /> {file ? file.name : "بارگذاری تصویر رسید (اختیاری)"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <Field label="توضیحات"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      <Btn className="w-full" onClick={submit} loading={busy}>ثبت درخواست شارژ</Btn>

      {requests.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span>{fmtMoney(r.amount)} تومان <span className="text-xs text-gray-500">· {toFaDigits(r.created_jalali)}</span>{r.admin_note && <span className="block text-xs text-rose-700">{r.admin_note}</span>}</span>
              <Badge s={r.status} label={r.status_display} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WithdrawForm({ wallet, onChange }: { wallet: any; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [sheba, setSheba] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { setItems((await api.get("/loyalty/owner/wallet/withdrawals/")).data.results); } catch (e) { toast.error(apiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const min = wallet?.min_withdraw || 0;
  const available = wallet?.withdrawable || 0;
  const shebaDigits = toEnDigits(sheba).replace(/[^\d]/g, "");

  const submit = async () => {
    const amt = parseAmount(amount);
    if (amt < min) return toast.error(`حداقل مبلغ برداشت ${fmtMoney(min)} تومان است.`);
    if (amt > available) return toast.error("مبلغ از درآمد قابل برداشت بیشتر است.");
    if (shebaDigits.length !== 24) return toast.error("شماره شبا باید ۲۴ رقم (بعد از IR) باشد.");
    setBusy(true);
    try {
      await api.post("/loyalty/owner/wallet/withdrawals/", { amount: amt, sheba: `IR${shebaDigits}`, account_holder: holder });
      toast.success("درخواست برداشت ثبت شد؛ پس از بررسی، مبلغ به حساب شما واریز می‌شود.");
      setAmount("");
      load(); onChange();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-black text-brand-900"><ArrowDownToLine className="h-5 w-5 text-saffron-600" /> برداشت درآمد به حساب بانکی</h2>
      <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        قابل برداشت: <span className="text-lg font-black">{fmtMoney(available)}</span> تومان
        <span className="block text-xs">حداقل هر برداشت {fmtMoney(min)} تومان؛ پس از بررسی مدیریت به شبای شما واریز می‌شود.</span>
      </div>
      {wallet?.pending_withdrawal ? (
        <Notice tone="warn">یک درخواست برداشت در انتظار بررسی دارید. بعد از رسیدگی می‌توانید درخواست جدید ثبت کنید.</Notice>
      ) : available < min ? (
        <p className="py-4 text-center text-sm text-gray-500">هنوز درآمد کافی برای برداشت ندارید. با فعال کردن «اشتراک‌گذاری» از معرفی مشتری درآمد کسب کنید.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مبلغ (تومان) *">
              <input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(amount) ? parseAmount(amount).toLocaleString("en-US") : ""} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="نام صاحب حساب *"><input className={inputCls} value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={120} /></Field>
          </div>
          <Field label="شماره شبا *" hint="۲۴ رقم بعد از IR">
            <div className="flex items-center gap-2" dir="ltr">
              <span className="flex h-11 items-center rounded-xl bg-gray-100 px-3 text-sm font-bold text-gray-600">IR</span>
              <input className={inputCls} dir="ltr" inputMode="numeric" maxLength={30} value={shebaDigits} onChange={(e) => setSheba(e.target.value)} placeholder="000000000000000000000000" />
            </div>
          </Field>
          <Btn variant="accent" className="w-full" onClick={submit} loading={busy}>ثبت درخواست برداشت</Btn>
        </>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                {fmtMoney(r.amount)} تومان <span className="text-xs text-gray-500">· {toFaDigits(r.created_jalali)}</span>
                <span className="block truncate text-xs text-gray-500" dir="ltr">{r.sheba}</span>
                {r.bank_ref && <span className="block text-xs text-emerald-700">کد پیگیری واریز: {r.bank_ref}</span>}
                {r.admin_note && <span className="block text-xs text-rose-700">{r.admin_note}</span>}
              </span>
              <Badge s={r.status} label={r.status_display} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Ledger() {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/loyalty/owner/sms/ledger/", { params: { page } })
      .then((r) => { setRows(r.data.results); setCount(r.data.count); })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-black text-brand-900"><History className="h-5 w-5 text-saffron-600" /> گردش کیف‌پول</h2>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        : !rows.length ? <p className="py-8 text-center text-sm text-gray-500">گردشی ثبت نشده.</p> : (
          <ul className="divide-y divide-gray-100">
            {rows.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800">
                    {l.kind_display}
                    {INCOME_KINDS.has(l.kind) && <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">درآمد</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">{toFaDigits(l.created_jalali)} · {l.note}</p>
                </div>
                <div className="shrink-0 text-left">
                  <p className={`font-black ${l.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">{l.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(l.amount))}</p>
                  <p className="text-[11px] text-gray-500">مانده {fmtMoney(l.balance_after)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      <Pagination page={page} count={count} pageSize={20} onChange={setPage} />
    </section>
  );
}
