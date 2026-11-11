import type { Metadata } from "next";
import { applySeoOverride, getSeoOverride } from "@/lib/seo";

// خودِ page.tsx کلاینتی است و نمی‌تواند متادیتا داشته باشد؛ عنوان و توضیح سئو از این لایه‌ی سمت سرور می‌آید
const BASE_METADATA: Metadata = {
  title: "تخفیف‌های روزانه | چهارسوق",
  description: "تخفیف‌ها و فروش ویژه‌ی روزانه‌ی کسب‌وکارهای اصفهان را در چهارسوق ببینید و با کارت چهارسوق از آن‌ها استفاده کنید.",
  alternates: { canonical: "/daily-discounts" },
  openGraph: {
    title: "تخفیف‌های روزانه | چهارسوق",
    description: "تخفیف‌ها و فروش ویژه‌ی روزانه‌ی کسب‌وکارهای اصفهان در چهارسوق.",
    url: "/daily-discounts",
    locale: "fa_IR",
    type: "website",
  },
};

// عنوان و توضیح از پنل ادمین ← سئو قابل تغییر است؛ اگر چیزی وارد نشده باشد همین مقدار بالا استفاده می‌شود
export async function generateMetadata(): Promise<Metadata> {
  return applySeoOverride(BASE_METADATA, await getSeoOverride("static", "/daily-discounts"));
}

export default function DailyDiscountsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
