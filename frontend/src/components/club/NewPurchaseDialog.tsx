"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Calculator, Gift, KeyRound, MessageSquareText, ShieldCheck, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, Field, Modal, Notice, inputCls } from "@/components/club/ui";
import { PAYMENT_METHODS, apiError, fmtMoney, parseAmount, toEnDigits } from "@/lib/club";

interface Branch { id: number; name: string; is_active: boolean; lines: { id: number; name: string; cashback_percent: string; is_active: boolean }[] }
interface Verified {
  verification_token: string; customer_name: string; phone_number: string; membership_no: number;
  credit_balance: number; discount_percent: number; discount_source: string;
}
interface RewardBrief { id: number; title: string; description: string; valid_until: string | null }
interface Preview {
  discount_percent: number; discount_amount: number; credit_cap: number; credit_used: number;
  final_amount: number; cashback_amount: number; credit_balance: number;
  discount_source: string; discount_label: string; share_notice?: string;
  first_purchase_bonuses: { plan_id: number; title: string; description: string }[];
  gift_rewards: RewardBrief[]; available_rewards: RewardBrief[];
}

const SOURCE_LABEL: Record<string, string> = {
  SUBSCRIPTION: "اشتراک VIP", CAMPAIGN: "کد تخفیف", FIRST_PURCHASE: "اولین خرید", REWARD: "هدیه‌ی مشتری",
  SHARE: "کوپن همکاری",
};

/**
 * ثبت تراکنش باشگاه.
 * - بدون کد: فقط کش‌بک به مشتری داده می‌شود.
 * - با کد خرید مشتری (از پنل یا پیامک): تخفیف VIP/کمپین + خرج اعتبار هم ممکن است.
 */
export default function NewPurchaseDialog({ open, onClose, onDone, branches, presetPhone = "" }: {
  open: boolean; onClose: () => void; onDone: () => void; branches: Branch[]; presetPhone?: string;
}) {
  const [phone, setPhone] = useState(presetPhone);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState<Verified | null>(null);
  const [amount, setAmount] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lineId, setLineId] = useState("");
  const [payment, setPayment] = useState("CASH");
  const [useCredit, setUseCredit] = useState("");
  const [note, setNote] = useState("");
  const [giftIds, setGiftIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "sms" | "verify" | "save">("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const wasOpen = useRef(false);

  // فرم فقط وقتی دیالوگ تازه باز می‌شود ریست می‌شود (نه وقتی لیست شعب دیر می‌رسد)
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) {
      setPhone(presetPhone); setName(""); setCode(""); setVerified(null); setAmount(""); setUseCredit("");
      setNote(""); setPreview(null); setGiftIds([]); setLineId(""); setPayment("CASH");
      const active = branches.filter((b) => b.is_active);
      setBranchId(active.length === 1 ? String(active[0].id) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeBranches = branches.filter((b) => b.is_active);
  const lines = useMemo(
    () => activeBranches.find((b) => String(b.id) === branchId)?.lines.filter((l) => l.is_active) || [],
    [activeBranches, branchId],
  );
  const phoneEn = toEnDigits(phone).replace(/\D/g, "");
  const amountNum = parseAmount(amount);

  // پیش‌نمایش زنده‌ی محاسبه
  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (!amountNum || (!verified && phoneEn.length !== 11)) { setPreview(null); return; }
    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await api.post("/loyalty/owner/purchases/preview/", {
          phone_number: phoneEn, verification_token: verified?.verification_token, amount: amountNum,
          branch: branchId || undefined, line: lineId || undefined, use_credit: parseAmount(useCredit),
        });
        if (id === reqId.current) setPreview(res.data);
      } catch { if (id === reqId.current) setPreview(null); }
    }, 350);
  }, [open, amountNum, phoneEn, verified, branchId, lineId, useCredit]);

  const sendSms = async () => {
    if (phoneEn.length !== 11) return toast.error("شماره موبایل مشتری را کامل وارد کنید.");
    setBusy("sms");
    try {
      const res = await api.post("/directory/owner/crm/send-code/", { phone_number: phoneEn });
      toast.info(res.data?.message || "کد پیامک شد.");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); }
  };

  const verify = async () => {
    setBusy("verify");
    try {
      const res = await api.post("/loyalty/owner/verify-customer/", { phone_number: phoneEn, purchase_code: toEnDigits(code) });
      setVerified(res.data);
      setCode("");
      toast.success("مشتری تأیید شد.");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); }
  };

  const submit = async () => {
    if (!verified && phoneEn.length !== 11) return toast.error("شماره موبایل مشتری معتبر نیست.");
    if (!amountNum) return toast.error("مبلغ فاکتور را وارد کنید.");
    setBusy("save");
    try {
      const res = await api.post("/loyalty/owner/purchases/", {
        phone_number: phoneEn, customer_name: name, verification_token: verified?.verification_token,
        amount: amountNum, branch: branchId || undefined, line: lineId || undefined,
        payment_method: payment, use_credit: verified ? parseAmount(useCredit) : 0, note,
        gift_reward_ids: verified && giftIds.length ? giftIds : undefined,
      });
      const shared = Number(res.data.share_vouchers_issued || 0);
      toast.success(`تراکنش ثبت شد. کش‌بک: ${fmtMoney(res.data.cashback_amount)} تومان`
        + (shared ? ` · مشتری ${shared.toLocaleString("fa-IR")} کوپن از فروشگاه‌های همکار گرفت.` : ""));
      onDone();
      onClose();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); }
  };

  return (
    <Modal open={open} onClose={onClose} title="ثبت تراکنش" wide>
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          {/* مشتری */}
          <section className="space-y-3">
            <h4 className="text-sm font-black text-gray-800">۱. مشتری</h4>
            {verified ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="flex items-center gap-1.5 font-black text-emerald-800"><BadgeCheck className="h-5 w-5" /> {verified.customer_name}</p>
                  <p className="mt-1 text-xs text-emerald-700" dir="ltr" style={{ textAlign: "right" }}>{verified.phone_number} · اشتراک {verified.membership_no}</p>
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-emerald-700">موجودی اعتبار</p>
                  <p className="font-black text-emerald-900">{fmtMoney(verified.credit_balance)}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="موبایل مشتری *">
                    <input className={inputCls} dir="ltr" inputMode="tel" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" />
                  </Field>
                  <Field label="نام مشتری" hint="برای مشتری جدید">
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                </div>
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-brand-800">
                    <ShieldCheck className="h-4 w-4" /> برای خرج اعتبار یا تخفیف VIP، کد خرید مشتری را وارد کنید (اختیاری)
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className={`${inputCls} tracking-[0.3em]`} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                      value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد ۶ رقمی" aria-label="کد خرید مشتری" />
                    <Btn variant="primary" onClick={verify} loading={busy === "verify"} disabled={phoneEn.length !== 11 || toEnDigits(code).length !== 6}>
                      <KeyRound className="h-4 w-4" /> تأیید
                    </Btn>
                    <Btn variant="outline" onClick={sendSms} loading={busy === "sms"} disabled={phoneEn.length !== 11}>
                      <MessageSquareText className="h-4 w-4" /> پیامک کد
                    </Btn>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* فاکتور */}
          <section className="space-y-3">
            <h4 className="text-sm font-black text-gray-800">۲. فاکتور</h4>
            <Field label="مبلغ فاکتور (تومان) *">
              <input className={`${inputCls} text-lg font-black`} dir="ltr" inputMode="numeric"
                value={amountNum ? amountNum.toLocaleString("en-US") : ""} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="شعبه">
                <select className={inputCls} value={branchId} onChange={(e) => { setBranchId(e.target.value); setLineId(""); }}>
                  <option value="">بدون شعبه</option>
                  {activeBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="بخش فروش">
                <select className={inputCls} value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={!lines.length}>
                  <option value="">{lines.length ? "انتخاب بخش" : "—"}</option>
                  {lines.map((l) => <option key={l.id} value={l.id}>{l.name} ({Number(l.cashback_percent).toLocaleString("fa-IR")}٪)</option>)}
                </select>
              </Field>
              <Field label="روش پرداخت">
                <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            {verified && verified.credit_balance > 0 && (
              <Field label="خرج از اعتبار مشتری (تومان)" hint={preview ? `حداکثر قابل استفاده: ${fmtMoney(preview.credit_cap)} تومان` : undefined}>
                <div className="flex gap-2">
                  <input className={inputCls} dir="ltr" inputMode="numeric"
                    value={parseAmount(useCredit) ? parseAmount(useCredit).toLocaleString("en-US") : ""} onChange={(e) => setUseCredit(e.target.value)} placeholder="0" />
                  <Btn variant="outline" onClick={() => preview && setUseCredit(String(preview.credit_cap))} disabled={!preview?.credit_cap}>
                    <Wallet className="h-4 w-4" /> حداکثر
                  </Btn>
                </div>
              </Field>
            )}
            {/* هدیه‌های کالایی مشتری (طرح‌های تشویقی) */}
            {verified && preview && preview.gift_rewards.length > 0 && (
              <div className="rounded-2xl border border-saffron-200 bg-saffron-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-saffron-800"><Gift className="h-4 w-4" /> هدیه‌های کالایی مشتری — تحویل‌شده‌ها را تیک بزنید</p>
                {preview.gift_rewards.map((g) => (
                  <label key={g.id} className="flex min-h-10 items-center gap-2 text-sm text-gray-800">
                    <input type="checkbox" className="h-5 w-5 accent-saffron-600" checked={giftIds.includes(g.id)}
                      onChange={(e) => setGiftIds((ids) => (e.target.checked ? [...ids, g.id] : ids.filter((x) => x !== g.id)))} />
                    <span className="font-bold">{g.description}</span> <span className="text-xs text-gray-500">({g.title})</span>
                  </label>
                ))}
              </div>
            )}
            <Field label="توضیحات"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          </section>
        </div>

        {/* خلاصه */}
        <aside className="h-fit space-y-3 rounded-3xl bg-brand-900 p-5 text-brand-100 md:sticky md:top-0">
          <p className="flex items-center gap-2 text-sm font-black text-white"><Calculator className="h-4 w-4 text-saffron-300" /> خلاصه‌ی فاکتور</p>
          <Row label="مبلغ فاکتور" value={fmtMoney(amountNum)} />
          <Row label={`تخفیف${preview?.discount_percent ? ` (${preview.discount_percent.toLocaleString("fa-IR")}٪)` : ""}`} value={`− ${fmtMoney(preview?.discount_amount)}`} />
          {preview && preview.discount_amount > 0 && (
            <p className="-mt-1 text-[11px] text-saffron-300">
              {SOURCE_LABEL[preview.discount_source] || ""}{preview.discount_label ? `: ${preview.discount_label}` : ""}
            </p>
          )}
          {preview?.share_notice && (
            <p className="-mt-1 rounded-xl bg-saffron-500/15 p-2 text-[11px] leading-relaxed text-saffron-200">{preview.share_notice}</p>
          )}
          <Row label="پرداخت با اعتبار" value={`− ${fmtMoney(preview?.credit_used)}`} />
          <div className="border-t border-brand-700 pt-3">
            <p className="text-xs text-brand-300">مبلغ قابل پرداخت</p>
            <p className="mt-1 text-2xl font-black text-saffron-300">{fmtMoney(preview ? preview.final_amount : amountNum)} <span className="text-xs font-normal text-brand-300">تومان</span></p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-brand-200">کش‌بک این خرید</p>
            <p className="font-black text-white">{fmtMoney(preview?.cashback_amount)} تومان</p>
          </div>
          {preview && preview.first_purchase_bonuses.length > 0 && (
            <div className="rounded-2xl bg-saffron-500/15 p-3 text-xs text-saffron-200">
              <p className="mb-1 flex items-center gap-1 font-bold"><Gift className="h-3.5 w-3.5" /> هدیه‌ی اولین خرید</p>
              {preview.first_purchase_bonuses.map((b) => <p key={b.plan_id}>{b.description}</p>)}
            </div>
          )}
          {!verified && (
            <p className="text-[11px] leading-relaxed text-brand-300">
              بدون کد خرید، فقط کش‌بک و طرح اولین خرید اعمال می‌شود. برای VIP، کد تخفیف، هدیه‌ها و خرج اعتبار، مشتری را تأیید کنید.
            </p>
          )}
          <Btn variant="accent" className="w-full" onClick={submit} loading={busy === "save"} disabled={!amountNum}>
            ثبت نهایی تراکنش
          </Btn>
        </aside>
      </div>
      {!branches.length && (
        <div className="mt-5"><Notice>برای کش‌بک جداگانه هر بخش، از تب «شعب و تنظیمات» شعبه و بخش فروش تعریف کنید.</Notice></div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-brand-300">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
