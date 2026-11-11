"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Inbox, Loader2, Mail, MailOpen, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, EmptyState, StatCard } from "@/components/club/ui";
import { apiError, toFaDigits } from "@/lib/club";

type Msg = {
  id: number; name: string; phone: string; role: string; role_label?: string;
  subject: string; subject_label?: string; message: string; is_read: boolean; created_at: string;
};
type Filter = "all" | "unread" | "read";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "unread", label: "خوانده‌نشده" },
  { id: "read", label: "خوانده‌شده" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });

/** صندوق پیام‌های فرم «تماس با ما» (ادمین) */
export default function AdminMessagesPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [count, setCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const params = filter === "all" ? {} : { is_read: filter === "read" ? "true" : "false" };
      const d = (await api.get("/cms/admin/contact-messages/", { params })).data;
      setItems(d.results || []);
      setCount(d.count ?? 0);
      setUnread(d.unread ?? 0);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (m: Msg) => {
    setBusy(m.id);
    try {
      await api.patch(`/cms/admin/contact-messages/${m.id}/`, { is_read: !m.is_read });
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <div>
        <p className="text-xs font-bold text-saffron-700">مدیریت سایت</p>
        <h1 className="mt-1 text-2xl font-black text-brand-900">پیام‌های تماس</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="خوانده‌نشده" value={toFaDigits(unread)} icon={Mail} tone={unread ? "saffron" : "emerald"} />
        <StatCard label={filter === "all" ? "کل پیام‌ها" : "نتیجه‌ی فیلتر"} value={toFaDigits(count)} icon={Inbox} tone="brand" />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" role="tablist">
        {FILTERS.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${filter === id ? "bg-brand-700 text-white" : "text-gray-500 hover:text-brand-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : items.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <EmptyState icon={Inbox} title="پیامی وجود ندارد" text="پیام‌های فرم صفحه‌ی تماس با ما اینجا نمایش داده می‌شوند." />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${m.is_read ? "border-gray-100" : "border-saffron-300 ring-1 ring-saffron-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-black text-gray-900">
                    {!m.is_read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-saffron-500" aria-label="خوانده‌نشده" />}
                    <span className="truncate">{m.name}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {m.subject_label || m.subject}
                    {m.role_label ? ` · ${m.role_label}` : ""} · {fmtDate(m.created_at)}
                  </p>
                </div>
                <a href={`tel:${m.phone}`} dir="ltr"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-700 hover:bg-brand-100">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {m.phone}
                </a>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-loose text-gray-800">{m.message}</p>
              <div className="mt-3 flex justify-end">
                <Btn variant="outline" loading={busy === m.id} onClick={() => toggle(m)}>
                  {m.is_read ? <><MailOpen className="h-4 w-4" /> علامت‌گذاری به‌عنوان خوانده‌نشده</> : <><CheckCheck className="h-4 w-4" /> خوانده شد</>}
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
