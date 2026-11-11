import Link from "next/link";
import { ArrowLeft, CheckCircle2, Crown, Store, Ticket, TrendingUp, Zap } from "lucide-react";
import type { LandingPayload } from "@/components/site/landingTypes";
import { mediaUrl } from "@/lib/format";

// محتوای این صفحه از پنل ادمین ← «محتوای سایت» ← «صفحه‌ی لندینگ» ویرایش می‌شود
export const dynamic = "force-dynamic"; // هر تغییری که ادمین ذخیره کند بلافاصله دیده می‌شود

export const metadata = {
  title: "چهارسوق | نبض بازار در دستان شما",
  description: "تخفیف‌های روزانه، اشتراک VIP و پنل رایگان برای کسب‌وکارها در چهارسوق.",
};

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

async function getLanding(): Promise<LandingPayload | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/landing/`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as LandingPayload;
  } catch {
    return null;
  }
}

const FEATURE_ICONS = [TrendingUp, Store, Ticket];

export default async function LandingPage() {
  const data = await getLanding();

  // اگر بک‌اند در دسترس نبود، صفحه خالی نمی‌ماند
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-900 p-6 text-center text-white" dir="rtl">
        <h1 className="text-4xl font-black">چهارسوق</h1>
        <Link href="/daily-discounts" className="rounded-xl bg-saffron-500 px-8 py-4 font-black text-brand-950">مشاهده تخفیف‌های امروز</Link>
      </div>
    );
  }

  const { hero, promo, vip, business } = data.content;
  const heroImage = data.hero_image ? mediaUrl(data.hero_image) : null;

  return (
    <div className="min-h-screen font-sans bg-gray-50 selection:bg-brand-500 selection:text-white" dir="rtl">

      {/* ۱. هیرو */}
      {hero.visible && (
        <section className="relative bg-brand-900 overflow-hidden">
          {heroImage ? (
            <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${heroImage}")` }} />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(218,127,55,0.35),transparent_60%),radial-gradient(50%_50%_at_10%_90%,rgba(63,110,156,0.35),transparent_60%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/80 to-transparent"></div>
          <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 flex flex-col items-center text-center">
            {hero.badge && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-saffron-300 px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Zap className="w-4 h-4 fill-saffron-300" /> {hero.badge}
              </div>
            )}
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">{hero.title}</h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-medium mb-10 leading-relaxed">{hero.subtitle}</p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {hero.primary_text && (
                <Link href={hero.primary_link || "/"} className="bg-saffron-500 hover:bg-saffron-400 text-brand-950 font-black text-lg px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:-translate-y-1">
                  {hero.primary_text} <ArrowLeft className="w-5 h-5" />
                </Link>
              )}
              {hero.secondary_text && (
                <Link href={hero.secondary_link || "/"} className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-lg px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                  <Store className="w-5 h-5" /> {hero.secondary_text}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ۲. جشنواره */}
      {promo.visible && (
        <section className="py-20 bg-brand-600 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white/10 backdrop-blur-lg border border-white/20 rounded-[2rem] p-8 md:p-12">
              <div className="flex-1 text-center md:text-right text-white">
                <h2 className="text-3xl md:text-4xl font-black mb-4 flex items-center justify-center md:justify-start gap-3">
                  <Ticket className="w-10 h-10 text-brand-200" /> {promo.title}
                </h2>
                <p className="text-brand-50 text-lg font-medium leading-relaxed">{promo.text}</p>
              </div>
              {promo.button_text && (
                <div className="shrink-0">
                  <Link href={promo.button_link || "/"} className="bg-white text-brand-700 hover:text-brand-800 font-black text-lg px-10 py-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 hover:scale-105">
                    {promo.button_text} <Zap className="w-5 h-5 fill-brand-600" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ۳. مشتریان VIP */}
      {vip.visible && (
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-[3rem] blur-2xl opacity-20 transform rotate-6"></div>
              <div className="relative bg-gradient-to-br from-brand-900 to-brand-800 rounded-[3rem] p-10 md:p-14 text-white shadow-2xl border border-slate-700">
                <Crown className="w-16 h-16 text-amber-400 mb-6" />
                <h3 className="text-3xl font-black mb-4 text-amber-400">{vip.card_title}</h3>
                <p className="text-slate-300 leading-relaxed font-medium mb-8">{vip.card_text}</p>
                <ul className="space-y-4 mb-10">
                  {vip.bullets.filter(Boolean).map((b) => (
                    <li key={b} className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="w-5 h-5 text-saffron-400" /> {b}</li>
                  ))}
                </ul>
                {vip.button_text && (
                  <Link href={vip.button_link || "/"} className="block text-center bg-amber-500 hover:bg-amber-600 text-brand-900 font-black py-4 rounded-xl transition-colors shadow-lg">
                    {vip.button_text}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-6 text-center md:text-right">
              <h2 className="text-4xl font-black text-brand-900 leading-tight">{vip.side_title}</h2>
              <p className="text-slate-600 text-lg leading-relaxed font-medium">{vip.side_text}</p>
            </div>
          </div>
        </section>
      )}

      {/* ۴. جذب کسب‌وکارها */}
      {business.visible && (
        <section className="py-24 bg-gray-50 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-4 text-center mb-16">
            <h2 className="text-4xl font-black text-brand-900 mb-4">{business.title}</h2>
            <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto">{business.text}</p>
          </div>

          <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            {business.features.filter((f) => f.title).map((feature, idx) => {
              const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
              return (
                <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                  <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-brand-600" />
                  </div>
                  <h4 className="text-xl font-black text-brand-800 mb-3">{feature.title}</h4>
                  <p className="text-slate-600 font-medium leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>

          {business.button_text && (
            <div className="mt-16 text-center">
              <Link href={business.button_link || "/register"} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-black text-lg px-10 py-5 rounded-2xl shadow-xl shadow-brand-600/20 transition-all hover:-translate-y-1">
                {business.button_text} <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
