import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import PageViewTracker from "@/components/PageViewTracker";
import { Toaster } from "@/components/ui/toaster";
import MotionProvider from "@/components/motion/MotionProvider";
import JsonLd from "@/components/site/JsonLd";
import { DEFAULT_OG_IMAGE, INSTAGRAM_URL, SITE_NAME, SITE_URL, absImage, applySeoOverride, getSeoOverride, getSeoSettings } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, home] = await Promise.all([getSeoSettings(), getSeoOverride("static", "/")]);
  const ogImage = settings?.seo_default_og_image ? absImage(settings.seo_default_og_image) : DEFAULT_OG_IMAGE;
  const base: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: "چهارسوق",
    description: "اولین پلتفرم جامع کسب‌وکارهای محلی",
    applicationName: SITE_NAME,
    // آدرس کانونیکال هر صفحه همان آدرس خودش (بدون پارامترهای جستجو) است؛ صفحه‌ها می‌توانند آن را بازنویسی کنند
    alternates: { canonical: "./" },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: SITE_NAME,
      title: "چهارسوق",
      description: "اولین پلتفرم جامع کسب‌وکارهای محلی",
      images: [{ url: ogImage }],
    },
    twitter: { card: "summary_large_image", images: [ogImage] },
    // کد تأیید مالکیت سایت در گوگل و بینگ (از پنل ادمین ← سئو ← تنظیمات کلی)
    verification: {
      google: settings?.seo_google_verification || undefined,
      other: settings?.seo_bing_verification ? { "msvalidate.01": settings.seo_bing_verification } : undefined,
    },
  };
  // عنوان و توضیح صفحه‌ی اصلی پیش‌فرض همه‌ی صفحه‌هایی است که متادیتای اختصاصی ندارند؛
  // کانونیکال و noindex عمداً اعمال نمی‌شوند (اینجا روی همه‌ی صفحه‌ها اثر می‌گذاشتند)
  return applySeoOverride(base, home && { ...home, canonical: "", noindex: false });
}

// اسکیمای سازمان و وب‌سایت (برای نمایش لوگو، نام برند و کادر جستجو در نتایج گوگل)
const buildSiteLd = (o: Awaited<ReturnType<typeof getSeoSettings>>) => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: o?.seo_org_name || SITE_NAME,
    url: SITE_URL,
    logo: o?.seo_org_logo ? absImage(o.seo_org_logo) : `${SITE_URL}/brand/logo-mark.png`,
    ...(o?.seo_org_phone ? { telephone: o.seo_org_phone } : {}),
    sameAs: [o?.seo_instagram || INSTAGRAM_URL],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: o?.seo_org_name || SITE_NAME,
    url: SITE_URL,
    inLanguage: "fa-IR",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

export const viewport: Viewport = { themeColor: "#153a5f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSeoSettings();
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <body suppressHydrationWarning className="min-h-screen bg-cream text-brand-900 antialiased">
        <JsonLd data={buildSiteLd(settings)} />
        <MotionProvider>{children}</MotionProvider>
        <PageViewTracker />
        <Toaster />
      </body>
    </html>
  );
}
