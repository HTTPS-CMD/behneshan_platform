"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

/**
 * کارت «کد خرید حضوری» در پنل مشتری.
 * مشتری موقع خرید از فروشگاه، این کد ۶ رقمی را به فروشنده نشان می‌دهد تا تخفیفش اعمال شود.
 * کد ۵ دقیقه اعتبار دارد و فقط یک بار قابل استفاده است.
 */
export default function PurchaseCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    if (secondsLeft <= 0) {
      setCode(null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [code, secondsLeft]);

  const generate = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.post("/directory/client/purchase-code/");
      setCode(res.data.code);
      setSecondsLeft(res.data.expires_in || 300);
    } catch (e: any) {
      setError(e.response?.data?.error || "دریافت کد با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="col-span-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5 justify-between">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-xl bg-saffron-50 text-saffron-700 flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-gray-900 text-lg">کد خرید حضوری</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            موقع خرید از فروشگاه‌های چهارسوق، این کد را به فروشنده نشان دهید تا تخفیف شما اعمال شود.
            <span className="inline-flex items-center gap-1 text-brand-700 font-bold mr-1">
              <ShieldCheck className="w-4 h-4" /> هیچ‌کس بدون این کد نمی‌تواند به نام شما خرید ثبت کند.
            </span>
          </p>
          {error && <p className="text-sm text-rose-700 font-bold mt-2">{error}</p>}
        </div>
      </div>

      {code ? (
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div
            dir="ltr"
            aria-live="polite"
            className="bg-brand-900 text-saffron-300 font-black text-3xl tracking-[0.35em] px-6 py-3 rounded-2xl tabular-nums"
          >
            {code}
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
            <span>اعتبار: <span className="tabular-nums" dir="ltr">{mm}:{ss}</span></span>
            <button
              type="button"
              onClick={generate}
              disabled={isLoading}
              className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-900 min-h-11 px-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> کد جدید
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          className="shrink-0 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-colors disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
          دریافت کد خرید
        </button>
      )}
    </div>
  );
}
