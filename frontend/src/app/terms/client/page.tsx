import ContentPage from "@/components/site/ContentPage";

import type { Metadata } from "next";
import { applySeoOverride, getSeoOverride } from "@/lib/seo";

const BASE_METADATA: Metadata = {
  title: "قوانین و مقررات مشتریان | چهارسوق",
  description:
    "قوانین و شرایط استفاده از کارت، تخفیف‌ها و کش‌بک چهارسوق برای مشتریان.",
  alternates: { canonical: "/terms/client" },
  openGraph: { title: "قوانین و مقررات مشتریان | چهارسوق", description: "قوانین و شرایط استفاده از کارت، تخفیف‌ها و کش‌بک چهارسوق برای مشتریان.", url: "/terms/client", locale: "fa_IR", type: "website" },
};

// عنوان و توضیح از پنل ادمین ← سئو قابل تغییر است؛ اگر چیزی وارد نشده باشد همین مقدار بالا استفاده می‌شود
export async function generateMetadata(): Promise<Metadata> {
  return applySeoOverride(BASE_METADATA, await getSeoOverride("static", "/terms/client"));
}
// متن این صفحه از پنل ادمین ویرایش می‌شود؛ بدون این خط صفحه موقع بیلد ثابت می‌شود و تغییرات دیده نمی‌شود
export const dynamic = "force-dynamic";

export default function ClientTermsPage() {
  return <ContentPage pageType="terms_client" fallbackTitle="قوانین مشتریان" />;
}
