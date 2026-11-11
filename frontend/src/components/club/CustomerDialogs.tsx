"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Gift, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, Field, Modal, inputCls } from "@/components/club/ui";
import { LABEL_COLORS, apiError, fmtMoney, isJalaliDate, parseAmount, toEnDigits, toFaDigits } from "@/lib/club";

export interface Label { id: number; name: string; color: string; customers_count?: number }
export interface Customer {
  id: string; phone_number: string; full_name: string; membership_no: number; marital_status: string;
  birth_date_display: string; anniversary_date_display: string; labels: Label[]; note: string; source: string;
  sms_opt_out: boolean; has_account: boolean; credit_balance: number; total_purchase_amount: number;
  purchase_count: number; last_purchase_jalali: string; created_jalali: string;
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${LABEL_COLORS[label.color] || LABEL_COLORS.brand}`}>
      {label.name}
    </span>
  );
}

/* ------------------------------------------------------------ فرم افزودن/ویرایش مشتری */
export function CustomerFormDialog({ open, onClose, onSaved, labels, edit }: {
  open: boolean; onClose: () => void; onSaved: () => void; labels: Label[]; edit?: Customer | null;
}) {
  const blank = { phone_number: "", full_name: "", marital_status: "", birth_date: "", anniversary_date: "", note: "", sms_opt_out: false, label_ids: [] as number[] };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(edit ? {
      phone_number: edit.phone_number, full_name: edit.full_name, marital_status: edit.marital_status,
      birth_date: edit.birth_date_display.length > 5 ? edit.birth_date_display : "",
      anniversary_date: edit.anniversary_date_display.length > 5 ? edit.anniversary_date_display : "",
      note: edit.note, sms_opt_out: edit.sms_opt_out, label_ids: edit.labels.map((l) => l.id),
    } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  const toggleLabel = (id: number) =>
    setForm((f) => ({ ...f, label_ids: f.label_ids.includes(id) ? f.label_ids.filter((x) => x !== id) : [...f.label_ids, id] }));

  const save = async () => {
    for (const k of ["birth_date", "anniversary_date"] as const) {
      if (form[k] && !isJalaliDate(form[k])) return toast.error("تاریخ را به شکل ۱۳۷۰/۰۵/۱۲ وارد کنید.");
    }
    setSaving(true);
    const payload: any = { ...form, birth_date: toEnDigits(form.birth_date), anniversary_date: toEnDigits(form.anniversary_date) };
    try {
      if (edit) {
        delete payload.phone_number;
        await api.patch(`/loyalty/owner/customers/${edit.id}/`, payload);
      } else {
        payload.phone_number = toEnDigits(form.phone_number);
        await api.post("/loyalty/owner/customers/", payload);
      }
      toast.success("اطلاعات مشتری ذخیره شد.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? "ویرایش مشتری" : "افزودن مشتری"}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="موبایل *" hint={edit ? "شماره قابل تغییر نیست" : undefined}>
            <input className={inputCls} dir="ltr" inputMode="tel" maxLength={11} disabled={!!edit} value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="09121234567" />
          </Field>
          <Field label="نام و نام خانوادگی">
            <input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="تاریخ تولد (شمسی)">
            <input className={inputCls} dir="ltr" placeholder="1370/05/12" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </Field>
          <Field label="وضعیت تأهل">
            <select className={inputCls} value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
              <option value="">نامشخص</option>
              <option value="SINGLE">مجرد</option>
              <option value="MARRIED">متأهل</option>
            </select>
          </Field>
          {form.marital_status === "MARRIED" && (
            <Field label="سالگرد ازدواج (شمسی)">
              <input className={inputCls} dir="ltr" placeholder="1395/02/20" value={form.anniversary_date} onChange={(e) => setForm({ ...form, anniversary_date: e.target.value })} />
            </Field>
          )}
        </div>
        {labels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-gray-600">برچسب‌ها</p>
            <div className="flex flex-wrap gap-2">
              {labels.map((l) => {
                const on = form.label_ids.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLabel(l.id)} aria-pressed={on}
                    className={`min-h-9 rounded-full border px-3 text-xs font-bold transition-all ${on ? LABEL_COLORS[l.color] + " ring-2 ring-offset-1 ring-brand-200" : "border-gray-200 bg-white text-gray-500"}`}>
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Field label="یادداشت"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} /></Field>
        <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.sms_opt_out} onChange={(e) => setForm({ ...form, sms_opt_out: e.target.checked })} />
          مشتری پیامک تبلیغاتی دریافت نکند (لغو۱۱)
        </label>
        <Btn className="w-full" onClick={save} loading={saving}>ذخیره</Btn>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ مدیریت برچسب‌ها */
export function LabelsDialog({ open, onClose, labels, onChanged }: {
  open: boolean; onClose: () => void; labels: Label[]; onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("brand");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/loyalty/owner/labels/", { name: name.trim(), color });
      setName("");
      onChanged();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const remove = async (l: Label) => {
    if (!window.confirm(`برچسب «${l.name}» حذف شود؟`)) return;
    try { await api.delete(`/loyalty/owner/labels/${l.id}/`); onChanged(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title="برچسب‌های مشتری">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className={inputCls} placeholder="نام برچسب (مثلاً مشتری ویژه)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Btn onClick={add} loading={busy} aria-label="افزودن برچسب"><Plus className="h-4 w-4" /></Btn>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="رنگ برچسب">
          {Object.keys(LABEL_COLORS).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)} aria-label={c}
              className={`h-9 w-9 rounded-full border-2 ${LABEL_COLORS[c]} ${color === c ? "ring-2 ring-brand-400 ring-offset-2" : ""}`} />
          ))}
        </div>
        <ul className="divide-y divide-gray-100">
          {labels.length === 0 && <li className="py-6 text-center text-sm text-gray-500">برچسبی ندارید.</li>}
          {labels.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2"><LabelChip label={l} /> <span className="text-xs text-gray-500">{(l.customers_count || 0).toLocaleString("fa-IR")} مشتری</span></span>
              <button aria-label="حذف برچسب" onClick={() => remove(l)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ پروفایل مشتری */
export function CustomerProfileDialog({ customer, onClose, onEdit, onNewPurchase, onChanged }: {
  customer: Customer | null; onClose: () => void; onEdit: (c: Customer) => void;
  onNewPurchase: (phone: string) => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<"purchases" | "wallet" | "rewards">("purchases");
  const [history, setHistory] = useState<{ credit_balance: number; purchases: any[]; wallet: any[]; rewards?: any[]; segment?: { key: string; label: string; r: number; f: number; m: number } | null } | null>(null);
  const [gift, setGift] = useState({ amount: "", note: "" });
  const [giftOpen, setGiftOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (id: string) => {
    try {
      const res = await api.get(`/loyalty/owner/customers/${id}/history/`);
      setHistory(res.data);
    } catch (e) { toast.error(apiError(e)); }
  };

  useEffect(() => {
    setHistory(null); setTab("purchases"); setGiftOpen(false); setGift({ amount: "", note: "" });
    if (customer) load(customer.id);
  }, [customer]);

  const sendGift = async () => {
    if (!customer) return;
    const amount = parseAmount(gift.amount);
    if (!amount) return toast.error("مبلغ را وارد کنید.");
    setBusy(true);
    try {
      await api.post(`/loyalty/owner/customers/${customer.id}/gift-credit/`, { amount, note: gift.note });
      toast.success("اعتبار هدیه به کیف‌پول مشتری اضافه شد.");
      setGiftOpen(false); setGift({ amount: "", note: "" });
      load(customer.id); onChanged();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!customer} onClose={onClose} title="پروفایل مشتری" wide>
      {customer && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-lg font-black">
                {customer.full_name || "بدون نام"}
                {customer.has_account && <BadgeCheck className="h-5 w-5 text-saffron-300" aria-label="عضو سایت" />}
              </p>
              <p className="mt-1 text-sm text-brand-200" dir="ltr" style={{ textAlign: "right" }}>{customer.phone_number}</p>
              <p className="mt-1 text-xs text-brand-300">
                شماره اشتراک {toFaDigits(customer.membership_no)} · عضویت از {toFaDigits(customer.created_jalali)}
              </p>
              {customer.labels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{customer.labels.map((l) => <LabelChip key={l.id} label={l} />)}</div>}
              {history?.segment && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-saffron-500/20 px-2.5 py-1 text-[11px] font-bold text-saffron-200">
                  {history.segment.label}
                  {history.segment.r > 0 && <span className="font-normal text-brand-200" dir="ltr">R{history.segment.r} F{history.segment.f} M{history.segment.m}</span>}
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-3 text-center">
              <p className="text-xs text-brand-200">موجودی اعتبار</p>
              <p className="text-2xl font-black text-saffron-300">{fmtMoney(history?.credit_balance ?? customer.credit_balance)}</p>
              <p className="text-[11px] text-brand-300">تومان</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["تعداد خرید", toFaDigits(customer.purchase_count)], ["جمع خرید", `${fmtMoney(customer.total_purchase_amount)} ت`],
              ["آخرین خرید", customer.last_purchase_jalali ? toFaDigits(customer.last_purchase_jalali) : "—"],
              ["تولد", customer.birth_date_display ? toFaDigits(customer.birth_date_display) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] font-bold text-gray-500">{k}</p><p className="mt-0.5 font-black text-gray-800">{v}</p></div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Btn variant="accent" onClick={() => onNewPurchase(customer.phone_number)}><Receipt className="h-4 w-4" /> ثبت خرید</Btn>
            <Btn variant="outline" onClick={() => setGiftOpen((s) => !s)}><Gift className="h-4 w-4" /> اعتبار هدیه</Btn>
            <Btn variant="ghost" onClick={() => onEdit(customer)}><Pencil className="h-4 w-4" /> ویرایش</Btn>
          </div>

          {giftOpen && (
            <div className="grid gap-3 rounded-2xl border border-saffron-200 bg-saffron-50 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field label="مبلغ (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(gift.amount) ? parseAmount(gift.amount).toLocaleString("en-US") : ""} onChange={(e) => setGift({ ...gift, amount: e.target.value })} /></Field>
              <Field label="توضیح"><input className={inputCls} value={gift.note} onChange={(e) => setGift({ ...gift, note: e.target.value })} placeholder="مثلاً هدیه‌ی عید" /></Field>
              <Btn onClick={sendGift} loading={busy}>افزودن</Btn>
            </div>
          )}

          <div>
            <div className="mb-3 flex gap-1 rounded-2xl bg-gray-100 p-1" role="tablist">
              {([["purchases", "خریدها", Receipt], ["wallet", "گردش اعتبار", Wallet], ["rewards", "هدیه‌ها", Gift]] as const).map(([key, label, Icon]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${tab === key ? "bg-white text-brand-800 shadow-sm" : "text-gray-500"}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            {!history ? (
              <p className="py-8 text-center text-sm text-gray-500">در حال دریافت...</p>
            ) : tab === "purchases" ? (
              history.purchases.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">خریدی ثبت نشده.</p> : (
                <ul className="divide-y divide-gray-100">
                  {history.purchases.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold text-gray-800">{fmtMoney(p.final_amount)} تومان <span className="text-xs font-normal text-gray-500">({p.payment_method_display})</span></p>
                        <p className="text-xs text-gray-500">{toFaDigits(p.purchased_jalali)}{p.branch_name ? ` · ${p.branch_name}` : ""}{p.line_name ? ` / ${p.line_name}` : ""}</p>
                      </div>
                      <div className="text-left text-xs">
                        <p className="font-bold text-saffron-700">+{fmtMoney(p.cashback_amount)}</p>
                        {p.credit_used > 0 && <p className="text-rose-600">−{fmtMoney(p.credit_used)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : tab === "rewards" ? (
              !history.rewards?.length ? <p className="py-8 text-center text-sm text-gray-500">هدیه‌ای صادر نشده.</p> : (
                <ul className="divide-y divide-gray-100">
                  {history.rewards.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold text-gray-800">{toFaDigits(r.description)}</p>
                        <p className="text-xs text-gray-500">{r.kind_display} · صدور {toFaDigits(r.issued_jalali)}{r.valid_until_jalali ? ` · تا ${toFaDigits(r.valid_until_jalali)}` : ""}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${r.status_display === "فعال" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{r.status_display}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : history.wallet.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">گردشی ثبت نشده.</p> : (
              <ul className="divide-y divide-gray-100">
                {history.wallet.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-bold text-gray-800">{w.kind_display}</p>
                      <p className="text-xs text-gray-500">{toFaDigits(w.created_jalali)}{w.note ? ` · ${w.note}` : ""}{w.expires_jalali && w.remaining > 0 ? ` · انقضا ${toFaDigits(w.expires_jalali)}` : ""}</p>
                    </div>
                    <div className="text-left">
                      <p className={`font-black ${w.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">{w.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(w.amount))}</p>
                      <p className="text-[11px] text-gray-500">مانده: {fmtMoney(w.balance_after)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

