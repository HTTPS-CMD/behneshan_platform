import ContentPage from "@/components/site/ContentPage";

import type { Metadata } from "next";
import { applySeoOverride, getSeoOverride } from "@/lib/seo";

const BASE_METADATA: Metadata = {
  title: "درباره چهارسوق | پلتفرم کسب‌وکارهای محلی اصفهان",
  description:
    "با چهارسوق، شبکه‌ی کاسبان اصفهان، آشنا شوید؛ ماموریت، داستان و راه‌های همکاری ما.",
  alternates: { canonical: "/about" },
  openGraph: { title: "درباره چهارسوق | پلتفرم کسب‌وکارهای محلی اصفهان", description: "با چهارسوق، شبکه‌ی کاسبان اصفهان، آشنا شوید؛ ماموریت، داستان و راه‌های همکاری ما.", url: "/about", locale: "fa_IR", type: "website" },
};

// عنوان و توضیح از پنل ادمین ← سئو قابل تغییر است؛ اگر چیزی وارد نشده باشد همین مقدار بالا استفاده می‌شود
export async function generateMetadata(): Promise<Metadata> {
  return applySeoOverride(BASE_METADATA, await getSeoOverride("static", "/about"));
}
// متن این صفحه از پنل ادمین ویرایش می‌شود؛ بدون این خط صفحه موقع بیلد ثابت می‌شود و تغییرات دیده نمی‌شود
export const dynamic = "force-dynamic";

export default function AboutPage() {
  return <ContentPage pageType="about" fallbackTitle="درباره ما" />;
}
