import type { Metadata } from "next";
import JsonLd from "@/components/site/JsonLd";
import { absImage, absUrl, applySeoOverride, breadcrumbLd, getJson, getSeoOverride, plainText } from "@/lib/seo";

/**
 * متادیتا و اسکیمای سئوی صفحه‌ی هر کسب‌وکار.
 * خودِ page.tsx کلاینتی است و تغییر نکرده؛ این لایه‌ی سمت سرور فقط عنوان، توضیح، تصویر،
 * آدرس کانونیکال و JSON-LD را در HTML اولیه می‌گذارد تا گوگل آن‌ها را ببیند.
 */
type Biz = {
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  address?: string | null;
  public_phone?: string | null;
  instagram_id?: string | null;
  website?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  average_rating?: number;
  review_count?: number;
  category?: { name: string; slug: string } | null;
  location?: { name: string; slug: string } | null;
};

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

const load = (slug: string) => getJson<Biz>(`/directory/businesses/${encodeURIComponent(slug)}/`, 300);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const b = await load(slug);
  if (!b) return { title: "کسب‌وکار پیدا نشد | چهارسوق", robots: { index: false, follow: false } };

  const place = b.location?.name ? ` در ${b.location.name}` : "";
  const title = `${b.name}${place} | چهارسوق`;
  const description =
    plainText(b.description, 155) ||
    `${b.name}${b.category?.name ? `، ${b.category.name}` : ""}${place}. آدرس، شماره تماس، تخفیف‌ها و نظرات مشتریان را در چهارسوق ببینید.`;
  const url = absUrl(`/business/${encodeURIComponent(b.slug)}`);
  const image = absImage(b.banner || b.logo);

  const base: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "fa_IR", siteName: "چهارسوق", title, description, url, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
  // مقدار دستی ادمین (پنل ← سئو) در صورت وجود جای مقدار خودکار می‌نشیند
  return applySeoOverride(base, await getSeoOverride("business", b.slug));
}

export default async function BusinessLayout({ children, params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const b = await load(slug);

  let ld: Record<string, unknown>[] = [];
  if (b) {
    const url = absUrl(`/business/${encodeURIComponent(b.slug)}`);
    const sameAs = [
      b.instagram_id ? `https://instagram.com/${b.instagram_id.replace(/^@/, "")}` : "",
      b.website || "",
    ].filter(Boolean);
    const lat = Number(b.latitude);
    const lng = Number(b.longitude);

    const local: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${url}#business`,
      name: b.name,
      url,
      image: absImage(b.banner || b.logo),
      ...(plainText(b.description, 300) ? { description: plainText(b.description, 300) } : {}),
      ...(b.public_phone ? { telephone: b.public_phone } : {}),
      address: {
        "@type": "PostalAddress",
        ...(b.address ? { streetAddress: b.address } : {}),
        ...(b.location?.name ? { addressLocality: b.location.name } : {}),
        addressRegion: "اصفهان",
        addressCountry: "IR",
      },
      ...(lat && lng ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      // فقط وقتی نظر واقعی وجود دارد؛ امتیاز بدون نظر باعث جریمه‌ی گوگل می‌شود
      ...(b.review_count && b.review_count > 0 && b.average_rating
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(b.average_rating.toFixed(1)),
              reviewCount: b.review_count,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };

    const crumbs = [{ name: "خانه", path: "/" }];
    if (b.category?.slug) crumbs.push({ name: b.category.name, path: `/category/${encodeURIComponent(b.category.slug)}` });
    crumbs.push({ name: b.name, path: `/business/${encodeURIComponent(b.slug)}` });

    ld = [local, breadcrumbLd(crumbs)];
  }

  return (
    <>
      {ld.length > 0 && <JsonLd data={ld} />}
      {children}
    </>
  );
}
