import Link from "next/link";
import { Building2, ChevronLeft, ExternalLink, Globe, AtSign, MapPin, Phone } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import type { Metadata } from "next";
import { applySeoOverride, getSeoOverride } from "@/lib/seo";

// آدرس و شماره تماس از پنل ادمین (مدیریت متون سایت ← تماس با ما) ویرایش می‌شود؛ بدون این خط صفحه موقع بیلد ثابت می‌شود
export const dynamic = "force-dynamic";

const BASE_METADATA: Metadata = {
  title: "تماس با چهارسوق | ارتباط با شبکه کاسبان اصفهان",
  description:
    "برای ثبت‌نام کاسبان، خرید کارت چهارسوق، مشاوره‌ی تبلیغات و فروش یا ارسال پیشنهاد و انتقاد، با تیم چهارسوق در ارتباط باشید.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "تماس با چهارسوق | ارتباط با شبکه کاسبان اصفهان",
    description:
      "برای ثبت‌نام کاسبان، خرید کارت چهارسوق، مشاوره‌ی تبلیغات و فروش یا ارسال پیشنهاد و انتقاد، با تیم چهارسوق در ارتباط باشید.",
    url: "/contact",
    locale: "fa_IR",
    type: "website",
  },
};

// عنوان و توضیح از پنل ادمین ← سئو قابل تغییر است؛ اگر چیزی وارد نشده باشد همین مقدار بالا استفاده می‌شود
export async function generateMetadata(): Promise<Metadata> {
  return applySeoOverride(BASE_METADATA, await getSeoOverride("static", "/contact"));
}

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

type Info = { address: string; phone: string; instagram: string; website: string };

async function getContactInfo(): Promise<Info> {
  let s: Record<string, unknown> = {};
  try {
    const res = await fetch(`${API_BASE}/cms/data/`, { cache: "no-store" });
    if (res.ok) s = ((await res.json()) as { settings?: Record<string, unknown> }).settings || {};
  } catch (e) {
    console.error("Error loading contact info:", e);
  }
  const text = (k: string, fallback = "") => (typeof s[k] === "string" && (s[k] as string).trim() ? (s[k] as string).trim() : fallback);
  return {
    address: text("contact_address"),
    phone: text("contact_phone"),
    instagram: text("contact_instagram", "4soghtalk").replace(/^@/, ""),
    website: text("contact_website", "4sogh.shop").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  };
}

const TOPICS = [
  { title: "ثبت‌نام کاسبان", text: "عضویت در شبکه، شرایط تخفیف و مراحل پذیرش" },
  { title: "خرید و ارتقای کارت", text: "راهنمای انتخاب کارت و پرداخت مابه‌التفاوت برای ارتقا" },
  { title: "تبلیغات و مشاوره‌ی فروش", text: "معرفی کسب‌وکار، مدیریت پیج، طراحی سایت" },
  { title: "همکاری و سازمان‌ها", text: "کارت‌های سازمانی و بسته‌های رفاهی کارکنان" },
  { title: "پیشنهاد و انتقاد", text: "نظر شما به بهتر شدن چهارسوق کمک می‌کند" },
];

const H2 = "mb-4 text-2xl font-black text-brand-800";

export default async function ContactPage() {
  const info = await getContactInfo();
  const phoneHref = info.phone.replace(/[^\d+]/g, "");

  const rows: { label: string; icon: React.ElementType; value: React.ReactNode }[] = [];
  if (info.address) rows.push({ label: "آدرس", icon: MapPin, value: <span className="whitespace-pre-line">{info.address}</span> });
  if (info.phone) {
    rows.push({
      label: "شماره تماس", icon: Phone,
      value: <a href={`tel:${phoneHref}`} dir="ltr" className="font-bold text-brand-700 hover:text-saffron-700">{info.phone}</a>,
    });
  }
  rows.push({
    label: "اینستاگرام", icon: AtSign,
    value: (
      <a href={`https://instagram.com/${info.instagram}`} target="_blank" rel="noopener noreferrer" dir="ltr"
        className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-saffron-700">
        {info.instagram} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    ),
  });
  rows.push({
    label: "وب‌سایت", icon: Globe,
    value: <a href={`https://${info.website}`} dir="ltr" className="font-bold text-brand-700 hover:text-saffron-700">{info.website}</a>,
  });

  return (
    <div className="min-h-screen bg-cream flex flex-col font-sans selection:bg-saffron-200 selection:text-brand-900" dir="rtl">
      <SiteHeader />

      <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-10 md:py-14">
        <nav aria-label="مسیر صفحه" className="mb-5 flex items-center gap-1.5 text-sm font-medium text-brand-500 animate-in fade-in duration-500">
          <Link href="/" className="transition-colors hover:text-saffron-700">خانه</Link>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="text-brand-800 font-bold">تماس با ما</span>
        </nav>

        <div className="space-y-10 rounded-[2.5rem] border border-cream-200 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 md:p-14">
          <header className="border-b border-cream-200 pb-8">
            <h1 className="text-3xl font-black text-brand-800 md:text-4xl">تماس با ما</h1>
            <p className="mt-3 text-lg font-medium text-saffron-700">ما اینجا هستیم تا صدای شما را بشنویم</p>
          </header>

          <section aria-labelledby="intro">
            <h2 id="intro" className={H2}>با ما در ارتباط باشید</h2>
            <p className="text-lg font-medium leading-loose text-brand-900/80">
              چه کاسب باشید و بخواهید به شبکه‌ی چهارسوق بپیوندید، چه مشتری باشید و درباره‌ی کارت‌ها سؤال داشته باشید، تیم چهارسوق آماده‌ی شنیدن حرف شماست.
              پیام خود را از طریق فرم زیر یا راه‌های ارتباطی ارسال کنید تا در کوتاه‌ترین زمان پاسخ بدهیم.
            </p>
          </section>

          <section aria-labelledby="ways">
            <h2 id="ways" className={H2}>راه‌های ارتباطی</h2>
            <div className="overflow-hidden rounded-2xl border border-cream-200">
              <table className="w-full text-right">
                <caption className="sr-only">راه‌های ارتباطی با چهارسوق</caption>
                <tbody className="divide-y divide-cream-200">
                  {rows.map(({ label, icon: Icon, value }) => (
                    <tr key={label} className="even:bg-cream/50">
                      <th scope="row" className="w-2/5 whitespace-nowrap px-4 py-4 text-sm font-black text-brand-800 md:w-1/4 md:px-6">
                        <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-saffron-600" aria-hidden="true" />{label}</span>
                      </th>
                      <td className="px-4 py-4 text-base font-medium text-brand-900/80 md:px-6">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="topics">
            <h2 id="topics" className={H2}>برای چه موضوعی با ما تماس بگیرید؟</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {TOPICS.map((t) => (
                <li key={t.title} className="rounded-2xl border border-cream-200 bg-cream/40 p-4">
                  <p className="font-black text-brand-800">{t.title}</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-brand-900/70">{t.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="form" id="contact-form" className="scroll-mt-24">
            <h2 id="form" className={H2}>فرم تماس</h2>
            <p className="mb-6 text-lg font-medium leading-loose text-brand-900/80">
              لطفاً فرم زیر را تکمیل کنید. همکاران ما در اولین فرصت با شما تماس می‌گیرند.
            </p>
            <ContactForm />
          </section>

          <section aria-labelledby="follow">
            <h2 id="follow" className={H2}>ما را دنبال کنید</h2>
            <p className="text-lg font-medium leading-loose text-brand-900/80">
              جدیدترین خبرها، معرفی کاسبان شبکه و پیشنهادهای ویژه‌ی چهارسوق را در صفحه‌ی اینستاگرام ما ببینید:{" "}
              <a href={`https://instagram.com/${info.instagram}`} target="_blank" rel="noopener noreferrer" dir="ltr"
                className="font-bold text-brand-700 underline-offset-4 hover:text-saffron-700 hover:underline">
                {info.instagram}
              </a>
            </p>
          </section>

          <section aria-labelledby="merchant" className="rounded-3xl bg-brand-800 p-8 text-white md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 id="merchant" className="mb-3 flex items-center gap-2 text-2xl font-black">
                  <Building2 className="h-6 w-6 text-saffron-400" aria-hidden="true" /> کاسب هستید؟
                </h2>
                <p className="max-w-xl text-base font-medium leading-loose text-white/85">
                  اگر کسب‌وکار شما در اصفهان فعالیت می‌کند و می‌خواهید بدون هزینه‌ی تبلیغات سنگین، مشتری واقعی و وفادار پیدا کنید، همین حالا ثبت‌نام کنید.
                </p>
              </div>
              <Link href="/register"
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-saffron-500 px-8 text-base font-black text-brand-950 transition-colors hover:bg-saffron-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-800">
                ثبت‌نام کاسبان
              </Link>
            </div>
          </section>

          <p className="border-t border-cream-200 pt-8 text-center text-lg font-black text-brand-800">
            موفقیت مسیری است که ما تا انتهای آن کنار شما خواهیم ماند.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
