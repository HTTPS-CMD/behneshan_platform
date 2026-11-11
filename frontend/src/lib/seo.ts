import type { Metadata } from "next";
import { mediaUrl } from "@/lib/format";

/** ابزارهای مشترک سئو (فقط سمت سرور استفاده شود) */

export const SITE_NAME = "چهارسوق";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://4sogh.shop").replace(/\/$/, "");
export const API_BASE =
  process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
export const INSTAGRAM_URL = "https://instagram.com/4soghtalk";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/brand/logo-full.png`;

/** آدرس کامل صفحه؛ مسیرهای فارسی درست انکود می‌شوند */
export const absUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

/** آدرس کامل تصویر (فایل آپلودی یا فایل public)؛ اگر نبود تصویر پیش‌فرض برند */
export const absImage = (path?: string | null) => {
  if (!path) return DEFAULT_OG_IMAGE;
  const full = mediaUrl(path);
  return /^https?:\/\//.test(full) ? full : absUrl(full);
};

/** متن خام و کوتاه‌شده برای توضیح متا (بدون HTML و فاصله‌های اضافه) */
export const plainText = (v?: string | null, max = 160) => {
  const t = (v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
};

/** دریافت JSON از بک‌اند؛ در خطا null می‌دهد تا صفحه هرگز به‌خاطر سئو از کار نیفتد */
export async function getJson<T>(path: string, revalidate: number | false = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, revalidate === false ? { cache: "no-store" } : { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: absUrl(it.path),
  })),
});

/** مقادیر دستی ادمین برای یک صفحه (فیلد خالی = خودکار) */
export type SeoOverride = { title: string; description: string; canonical: string; og_image: string; noindex: boolean };

export type SeoSettings = {
  seo_default_og_image: string;
  seo_org_name: string;
  seo_org_logo: string;
  seo_org_phone: string;
  seo_instagram: string;
  seo_google_verification: string;
  seo_bing_verification: string;
  seo_robots_disallow: string;
};

// تغییرات پنل حداکثر تا یک دقیقه‌ی بعد روی سایت دیده می‌شود
export const getSeoOverride = (type: "static" | "business" | "category" | "location", key: string) =>
  getJson<SeoOverride>(`/seo/public/page/?type=${type}&key=${encodeURIComponent(key)}`, 60);

export const getSeoSettings = () => getJson<SeoSettings>("/seo/public/settings/", 60);

/** مقدار دستی ادمین را (اگر پر باشد) روی متادیتای خودکار صفحه می‌نشاند */
export function applySeoOverride(base: Metadata, o: SeoOverride | null): Metadata {
  if (!o) return base;
  const out: Metadata = { ...base };
  if (o.title) {
    out.title = { absolute: o.title };
    out.openGraph = { ...out.openGraph, title: o.title } as Metadata["openGraph"];
    out.twitter = { ...out.twitter, title: o.title } as Metadata["twitter"];
  }
  if (o.description) {
    out.description = o.description;
    out.openGraph = { ...out.openGraph, description: o.description } as Metadata["openGraph"];
    out.twitter = { ...out.twitter, description: o.description } as Metadata["twitter"];
  }
  if (o.canonical) {
    out.alternates = { ...out.alternates, canonical: o.canonical.startsWith("/") ? absUrl(o.canonical) : o.canonical };
  }
  if (o.og_image) {
    const img = absImage(o.og_image);
    out.openGraph = { ...out.openGraph, images: [{ url: img }] } as Metadata["openGraph"];
    out.twitter = { ...out.twitter, images: [img] } as Metadata["twitter"];
  }
  if (o.noindex) out.robots = { index: false, follow: true };
  return out;
}
