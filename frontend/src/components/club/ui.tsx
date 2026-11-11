"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

/** کیت کوچک رابط کاربری برای صفحات باشگاه مشتریان */

export const inputCls =
  "no-focus-ring h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:ring-3 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400";

export function Field({ label, hint, error, children, className = "" }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-bold text-rose-700">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

type BtnVariant = "primary" | "accent" | "outline" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
  accent: "bg-saffron-500 text-brand-950 hover:bg-saffron-400 shadow-sm",
  outline: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "text-gray-600 hover:bg-gray-100",
  danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
};

export function Btn({ variant = "primary", loading, className = "", children, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // فقط یک بار هنگام باز شدن: فوکوس روی اولین فیلد فرم
    setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-modal-body] input:not([disabled]),[data-modal-body] select,[data-modal-body] textarea")?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" dir="rtl">
          <motion.div
            className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-black text-brand-900">{title}</h3>
              <button onClick={onClose} aria-label="بستن" className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div data-modal-body className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "brand" }: {
  label: string; value: string; sub?: string; icon: React.ElementType; tone?: "brand" | "saffron" | "emerald" | "rose";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600", saffron: "bg-saffron-50 text-saffron-700",
    emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-500">{label}</p>
        <p className="mt-1 truncate text-xl font-black text-gray-900">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export function Pagination({ page, count, pageSize, onChange }: {
  page: number; count: number; pageSize: number; onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4" dir="rtl">
      <button aria-label="صفحه قبل" disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-40">
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="text-sm font-bold text-gray-600">
        صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}
      </span>
      <button aria-label="صفحه بعد" disabled={page >= pages} onClick={() => onChange(page + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: {
  icon: React.ElementType; title: string; text?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-100 text-saffron-700">
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-black text-gray-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: React.ReactNode }) {
  const t = {
    info: "bg-brand-50 border-brand-100 text-brand-800",
    warn: "bg-saffron-50 border-saffron-200 text-saffron-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
  }[tone];
  return <div className={`rounded-2xl border p-4 text-sm font-medium leading-relaxed ${t}`}>{children}</div>;
}
