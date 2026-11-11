"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle, Megaphone, Send } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo, toFaDigits } from "./notificationUtils";

interface Broadcast {
  id: number;
  audience: "ALL" | "CLIENTS" | "OWNERS";
  audience_display: string;
  title: string;
  message: string;
  link: string;
  recipients_count: number;
  sender_name: string;
  created_at: string;
}

const AUDIENCES = [
  { id: "ALL", label: "همه‌ی کاربران", desc: "مشتری‌ها و صاحبان کسب‌وکار" },
  { id: "CLIENTS", label: "فقط مشتری‌ها", desc: "کاربران عادی سایت" },
  { id: "OWNERS", label: "فقط کسب‌وکارها", desc: "صاحبان کسب‌وکار" },
] as const;

const EMPTY = { audience: "ALL", title: "", message: "", link: "" };

/** ارسال اعلان همگانی از پنل ادمین + تاریخچه‌ی ارسال‌ها */
export default function BroadcastPanel() {
  const [form, setForm] = useState(EMPTY);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/notifications/admin/broadcasts/");
      setHistory(data.results ?? data);
    } catch {
      /* تاریخچه خالی می‌ماند */
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const audienceLabel = AUDIENCES.find((a) => a.id === form.audience)?.label;
    if (!window.confirm(`این اعلان برای «${audienceLabel}» ارسال شود؟ قابل برگشت نیست.`)) return;
    setSending(true);
    setErrors({});
    setSuccess(null);
    try {
      const { data } = await api.post<Broadcast>("/notifications/admin/broadcasts/", form);
      setSuccess(`اعلان برای ${toFaDigits(data.recipients_count)} نفر ارسال شد.`);
      setForm(EMPTY);
      loadHistory();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[] | string> } }).response?.data;
      if (data && typeof data === "object") {
        setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
      } else {
        setErrors({ non_field_errors: "ارسال اعلان با خطا مواجه شد." });
      }
    } finally {
      setSending(false);
    }
  };

  const field = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
          <Megaphone className="h-5 w-5 text-fuchsia-600" />
          ارسال اعلان همگانی
        </h2>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-gray-700">مخاطب</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AUDIENCES.map((a) => (
              <label
                key={a.id}
                className={`cursor-pointer rounded-xl border-2 p-3 transition ${form.audience === a.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-brand-200"}`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={a.id}
                  checked={form.audience === a.id}
                  onChange={() => setForm({ ...form, audience: a.id })}
                  className="sr-only"
                />
                <span className="block text-sm font-black text-gray-800">{a.label}</span>
                <span className="block text-xs text-gray-500">{a.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="bc-title" className="mb-2 block text-sm font-bold text-gray-700">عنوان *</label>
          <input id="bc-title" required maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} placeholder="مثلاً: جشنواره‌ی تخفیف آخر هفته" />
          {errors.title && <p className="mt-1 text-xs text-rose-600">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="bc-message" className="mb-2 block text-sm font-bold text-gray-700">متن</label>
          <textarea id="bc-message" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field} placeholder="توضیح کوتاه اعلان..." />
        </div>

        <div>
          <label htmlFor="bc-link" className="mb-2 block text-sm font-bold text-gray-700">لینک داخلی (اختیاری)</label>
          <input id="bc-link" dir="ltr" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={`${field} text-left`} placeholder="/daily-discounts" />
          <p className="mt-1 text-xs text-gray-400">فقط آدرس صفحات خود سایت، که با / شروع می‌شود.</p>
          {errors.link && <p className="mt-1 text-xs text-rose-600">{errors.link}</p>}
        </div>

        {errors.non_field_errors && <p className="text-sm text-rose-600">{errors.non_field_errors}</p>}
        {success && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand-700">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={sending || !form.title.trim()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          ارسال اعلان
        </button>
      </form>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
        <h3 className="mb-4 font-black text-gray-900">ارسال‌های قبلی</h3>
        {loadingHistory ? (
          <div className="flex justify-center py-10 text-gray-400"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
        ) : history.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">هنوز اعلان همگانی ارسال نشده است.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((b) => (
              <li key={b.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-black text-gray-800">{b.title}</span>
                  <span className="shrink-0 rounded-md bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-600">{b.audience_display}</span>
                </div>
                {b.message && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{b.message}</p>}
                <p className="mt-2 text-[11px] text-gray-400">
                  {toFaDigits(b.recipients_count)} گیرنده · {b.sender_name} · {timeAgo(b.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
