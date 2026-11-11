import ContentPage from "@/components/site/ContentPage";

import type { Metadata } from "next";
import { applySeoOverride, getSeoOverride } from "@/lib/seo";

const BASE_METADATA: Metadata = {
  title: "قوانین و مقررات کسب‌وکارها | چهارسوق",
  description:
    "شرایط عضویت، تعهدات و قوانین همکاری کاسبان با شبکه‌ی چهارسوق.",
  alternates: { canonical: "/terms/business" },
  openGraph: { title: "قوانین و مقررات کسب‌وکارها | چهارسوق", description: "شرایط عضویت، تعهدات و قوانین همکاری کاسبان با شبکه‌ی چهارسوق.", url: "/terms/business", locale: "fa_IR", type: "website" },
};

// عنوان و توضیح از پنل ادمین ← سئو قابل تغییر است؛ اگر چیزی وارد نشده باشد همین مقدار بالا استفاده می‌شود
export async function generateMetadata(): Promise<Metadata> {
  return applySeoOverride(BASE_METADATA, await getSeoOverride("static", "/terms/business"));
}
// متن این صفحه از پنل ادمین ویرایش می‌شود؛ بدون این خط صفحه موقع بیلد ثابت می‌شود و تغییرات دیده نمی‌شود
export const dynamic = "force-dynamic";

export default function BusinessTermsPage() {
  return <ContentPage pageType="terms_business" fallbackTitle="قوانین کسب و کار" />;
}
