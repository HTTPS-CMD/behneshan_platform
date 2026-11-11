import type { MetadataRoute } from "next";
import { SITE_URL, getSeoSettings } from "@/lib/seo";

// مسیرهای اضافه‌ی ادمین (پنل ← سئو ← تنظیمات کلی) هر بار خوانده می‌شود، پس موقع بیلد ثابت نمی‌شود
export const dynamic = "force-dynamic";

// robots.txt: صفحات عمومی برای موتورهای جستجو باز و پنل‌ها بسته‌اند
const BASE_DISALLOW = ["/dashboard", "/admin-panel", "/login", "/register", "/api"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSeoSettings();
  const extra = (settings?.seo_robots_disallow || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("/") && l !== "/");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: Array.from(new Set([...BASE_DISALLOW, ...extra])),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
