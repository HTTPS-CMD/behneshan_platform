"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Cake, Gift, Heart, Loader2, Pencil, Play, Plus, Power, Sparkles, Trash2, UserRoundX, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import { Btn, EmptyState, Field, Modal, Notice, Pagination, inputCls } from "@/components/club/ui";
import { INCENTIVE_KINDS, REWARD_TYPES, apiError, fmtMoney, isJalaliDate, parseAmount, toEnDigits, toFaDigits } from "@/lib/club";

interface Plan {
  id: number; kind: string; kind_display: string; title: string; is_active: boolean;
  reward_type: string; reward_type_display: string; value: number; max_discount: number | null;
  gift_text: string; min_purchase: number; valid_days: number; inactive_days: number; days_before: number;
  message: string; starts_on: string; ends_on: string; max_grants: number | null; grants_count: number;
  used_count: number; active_count: number; description: string;
}
interface Reward {
  id: number; kind_display: string; title: string; description: string; status: string; status_display: string;
  customer_name: string; customer_phone: string; issued_jalali: string; valid_until_jalali: string; used_jalali: string;
}

const KIND_ICON: Record<string, React.ElementType> = {
  FIRST_PURCHASE: Sparkles, WINBACK: UserRoundX, BIRTHDAY: Cake, ANNIVERSARY: Heart,
};

const blank = {
  kind: "FIRST_PURCHASE", title: "", is_active: true, reward_type: "PERCENT", value: "", max_discount: "",
  gift_text: "", min_purchase: "", valid_days: "30", inactive_days: "60", days_before: "0", message: "",
  starts_on: "", ends_on: "", max_grants: "",
};

export default function IncentivesPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"plans" | "rewards">("plans");
  const [form, setForm] = useState<typeof blank>(blank);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rCount, setRCount] = useState(0);
  const [rPage, setRPage] = useState(1);
  const [rStatus, setRStatus] = useState("");
  const [rLoading, setRLoading] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.get("/loyalty/owner/incentives/");
      setPlans(res.data);
    } catch (e) {
      toast.error(apiError(e, "دریافت طرح‌ها ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRewards = useCallback(async () => {
    setRLoading(true);
    try {
      const res = await api.get("/loyalty/owner/rewards/", { params: { page: rPage, status: rStatus || undefined } });
      setRewards(res.data.results);
      setRCount(res.data.count);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRLoading(false);
    }
  }, [rPage, rStatus]);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { if (tab === "rewards") loadRewards(); }, [tab, loadRewards]);

  const openForm = (kind: string, plan?: Plan) => {
    setEditing(plan || null);
    setForm(plan ? {
      kind: plan.kind, title: plan.title, is_active: plan.is_active, reward_type: plan.reward_type,
      value: String(plan.value || ""), max_discount: plan.max_discount ? String(plan.max_discount) : "",
      gift_text: plan.gift_text, min_purchase: plan.min_purchase ? String(plan.min_purchase) : "",
      valid_days: String(plan.valid_days), inactive_days: String(plan.inactive_days), days_before: String(plan.days_before),
      message: plan.message, starts_on: plan.starts_on || "", ends_on: plan.ends_on || "",
      max_grants: plan.max_grants ? String(plan.max_grants) : "",
    } : { ...blank, kind, title: INCENTIVE_KINDS.find((k) => k.value === kind)?.label || "" });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("عنوان طرح را وارد کنید.");
    for (const k of ["starts_on", "ends_on"] as const) {
      if (form[k] && !isJalaliDate(form[k])) return toast.error("تاریخ را به شکل ۱۴۰۵/۰۱/۰۱ وارد کنید.");
    }
    const num = (v: string) => (v ? Number(toEnDigits(v).replace(/[^\d]/g, "")) : null);
    const payload = {
      kind: form.kind, title: form.title.trim(), is_active: form.is_active, reward_type: form.reward_type,
      value: form.reward_type === "GIFT" ? 0 : form.reward_type === "PERCENT" ? num(form.value) || 0 : parseAmount(form.value),
      max_discount: form.reward_type === "PERCENT" ? num(form.max_discount) : null,
      gift_text: form.reward_type === "GIFT" ? form.gift_text : "",
      min_purchase: parseAmount(form.min_purchase || "0"),
      valid_days: num(form.valid_days) ?? 30, inactive_days: num(form.inactive_days) ?? 60,
      days_before: num(form.days_before) ?? 0, message: form.message,
      starts_on: toEnDigits(form.starts_on) || null, ends_on: toEnDigits(form.ends_on) || null,
      max_grants: num(form.max_grants),
    };
    setSaving(true);
    try {
      if (editing) await api.patch(`/loyalty/owner/incentives/${editing.id}/`, payload);
      else await api.post("/loyalty/owner/incentives/", payload);
      toast.success("طرح ذخیره شد.");
      setFormOpen(false);
      loadPlans();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Plan) => {
    try {
      await api.patch(`/loyalty/owner/incentives/${p.id}/`, { is_active: !p.is_active });
      loadPlans();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (p: Plan) => {
    if (!window.confirm(`طرح «${p.title}» حذف شود؟ هدیه‌هایی که قبلاً داده شده باقی می‌مانند.`)) return;
    try {
      const res = await api.delete(`/loyalty/owner/incentives/${p.id}/`);
      if (res.data?.deactivated) toast.info("این طرح قبلاً هدیه داده، برای همین حذف نشد و غیرفعال شد.");
      loadPlans();
    } catch (e) { toast.error(apiError(e)); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await api.post("/loyalty/owner/incentives/run/");
      toast.success(res.data.total ? `${toFaDigits(res.data.total)} هدیه‌ی جدید صادر شد.` : "هدیه‌ی جدیدی برای امروز وجود نداشت.");
      loadPlans();
      if (tab === "rewards") loadRewards();
    } catch (e) { toast.error(apiError(e)); } finally { setRunning(false); }
  };

  const cancelReward = async (r: Reward) => {
    if (!window.confirm(`هدیه‌ی «${r.title}» برای ${r.customer_name || r.customer_phone} لغو شود؟`)) return;
    try {
      await api.post(`/loyalty/owner/rewards/${r.id}/cancel/`);
      loadRewards();
    } catch (e) { toast.error(apiError(e)); }
  };

  const kindHint = INCENTIVE_KINDS.find((k) => k.value === form.kind)?.hint;

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <ClubHeader
        title="طرح‌های تشویقی"
        subtitle="تخفیف اولین خرید، هدیه‌ی بازگشت مشتری، تولد و سالگرد ازدواج"
        actions={<Btn variant="outline" onClick={runNow} loading={running}><Play className="h-4 w-4" /> اجرای همین حالا</Btn>}
      />

      <Notice>
        تخفیف‌ها روی هم جمع نمی‌شوند؛ در هر خرید بهترین گزینه بین اشتراک VIP، کد تخفیف، طرح اولین خرید و هدیه‌های مشتری انتخاب می‌شود.
        هدیه‌های تولد، سالگرد و فراموشی روزی یک بار خودکار صادر می‌شوند و استفاده از آن‌ها کد خرید مشتری را لازم دارد.
      </Notice>

      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm border border-gray-100" role="tablist">
        {([["plans", "طرح‌ها"], ["rewards", "هدیه‌های صادرشده"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors ${tab === k ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "plans" ? (
        loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {INCENTIVE_KINDS.map((k) => {
              const Icon = KIND_ICON[k.value];
              const list = plans.filter((p) => p.kind === k.value);
              return (
                <section key={k.value} className="flex flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saffron-50 text-saffron-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-black text-brand-900">{k.label}</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{k.hint}</p>
                      </div>
                    </div>
                    <Btn variant="outline" className="h-10 shrink-0 px-3" onClick={() => openForm(k.value)}><Plus className="h-4 w-4" /> طرح</Btn>
                  </div>
                  {list.length === 0 ? (
                    <p className="rounded-2xl bg-gray-50 py-6 text-center text-sm text-gray-500">هنوز طرحی تعریف نشده.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.map((p) => (
                        <li key={p.id} className={`rounded-2xl border p-3 ${p.is_active ? "border-brand-100 bg-brand-50/40" : "border-gray-100 bg-gray-50 opacity-70"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-gray-900">{p.title}</p>
                              <p className="mt-0.5 text-sm font-bold text-saffron-700">{toFaDigits(p.description)}</p>
                              <p className="mt-1 text-[11px] text-gray-500">
                                {p.min_purchase ? `حداقل خرید ${fmtMoney(p.min_purchase)} · ` : ""}
                                {p.kind !== "FIRST_PURCHASE" && p.reward_type !== "CREDIT" ? `اعتبار ${toFaDigits(p.valid_days)} روز · ` : ""}
                                {p.kind === "WINBACK" ? `بعد از ${toFaDigits(p.inactive_days)} روز بدون خرید · ` : ""}
                                {(p.kind === "BIRTHDAY" || p.kind === "ANNIVERSARY") && p.days_before ? `${toFaDigits(p.days_before)} روز قبل · ` : ""}
                                صادرشده {toFaDigits(p.grants_count)} · استفاده‌شده {toFaDigits(p.used_count)}
                              </p>
                            </div>
                            <div className="flex shrink-0">
                              <button aria-label={p.is_active ? "غیرفعال کردن" : "فعال کردن"} onClick={() => toggle(p)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-100"}`}>
                                <Power className="h-4 w-4" />
                              </button>
                              <button aria-label="ویرایش" onClick={() => openForm(p.kind, p)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                              <button aria-label="حذف" onClick={() => remove(p)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : (
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 p-4">
            {[["", "همه"], ["active", "فعال"], ["used", "استفاده‌شده"], ["expired", "منقضی"]].map(([v, l]) => (
              <button key={v} onClick={() => { setRPage(1); setRStatus(v); }}
                className={`min-h-9 rounded-full px-4 text-xs font-bold ${rStatus === v ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{l}</button>
            ))}
          </div>
          {rLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
          ) : rewards.length === 0 ? (
            <EmptyState icon={Gift} title="هدیه‌ای صادر نشده" text="بعد از تعریف طرح، هدیه‌ها خودکار برای مشتریان صادر می‌شوند." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {rewards.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">{r.customer_name || "بدون نام"} <span className="text-xs font-normal text-gray-500" dir="ltr">{r.customer_phone}</span></p>
                    <p className="mt-0.5 text-sm text-gray-600">{r.kind_display} · {toFaDigits(r.description)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      صدور {toFaDigits(r.issued_jalali)}{r.valid_until_jalali ? ` · اعتبار تا ${toFaDigits(r.valid_until_jalali)}` : ""}{r.used_jalali ? ` · استفاده ${toFaDigits(r.used_jalali)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${r.status === "ACTIVE" && r.status_display === "فعال" ? "bg-emerald-50 text-emerald-700" : r.status === "USED" ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500"}`}>{r.status_display}</span>
                    {r.status === "ACTIVE" && r.status_display === "فعال" && (
                      <button onClick={() => cancelReward(r)} aria-label="لغو هدیه" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"><XCircle className="h-4 w-4" /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "rewards" && <Pagination page={rPage} count={rCount} pageSize={20} onChange={setRPage} />}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "ویرایش طرح" : `طرح جدید: ${INCENTIVE_KINDS.find((k) => k.value === form.kind)?.label}`} wide>
        <div className="space-y-4">
          {kindHint && <p className="text-sm text-gray-500">{kindHint}</p>}
          <Field label="عنوان طرح *"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>

          <div>
            <p className="mb-2 text-xs font-bold text-gray-600">نوع هدیه</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REWARD_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, reward_type: t.value })} aria-pressed={form.reward_type === t.value}
                  className={`min-h-11 rounded-xl border text-sm font-bold transition-colors ${form.reward_type === t.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-600 hover:border-brand-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {form.reward_type === "GIFT" ? (
              <Field label="شرح هدیه *" className="sm:col-span-2"><input className={inputCls} value={form.gift_text} onChange={(e) => setForm({ ...form, gift_text: e.target.value })} placeholder="مثلاً یک قهوه‌ی رایگان" /></Field>
            ) : (
              <Field label={form.reward_type === "PERCENT" ? "درصد تخفیف *" : "مبلغ (تومان) *"}>
                <input className={inputCls} dir="ltr" inputMode="numeric"
                  value={form.reward_type === "PERCENT" ? form.value : parseAmount(form.value) ? parseAmount(form.value).toLocaleString("en-US") : ""}
                  onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </Field>
            )}
            {form.reward_type === "PERCENT" && (
              <Field label="سقف تخفیف (تومان)" hint="خالی = بدون سقف">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(form.max_discount) ? parseAmount(form.max_discount).toLocaleString("en-US") : ""} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
              </Field>
            )}
            {form.reward_type !== "CREDIT" && (
              <Field label="حداقل مبلغ خرید (تومان)">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={parseAmount(form.min_purchase) ? parseAmount(form.min_purchase).toLocaleString("en-US") : ""} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(form.kind !== "FIRST_PURCHASE" || form.reward_type === "CREDIT") && (
              <Field label="مدت اعتبار هدیه (روز)" hint={form.reward_type === "CREDIT" ? "اعتبار بعد از این مدت منقضی می‌شود" : undefined}>
                <input className={inputCls} dir="ltr" inputMode="numeric" value={form.valid_days} onChange={(e) => setForm({ ...form, valid_days: e.target.value })} />
              </Field>
            )}
            {form.kind === "WINBACK" && (
              <Field label="بعد از چند روز بدون خرید؟">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={form.inactive_days} onChange={(e) => setForm({ ...form, inactive_days: e.target.value })} />
              </Field>
            )}
            {(form.kind === "BIRTHDAY" || form.kind === "ANNIVERSARY") && (
              <Field label="چند روز قبل از مناسبت؟" hint="۰ = همان روز">
                <input className={inputCls} dir="ltr" inputMode="numeric" value={form.days_before} onChange={(e) => setForm({ ...form, days_before: e.target.value })} />
              </Field>
            )}
            <Field label="سقف تعداد هدیه" hint="خالی = نامحدود">
              <input className={inputCls} dir="ltr" inputMode="numeric" value={form.max_grants} onChange={(e) => setForm({ ...form, max_grants: e.target.value })} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="تاریخ شروع (اختیاری)"><input className={inputCls} dir="ltr" placeholder="1405/01/01" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></Field>
            <Field label="تاریخ پایان (اختیاری)"><input className={inputCls} dir="ltr" placeholder="1405/12/29" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></Field>
          </div>

          {form.kind !== "FIRST_PURCHASE" && (
            <Field label="متن پیام به مشتری" hint="در اعلان سایت نمایش داده می‌شود و در مرحله‌ی سامانه‌ی پیامکی، پیامک هم می‌شود.">
              <textarea className={`${inputCls} h-24 py-2`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="مثلاً: تولدت مبارک! ۲۰٪ تخفیف هدیه‌ی ما برای خرید بعدی شماست." />
            </Field>
          )}

          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            طرح فعال است
          </label>
          <Btn className="w-full" onClick={save} loading={saving}>ذخیره‌ی طرح</Btn>
        </div>
      </Modal>
    </div>
  );
}
