import Link from "next/link";
import { BadgeCheck, ChevronLeft, MapPin, Star, Store } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/site/JsonLd";
import { absUrl, breadcrumbLd } from "@/lib/seo";
import { mediaUrl } from "@/lib/format";

export type LandingBusiness = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  average_rating: number;
  review_count: number;
  is_verified: boolean;
  logo?: string | null;
  category?: { name: string } | null;
  location?: { name: string } | null;
};

/** صفحه‌ی فرود دسته یا محله: لیست کسب‌وکارها که سمت سرور رندر می‌شود تا گوگل لینک‌ها را ببیند */
export default function TaxonomyLanding({
  title, subtitle, intro, path, businesses, total,
}: {
  title: string; subtitle: string; intro: string; path: string; businesses: LandingBusiness[]; total: number;
}) {
  const ld = [
    breadcrumbLd([{ name: "خانه", path: "/" }, { name: title, path }]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: title,
      numberOfItems: total,
      itemListElement: businesses.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(`/business/${encodeURIComponent(b.slug)}`),
        name: b.name,
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-cream flex flex-col font-sans selection:bg-saffron-200 selection:text-brand-900" dir="rtl">
      <JsonLd data={ld} />
      <SiteHeader />

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-10 md:py-14">
        <nav aria-label="مسیر صفحه" className="mb-5 flex items-center gap-1.5 text-sm font-medium text-brand-500">
          <Link href="/" className="transition-colors hover:text-saffron-700">خانه</Link>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="text-brand-800 font-bold">{title}</span>
        </nav>

        <header className="mb-8 rounded-[2rem] border border-cream-200 bg-white p-6 shadow-sm md:p-10">
          <h1 className="text-3xl font-black text-brand-800 md:text-4xl">{title}</h1>
          <p className="mt-2 text-lg font-medium text-saffron-700">{subtitle}</p>
          <p className="mt-4 text-base font-medium leading-loose text-brand-900/80">{intro}</p>
        </header>

        {businesses.length === 0 ? (
          <p className="rounded-2xl border border-cream-200 bg-white p-8 text-center font-medium text-brand-900/70">
            هنوز کسب‌وکاری در این بخش ثبت نشده است.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/business/${encodeURIComponent(b.slug)}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream">
                      {b.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(b.logo)} alt={`لوگوی ${b.name}`} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Store className="h-6 w-6 text-brand-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate font-black text-brand-800">
                        {b.name}
                        {b.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="تأییدشده" />}
                      </p>
                      <p className="truncate text-xs font-medium text-brand-900/60">{b.category?.name}</p>
                    </div>
                  </div>
                  {b.description && (
                    <p className="line-clamp-2 text-sm font-medium leading-relaxed text-brand-900/70">{b.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-xs font-bold text-brand-900/60">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{b.location?.name}</span>
                    {b.review_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-saffron-700">
                        <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        {b.average_rating.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {total > businesses.length && (
          <p className="mt-6 text-center text-sm font-medium text-brand-900/70">
            برای دیدن بقیه‌ی کسب‌وکارها از{" "}
            <Link href="/" className="font-bold text-brand-700 underline-offset-4 hover:underline">صفحه‌ی اصلی</Link> جستجو کنید.
          </p>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
