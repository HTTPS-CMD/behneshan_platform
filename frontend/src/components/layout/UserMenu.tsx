"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  PROFILE_UPDATED_EVENT,
  type UserProfile,
  accountPageFor,
  initialOf,
  maskPhone,
  roleInfo,
} from "./profileUtils";

/** آواتار هدر پنل + منوی کشویی پروفایل (مشترک بین ادمین، مشتری و کسب‌وکار) */
export default function UserMenu() {
  const { role, logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get<UserProfile>("/identity/profile/");
      setProfile(data);
    } catch {
      /* اگر پروفایل نیامد، آواتار با آیکون پیش‌فرض نمایش داده می‌شود */
    }
  }, []);

  useEffect(() => {
    loadProfile();
    // بعد از ویرایش نام در صفحه‌ی حساب کاربری
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<Partial<UserProfile>>).detail;
      setProfile((p) => (p ? { ...p, ...detail } : p));
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, [loadProfile]);

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

  const effectiveRole = profile?.role || role;
  const info = roleInfo(effectiveRole);
  const name = profile?.full_name?.trim() || "کاربر چهارسوق";
  const initial = initialOf(profile?.full_name);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const items = [
    { href: accountPageFor(effectiveRole), label: "حساب کاربری", icon: UserRound },
    // «اعلان‌ها» و «صفحه‌ی اصلی سایت» در منوی کناری و زنگوله هستند؛ اینجا تکرار نمی‌شوند
  ];

  const Avatar = ({ size }: { size: "sm" | "lg" }) => (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-black ring-4 ${info.avatar} ${
        size === "sm" ? "h-10 w-10 text-base" : "h-12 w-12 text-lg"
      }`}
      aria-hidden="true"
    >
      {initial ?? <UserRound className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />}
    </span>
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`منوی حساب کاربری ${name}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:pl-2"
      >
        <Avatar size="sm" />
        <span className="hidden max-w-[140px] truncate text-sm font-bold text-gray-700 md:block">{name}</span>
        <ChevronDown className={`hidden h-4 w-4 text-gray-400 transition-transform md:block ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="menu"
            className="absolute left-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-brand-900/10"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 p-4">
              <Avatar size="lg" />
              <div className="min-w-0">
                <p className="truncate font-black text-gray-900">{name}</p>
                <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: "right" }}>{maskPhone(profile?.phone_number)}</p>
                <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${info.badge}`}>{info.label}</span>
              </div>
            </div>

            <nav className="p-2">
              {items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-brand-600"
                >
                  <Icon className="h-4 w-4 text-gray-400" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-rose-500 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                خروج از حساب
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
