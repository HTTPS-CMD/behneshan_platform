"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Send } from "lucide-react";
import { api } from "@/lib/api";
import { toEnDigits } from "@/lib/club";

/** فرم «تماس با ما» — پیام در صندوق پنل ادمین ثبت می‌شود */

const ROLES = [
  { value: "merchant", label: "کاسب" },
  { value: "customer", label: "مشتری" },
  { value: "org", label: "سازمان" },
  { value: "other", label: "سایر" },
];
const SUBJECTS = [
  { value: "merchant_signup", label: "ثبت‌نام کاسبان" },
  { value: "card", label: "خرید و ارتقای کارت" },
  { value: "ads", label: "تبلیغات و مشاوره" },
  { value: "cooperation", label: "همکاری" },
  { value: "feedback", label: "پیشنهاد و انتقاد" },
  { value: "other", label: "سایر" },
];

const MSG_SUCCESS = "پیام شما با موفقیت ثبت شد. همکاران چهارسوق به‌زودی با شما تماس می‌گیرند. ممنون که کنار ما هستید.";
const MSG_ERROR = "ارسال پیام انجام نشد. لطفاً اطلاعات را بررسی کنید و دوباره تلاش کنید.";
const MSG_RATE = "تعداد ارسال‌ها زیاد بود. لطفاً کمی بعد دوباره تلاش کنید.";
const MAX_MESSAGE = 2000;

type Fields = { name: string; phone: string; role: string; subject: string; message: string; website: string };
type Errors = Partial<Record<keyof Fields, string>>;
const EMPTY: Fields = { name: "", phone: "", role: "", subject: "", message: "", website: "" };

const inputCls =
  "w-full min-h-12 rounded-xl border border-cream-200 bg-white px-4 text-base text-brand-900 placeholder:text-brand-900/40 " +
  "outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 aria-[invalid=true]:border-rose-400";

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "نام و نام خانوادگی را وارد کنید.";
  if (!/^09\d{9}$/.test(toEnDigits(f.phone.trim()))) e.phone = "شماره موبایل را به‌صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.";
  if (!f.subject) e.subject = "موضوع پیام را انتخاب کنید.";
  if (f.message.trim().length < 5) e.message = "متن پیام را بنویسید.";
  return e;
}

export default function ContactForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "rate">("idle");

  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF((p) => ({ ...p, [k]: ev.target.value }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (status === "sending") return;
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("idle");
      return;
    }
    setStatus("sending");
    try {
      await api.post("/cms/contact/", {
        name: f.name.trim(),
        phone: toEnDigits(f.phone.trim()),
        role: f.role,
        subject: f.subject,
        message: f.message.trim(),
        website: f.website, // فیلد مخفی ضدربات؛ برای انسان همیشه خالی است
      });
      setF(EMPTY);
      setStatus("success");
    } catch (err: any) {
      const res = err?.response;
      if (res?.status === 429) {
        setStatus("rate");
        return;
      }
      // خطای فیلدها از سرور (مثلاً شماره نامعتبر)
      const d = res?.data;
      if (res?.status === 400 && d && typeof d === "object") {
        const next: Errors = {};
        (Object.keys(EMPTY) as (keyof Fields)[]).forEach((k) => {
          if (Array.isArray(d[k]) && d[k].length) next[k] = String(d[k][0]);
        });
        setErrors(next);
      }
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
        <p className="max-w-md text-base font-bold leading-loose text-emerald-900">{MSG_SUCCESS}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="min-h-11 rounded-xl px-5 text-sm font-bold text-brand-700 underline-offset-4 hover:underline"
        >
          ارسال پیام جدید
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-busy={sending}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className="mb-2 block text-sm font-bold text-brand-800">
            نام و نام خانوادگی <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <input id="cf-name" value={f.name} onChange={set("name")} disabled={sending} required autoComplete="name"
            maxLength={120} aria-invalid={!!errors.name} aria-describedby={errors.name ? "cf-name-err" : undefined} className={inputCls} />
          {errors.name && <p id="cf-name-err" className="mt-1.5 text-sm font-medium text-rose-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="cf-phone" className="mb-2 block text-sm font-bold text-brand-800">
            شماره موبایل <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <input id="cf-phone" value={f.phone} onChange={set("phone")} disabled={sending} required type="tel"
            inputMode="numeric" autoComplete="tel" dir="ltr" maxLength={11} placeholder="09123456789"
            aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "cf-phone-err" : undefined}
            className={`${inputCls} text-left`} />
          {errors.phone && <p id="cf-phone-err" className="mt-1.5 text-sm font-medium text-rose-600">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="cf-role" className="mb-2 block text-sm font-bold text-brand-800">
            نقش شما <span className="text-xs font-medium text-brand-900/50">(اختیاری)</span>
          </label>
          <select id="cf-role" value={f.role} onChange={set("role")} disabled={sending} className={`${inputCls} cursor-pointer`}>
            <option value="">انتخاب کنید</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="cf-subject" className="mb-2 block text-sm font-bold text-brand-800">
            موضوع پیام <span className="text-rose-600" aria-hidden="true">*</span>
          </label>
          <select id="cf-subject" value={f.subject} onChange={set("subject")} disabled={sending} required
            aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "cf-subject-err" : undefined}
            className={`${inputCls} cursor-pointer`}>
            <option value="">انتخاب کنید</option>
            {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {errors.subject && <p id="cf-subject-err" className="mt-1.5 text-sm font-medium text-rose-600">{errors.subject}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="cf-message" className="mb-2 block text-sm font-bold text-brand-800">
          متن پیام <span className="text-rose-600" aria-hidden="true">*</span>
        </label>
        <textarea id="cf-message" value={f.message} onChange={set("message")} disabled={sending} required rows={6}
          maxLength={MAX_MESSAGE} placeholder="پیام خود را اینجا بنویسید..."
          aria-invalid={!!errors.message} aria-describedby={errors.message ? "cf-message-err" : undefined}
          className={`${inputCls} resize-y py-3 leading-loose`} />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {errors.message ? <p id="cf-message-err" className="text-sm font-medium text-rose-600">{errors.message}</p> : <span />}
          <span className="shrink-0 text-xs text-brand-900/50" dir="ltr">{f.message.length}/{MAX_MESSAGE}</span>
        </div>
      </div>

      {/* تله‌ی ضدربات: برای کاربر دیده نمی‌شود و نباید پر شود */}
      <div aria-hidden="true" className="sr-only">
        <label>وب‌سایت<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      </div>

      {(status === "error" || status === "rate") && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-relaxed text-rose-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{status === "rate" ? MSG_RATE : MSG_ERROR}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-8 text-base font-black text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
      >
        {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5 -scale-x-100" aria-hidden="true" />}
        {sending ? "در حال ارسال..." : "ارسال پیام"}
      </button>
    </form>
  );
}
