"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Bell, BellOff, CheckCheck, Inbox, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  type AppNotification,
  type UnreadCountResponse,
  getCategoryStyle,
  isSafeLink,
  isSoundEnabled,
  notificationsPageFor,
  playNotificationSound,
  setSoundEnabled,
  timeAgo,
  toFaDigits,
} from "./notificationUtils";

const POLL_MS = 30_000; // هر ۳۰ ثانیه تعداد نخوانده‌ها چک می‌شود (فقط وقتی تب باز و فعال است)
const DROPDOWN_SIZE = 8;

export default function NotificationBell() {
  const router = useRouter();
  const { role } = useAuthStore();
  const bellControls = useAnimationControls();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState(false);
  const [sound, setSound] = useState(true);
  const [toast, setToast] = useState<AppNotification | null>(null);

  const lastSeenId = useRef<number | null>(null); // آخرین اعلانی که دیده‌ایم؛ برای تشخیص «اعلان جدید رسید»
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSound(isSoundEnabled()), []);

  // ---- چک کردن تعداد نخوانده‌ها ----
  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get<UnreadCountResponse>("/notifications/unread-count/");
      setUnread(data.unread);
      const latestId = data.latest?.id ?? null;
      // بار اول فقط مقدار را نگه می‌داریم؛ از بار دوم اگر شناسه‌ی جدیدتری آمد یعنی اعلان تازه رسیده
      if (lastSeenId.current !== null && latestId !== null && latestId > lastSeenId.current) {
        playNotificationSound();
        bellControls.start({ rotate: [0, -18, 16, -12, 8, -4, 0], transition: { duration: 0.8 } });
        setToast(data.latest);
      }
      if (latestId !== null && (lastSeenId.current === null || latestId > lastSeenId.current)) {
        lastSeenId.current = latestId;
      } else if (lastSeenId.current === null) {
        lastSeenId.current = 0;
      }
    } catch {
      /* خطای شبکه: در دور بعدی دوباره تلاش می‌شود */
    }
  }, [bellControls]);

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchUnread();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && fetchUnread();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchUnread]);

  // toast بعد از ۵ ثانیه بسته می‌شود
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- لیست کشویی ----
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setError(false);
    try {
      const { data } = await api.get("/notifications/", { params: { page_size: DROPDOWN_SIZE } });
      setItems(data.results ?? data);
    } catch {
      setError(true);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const toggleOpen = () => {
    setOpen((prev) => {
      if (!prev) fetchList();
      return !prev;
    });
  };

  // بستن با کلیک بیرون یا Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (n: AppNotification) => {
    if (!n.is_read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.post(`/notifications/${n.id}/read/`).catch(() => fetchUnread());
    }
  };

  const openNotification = (n: AppNotification) => {
    markRead(n);
    setOpen(false);
    setToast(null);
    if (isSafeLink(n.link)) router.push(n.link);
  };

  const markAllRead = async () => {
    setItems((list) => list.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    try {
      await api.post("/notifications/read-all/");
    } catch {
      fetchUnread();
    }
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playNotificationSound();
  };

  const badge = unread > 99 ? "+۹۹" : toFaDigits(unread);

  return (
    <div className="relative" ref={wrapperRef}>
      <motion.button
        type="button"
        onClick={toggleOpen}
        animate={bellControls}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `اعلان‌ها، ${toFaDigits(unread)} نخوانده` : "اعلان‌ها"}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          open ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-gray-50 hover:text-brand-600"
        }`}
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white"
            >
              {badge}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ---- باکس کشویی ---- */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="dialog"
            aria-label="اعلان‌ها"
            className="fixed inset-x-3 top-[84px] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-brand-900/10 sm:absolute sm:inset-x-auto sm:left-0 sm:top-14 sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-900">اعلان‌ها</span>
                {unread > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">{toFaDigits(unread)} جدید</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSound}
                  title={sound ? "بی‌صدا کردن" : "فعال کردن صدا"}
                  aria-label={sound ? "بی‌صدا کردن اعلان‌ها" : "فعال کردن صدای اعلان‌ها"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
                >
                  {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <CheckCheck className="h-4 w-4" />
                  خواندن همه
                </button>
              </div>
            </div>

            <div className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain">
              {loadingList && items.length === 0 ? (
                <div className="flex justify-center py-12 text-gray-500">
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-500">
                  <BellOff className="h-6 w-6" />
                  دریافت اعلان‌ها با خطا مواجه شد.
                  <button onClick={fetchList} className="font-bold text-brand-600 hover:underline">تلاش دوباره</button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-gray-500">
                  <Inbox className="h-8 w-8" />
                  هنوز اعلانی ندارید
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {items.map((n, i) => {
                    const { icon: Icon, className } = getCategoryStyle(n.category);
                    return (
                      <motion.li
                        key={n.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <button
                          type="button"
                          onClick={() => openNotification(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-right transition hover:bg-gray-50 ${n.is_read ? "" : "bg-brand-50/40"}`}
                        >
                          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${className}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm leading-6 ${n.is_read ? "font-medium text-gray-700" : "font-black text-gray-900"}`}>
                              {n.title}
                            </span>
                            {n.message && <span className="line-clamp-2 block text-xs leading-5 text-gray-500">{n.message}</span>}
                            <span className="mt-1 block text-[11px] text-gray-500">{timeAgo(n.created_at)}</span>
                          </span>
                          {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="نخوانده" />}
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Link
              href={notificationsPageFor(role)}
              onClick={() => setOpen(false)}
              className="block border-t border-gray-100 py-3 text-center text-sm font-bold text-gray-600 transition hover:bg-gray-50 hover:text-brand-600"
            >
              مشاهده‌ی همه‌ی اعلان‌ها
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- toast اعلان تازه ---- */}
      <AnimatePresence>
        {toast && !open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={() => openNotification(toast)}
            role="status"
            className="fixed bottom-5 left-1/2 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 items-start gap-3 rounded-2xl bg-brand-900 p-4 text-right text-white shadow-2xl"
          >
            {(() => {
              const { icon: Icon } = getCategoryStyle(toast.category);
              return (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300">
                  <Icon className="h-5 w-5" />
                </span>
              );
            })()}
            <span className="min-w-0">
              <span className="block text-sm font-black">{toast.title}</span>
              {toast.message && <span className="line-clamp-2 block text-xs text-brand-200">{toast.message}</span>}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
