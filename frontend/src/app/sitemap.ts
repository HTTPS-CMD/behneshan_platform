import type { MetadataRoute } from "next";
import { absUrl, getJson } from "@/lib/seo";

// هر بار از بک‌اند خوانده می‌شود تا کسب‌وکار تازه‌ثبت‌شده بلافاصله در سایت‌مپ بیاید (در زمان بیلد ثابت نشود)
export const dynamic = "force-dynamic";

type SitemapData = {
  businesses: { slug: string; updated_at: string }[];
  categories: { slug: string }[];
  locations: { slug: string }[];
  noindex_static?: string[];
};

const STATIC_PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/landing", priority: 0.8, changeFrequency: "weekly" },
  { path: "/daily-discounts", priority: 0.8, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms/client", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms/business", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getJson<SitemapData>("/seo/sitemap/", false);

  const hidden = new Set(data?.noindex_static ?? []);
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.filter((p) => !hidden.has(p.path)).map((p) => ({
    url: absUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  data?.categories?.forEach((c) =>
    entries.push({ url: absUrl(`/category/${encodeURIComponent(c.slug)}`), changeFrequency: "weekly", priority: 0.6 }),
  );
  data?.locations?.forEach((l) =>
    entries.push({ url: absUrl(`/location/${encodeURIComponent(l.slug)}`), changeFrequency: "weekly", priority: 0.6 }),
  );
  data?.businesses?.forEach((b) =>
    entries.push({
      url: absUrl(`/business/${encodeURIComponent(b.slug)}`),
      lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return entries;
}
