import Link from "next/link";
import Image from "next/image";
import logoMark from "../../../public/brand/logo-mark.webp";

/**
 * لوگوی چهارسوق.
 * - variant="mark": فقط نشان (طاق و بازار)
 * - variant="full": نشان + نام فارسی + شعار
 * - tone="dark": برای پس‌زمینه‌ی سرمه‌ای؛ نشان روی کاشی کرم قرار می‌گیرد تا رنگ‌هایش دیده شود
 */
type Props = {
  variant?: "mark" | "full";
  tone?: "light" | "dark";
  size?: number;
  href?: string | null;
  tagline?: string;
  className?: string;
};

export default function Logo({ variant = "full", tone = "light", size = 44, href = "/", tagline = "معرفی و رشد کسب‌وکارها", className = "" }: Props) {
  const mark = (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${tone === "dark" ? "rounded-2xl bg-cream p-1.5 shadow-lg shadow-black/20" : ""}`}
      style={{ width: size, height: size }}
    >
      {/* next/image نسخه‌ی کوچک‌شده‌ی لوگو را به اندازه‌ی نمایش می‌فرستد (به‌جای فایل کامل) */}
      <Image src={logoMark} alt="" width={size} height={size} sizes={`${size}px`} className="h-full w-full object-contain" />
    </span>
  );

  const content = (
    <span className={`group inline-flex items-center gap-3 ${className}`}>
      <span className="transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:-rotate-3 group-hover:scale-105">{mark}</span>
      {variant === "full" && (
        <span className="leading-tight">
          <span className={`block text-xl font-black tracking-tight ${tone === "dark" ? "text-cream" : "text-brand-800"}`}>چهارسوق</span>
          {tagline && <span className={`block text-[11px] font-semibold ${tone === "dark" ? "text-brand-200" : "text-saffron-700"}`}>{tagline}</span>}
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label={variant === "mark" ? "چهارسوق — صفحه‌ی اصلی" : undefined} className="rounded-xl focus-visible:outline-offset-4">
      {content}
    </Link>
  );
}
