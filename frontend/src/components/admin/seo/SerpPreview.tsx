"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { mediaUrl } from "@/lib/format";

/** پیش‌نمایش نتیجه‌ی گوگل و کارت اشتراک‌گذاری؛ برش متن با همان حدّ پیشنهادی نمره‌دهی (۶۰ و ۱۶۰ نویسه) */

const cut = (v: string, max: number) => (v.length > max ? `${v.slice(0, max - 1).trim()}…` : v);

function crumbs(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    return [u.host, ...parts].join(" › ");
  } catch {
    return url;
  }
}

export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const mobile = mode === "mobile";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black text-gray-600">پیش‌نمایش در گوگل</p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="نوع دستگاه">
          {([["desktop", "دسکتاپ", Monitor], ["mobile", "موبایل", Smartphone]] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-xs font-bold ${mode === id ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div dir="rtl" className={`rounded-xl border border-gray-200 bg-white p-4 ${mobile ? "max-w-[360px]" : "max-w-[620px]"}`}>
        <div className="mb-1 flex items-center gap-2" dir="ltr">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" className="h-5 w-5 object-contain" />
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-xs leading-tight text-gray-800">چهارسوق</p>
            <p className="truncate text-[11px] leading-tight text-gray-500">{crumbs(url)}</p>
          </div>
        </div>
        <p className={`font-medium leading-snug text-[#1a0dab] ${mobile ? "line-clamp-2 text-[17px]" : "truncate text-xl"}`}>
          {cut(title, 60) || "عنوان صفحه"}
        </p>
        <p className={`mt-1 text-sm leading-relaxed text-[#4d5156] ${mobile ? "line-clamp-3" : "line-clamp-2"}`}>
          {cut(description, 160) || "توضیح متا اینجا نمایش داده می‌شود."}
        </p>
      </div>
    </div>
  );
}

export function SocialPreview({ title, description, image, url }: { title: string; description: string; image: string; url: string }) {
  let host = "4sogh.shop";
  try { host = new URL(url).host; } catch { /* آدرس نامعتبر؛ مقدار پیش‌فرض */ }
  const src = image ? mediaUrl(image) : "";

  return (
    <div>
      <p className="mb-2 text-xs font-black text-gray-600">پیش‌نمایش اشتراک‌گذاری (تلگرام، واتساپ، ایتا و…)</p>
      <div dir="rtl" className="max-w-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex aspect-[1.91/1] items-center justify-center bg-gray-100">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="px-6 text-center text-xs font-medium text-gray-400">بدون تصویر اختصاصی؛ لوگوی برند چهارسوق نمایش داده می‌شود</p>
          )}
        </div>
        <div className="p-3">
          <p className="text-[11px] font-bold uppercase text-gray-400" dir="ltr">{host}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-black text-gray-900">{title || "عنوان صفحه"}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{description || "توضیح صفحه"}</p>
        </div>
      </div>
    </div>
  );
}
