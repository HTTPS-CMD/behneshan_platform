"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, inputCls } from "@/components/club/ui";
import { JALALI_MONTHS } from "@/lib/club";

export interface Audience {
  label?: string; birth_month?: string; marital_status?: string; has_credit?: string;
  has_account?: string; inactive_days?: string; min_purchases?: string; segment?: string;
}

/** انتخاب مخاطبان (مشتریان خود فروشگاه) برای ارسال پیامک */
export default function AudienceFilters({ value, onChange, segments }: {
  value: Audience; onChange: (v: Audience) => void; segments?: { key: string; label: string }[];
}) {
  const [labels, setLabels] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    api.get("/loyalty/owner/labels/").then((r) => setLabels(r.data)).catch(() => {});
  }, []);
  const set = (k: keyof Audience, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {segments && segments.length > 0 && (
        <Field label="بخش‌بندی هوشمند" className="sm:col-span-2 lg:col-span-4">
          <select className={inputCls} value={value.segment || ""} onChange={(e) => set("segment", e.target.value)}>
            <option value="">همه‌ی مشتریان</option>
            {segments.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="برچسب">
        <select className={inputCls} value={value.label || ""} onChange={(e) => set("label", e.target.value)}>
          <option value="">همه</option>
          {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="ماه تولد">
        <select className={inputCls} value={value.birth_month || ""} onChange={(e) => set("birth_month", e.target.value)}>
          <option value="">همه</option>
          {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </Field>
      <Field label="وضعیت تأهل">
        <select className={inputCls} value={value.marital_status || ""} onChange={(e) => set("marital_status", e.target.value)}>
          <option value="">همه</option><option value="SINGLE">مجرد</option><option value="MARRIED">متأهل</option>
        </select>
      </Field>
      <Field label="اعتبار کیف‌پول">
        <select className={inputCls} value={value.has_credit || ""} onChange={(e) => set("has_credit", e.target.value)}>
          <option value="">همه</option><option value="1">فقط دارای اعتبار</option>
        </select>
      </Field>
      <Field label="بدون خرید در (روز اخیر)" hint="مثلاً ۳۰">
        <input className={inputCls} dir="ltr" inputMode="numeric" value={value.inactive_days || ""} onChange={(e) => set("inactive_days", e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="حداقل تعداد خرید">
        <input className={inputCls} dir="ltr" inputMode="numeric" value={value.min_purchases || ""} onChange={(e) => set("min_purchases", e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="حساب سایت">
        <select className={inputCls} value={value.has_account || ""} onChange={(e) => set("has_account", e.target.value)}>
          <option value="">همه</option><option value="1">عضو سایت</option><option value="0">بدون حساب</option>
        </select>
      </Field>
    </div>
  );
}
