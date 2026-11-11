"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { create } from "zustand";

/**
 * پیام کوچک پایین صفحه (جایگزین alert مرورگر).
 * استفاده:  import { toast } from "@/components/ui/toaster";
 *           toast.success("ذخیره شد")  ·  toast.error("خطا")  ·  toast.info("لطفاً ...")
 */
type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (type, message) => {
    const id = nextId++;
    set({ items: [...get().items.slice(-3), { id, type, message }] }); // حداکثر ۴ پیام هم‌زمان
    setTimeout(() => get().dismiss(id), type === "error" ? 6000 : 4000);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

const show = (type: ToastType) => (message: unknown) => {
  useToastStore.getState().push(type, typeof message === "string" && message ? message : "خطایی رخ داد.");
};

export const toast = {
  success: show("success"),
  error: show("error"),
  info: show("info"),
};

const STYLE: Record<ToastType, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "text-saffron-300" },
  error: { icon: CircleAlert, className: "text-rose-300" },
  info: { icon: Info, className: "text-sky-300" },
};

export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      role="status"
      dir="rtl"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const { icon: Icon, className } = STYLE[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-sm text-white shadow-2xl"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${className}`} />
              <span className="flex-1 leading-6">{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="بستن" className="shrink-0 rounded-md p-1 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
