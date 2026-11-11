"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Inbox, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { type AppNotification, getCategoryStyle, isSafeLink, timeAgo, toFaDigits } from "./notificationUtils";

type Filter = "all" | "unread";

/** صفحه‌ی کامل اعلان‌ها — مشترک بین پنل ادمین، مشتری و کسب‌وکار */
export default function NotificationsPanel() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (nextPage: number, currentFilter: Filter) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const { data } = await api.get("/notifications/", {
        params: { page: nextPage, ...(currentFilter === "unread" ? { unread: 1 } : {}) },
      });
      setItems((prev) => (nextPage === 1 ? data.results : [...prev, ...data.results]));
      setHasMore(Boolean(data.next));
      setTotal(data.count);
      setPage(nextPage);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(1, filter);
  }, [filter, load]);

  const open = (n: AppNotification) => {
    if (!n.is_read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      api.post(`/notifications/${n.id}/read/`).catch(() => {});
    }
    if (isSafeLink(n.link)) router.push(n.link);
  };

  const markAll = async () => {
    try {
      await api.post("/notifications/read-all/");
      if (filter === "unread") {
        setItems([]);
        setTotal(0);
        setHasMore(false);
      } else {
        setItems((list) => list.map((x) => ({ ...x, is_read: true })));
      }
    } catch {
      /* در صورت خطا چیزی تغییر نمی‌کند */
    }
  };

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
          <Bell className="h-5 w-5 text-brand-600" />
          اعلان‌های من
          {!loading && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">{toFaDigits(total)}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="فیلتر اعلان‌ها">
            {(["all", "unread"] as Filter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-lg px-4 text-sm font-bold transition ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {f === "all" ? "همه" : "نخوانده"}
              </button>
            ))}
          </div>
          <button
            onClick={markAll}
            disabled={!hasUnread}
            className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <CheckCheck className="h-4 w-4" />
            خواندن همه
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20 text-gray-500"><LoaderCircle className="h-7 w-7 animate-spin" /></div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-500">
          دریافت اعلان‌ها با خطا مواجه شد.
          <button onClick={() => load(1, filter)} className="font-bold text-brand-600 hover:underline">تلاش دوباره</button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-500">
          <Inbox className="h-10 w-10" />
          {filter === "unread" ? "همه‌ی اعلان‌ها را خوانده‌اید 👌" : "هنوز اعلانی ندارید"}
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          <AnimatePresence initial={false}>
            {items.map((n, i) => {
              const { icon: Icon, className } = getCategoryStyle(n.category);
              return (
                <motion.li key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <button
                    onClick={() => open(n)}
                    className={`flex w-full items-start gap-4 p-5 text-right transition hover:bg-gray-50 ${n.is_read ? "" : "bg-brand-50/40"}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${className}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${n.is_read ? "font-bold text-gray-700" : "font-black text-gray-900"}`}>{n.title}</span>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{n.category_display}</span>
                      </span>
                      {n.message && <span className="mt-1 block text-sm leading-6 text-gray-500">{n.message}</span>}
                      <span className="mt-1 block text-xs text-gray-500">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" aria-label="نخوانده" />}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {hasMore && !loading && (
        <div className="border-t border-gray-100 p-4 text-center">
          <button
            onClick={() => load(page + 1, filter)}
            disabled={loadingMore}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gray-50 px-5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}
            نمایش بیشتر
          </button>
        </div>
      )}
    </section>
  );
}
