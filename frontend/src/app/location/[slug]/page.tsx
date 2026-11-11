import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TaxonomyLanding, { type LandingBusiness } from "@/components/site/TaxonomyLanding";
import { absUrl, applySeoOverride, getJson, getSeoOverride } from "@/lib/seo";

// صفحه‌ی فرود سئو برای هر محله؛ لیست کسب‌وکارها سمت سرور خوانده می‌شود
export const dynamic = "force-dynamic";

type Tax = { id: string; name: string; slug: string };
type Paged = { count: number; results: LandingBusiness[] };

async function load(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug);
  const all = await getJson<Tax[]>("/taxonomy/locations/", 300);
  const t = all?.find((x) => x.slug === slug);
  if (!t) return null;
  const list = await getJson<Paged>(`/directory/businesses/?location=${t.id}&page_size=50`, 300);
  return { t, businesses: list?.results ?? [], total: list?.count ?? 0 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "صفحه پیدا نشد | چهارسوق", robots: { index: false, follow: false } };
  const { t, total } = data;
  const title = `کسب‌وکارهای ${t.name} | چهارسوق`;
  const description = `فهرست کسب‌وکارهای ${t.name} در شبکه‌ی چهارسوق؛ آدرس، تماس، تخفیف و نظرات مشتریان.`;
  const url = absUrl(`/location/${encodeURIComponent(t.slug)}`);
  const base: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // صفحه‌ی بدون کسب‌وکار محتوای کم‌ارزش است؛ تا وقتی خالی است ایندکس نشود
    robots: total === 0 ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", locale: "fa_IR", siteName: "چهارسوق", title, description, url },
  };
  // مقدار دستی ادمین (پنل ← سئو) در صورت وجود جای مقدار خودکار می‌نشیند
  return applySeoOverride(base, await getSeoOverride("location", t.slug));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { t, businesses, total } = data;
  return (
    <TaxonomyLanding
      title={`کسب‌وکارهای ${t.name}`}
      subtitle={`کاسبان عضو چهارسوق در ${t.name}`}
      intro={`کسب‌وکارهای ${t.name} را در چهارسوق ببینید؛ آدرس، شماره تماس، تخفیف‌ها و نظرات مشتریان را مقایسه کنید و با کارت چهارسوق از تخفیف و کش‌بک استفاده کنید.`}
      path={`/location/${encodeURIComponent(t.slug)}`}
      businesses={businesses}
      total={total}
    />
  );
}
