"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/** بازگشت به صفحه‌ی قبل؛ اگر تاریخچه‌ای نباشد به صفحه‌ی اصلی می‌رود */
export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
    >
      <ArrowRight className="h-4 w-4" aria-hidden="true" /> بازگشت
    </button>
  );
}
