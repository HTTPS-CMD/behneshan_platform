import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

/**
 * صفحه‌ی محتوایی مشترک (درباره ما، تماس با ما، قوانین).
 * متن هر صفحه از پنل ادمین ← «صفحات (درباره ما، قوانین)» ویرایش می‌شود.
 * هدر و فوتر همان هدر و فوتر صفحه‌ی اصلی سایت است.
 */
type PageType = "about" | "contact" | "terms_client" | "terms_business";

export default async function ContentPage({ pageType, fallbackTitle }: { pageType: PageType; fallbackTitle: string }) {
    let content = { title: fallbackTitle, content: "در حال بارگذاری..." };
    try {
        const res = await api.get(`/directory/content/${pageType}/`);
        content = res.data;
    } catch (e) {
        console.error("Error loading content:", e);
    }

    return (
        <div className="min-h-screen bg-cream flex flex-col font-sans selection:bg-saffron-200 selection:text-brand-900" dir="rtl">
            <SiteHeader />

            {/* بدنه اصلی محتوا */}
            <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-10 md:py-14">
                <nav aria-label="مسیر صفحه" className="mb-5 flex items-center gap-1.5 text-sm font-medium text-brand-500 animate-in fade-in duration-500">
                    <Link href="/" className="transition-colors hover:text-saffron-700">خانه</Link>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="text-brand-800 font-bold">{content.title}</span>
                </nav>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-cream-200 p-8 md:p-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-3xl md:text-4xl font-black mb-8 text-brand-800 border-b border-cream-200 pb-6">
                        {content.title}
                    </h1>
                    <div className="whitespace-pre-wrap leading-loose text-brand-900/80 text-lg font-medium">
                        {content.content}
                    </div>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
