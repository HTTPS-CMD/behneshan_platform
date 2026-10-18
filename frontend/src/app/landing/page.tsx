"use client";
import Link from "next/link";
import { Crown, Store, Zap, ArrowLeft, Ticket, CheckCircle2, TrendingUp } from "lucide-react";

export default function ComprehensiveLandingPage() {
  return (
    <div className="min-h-screen font-sans bg-gray-50 selection:bg-emerald-500 selection:text-white" dir="rtl">
      
      {/* 1. سکشن هیرو (Hero) - قلاب اصلی برای جلب توجه */}
      <section className="relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2000')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold mb-6">
            <Zap className="w-4 h-4 fill-emerald-400" /> جشنواره تخفیفات پاییزی چارسوق آغاز شد!
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            چارسوق؛ نبض بازار در دستان شما
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-medium mb-10 leading-relaxed">
            چه به دنبال بیشترین تخفیف‌ها برای خریدهای روزانه خود باشید و چه بخواهید فروش کسب‌وکارتان را چند برابر کنید، چارسوق پلتفرم شماست.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/daily-discounts" className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-lg px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:-translate-y-1">
              مشاهده تخفیف‌های امروز <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/register" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-lg px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
              <Store className="w-5 h-5" /> ثبت فروشگاه جدید
            </Link>
          </div>
        </div>
      </section>

      {/* 2. سکشن جشنواره/تخفیفات (Flash Sales) */}
      <section className="py-20 bg-emerald-600 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white/10 backdrop-blur-lg border border-white/20 rounded-[2rem] p-8 md:p-12">
            <div className="flex-1 text-center md:text-right text-white">
              <h2 className="text-3xl md:text-4xl font-black mb-4 flex items-center justify-center md:justify-start gap-3">
                <Ticket className="w-10 h-10 text-emerald-200" /> شکار تخفیف‌های طلایی!
              </h2>
              <p className="text-emerald-50 text-lg font-medium leading-relaxed">
                روزانه ده‌ها محصول و خدمات با تخفیف‌های شگفت‌انگیز در چارسوق قرار می‌گیرد. فرصت را از دست ندهید و کدهای تخفیف اختصاصی خود را دریافت کنید.
              </p>
            </div>
            <div className="shrink-0">
              <Link href="/daily-discounts" className="bg-white text-emerald-700 hover:text-emerald-800 font-black text-lg px-10 py-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 hover:scale-105">
                ورود به جشنواره <Zap className="w-5 h-5 fill-emerald-600" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. سکشن مشتریان VIP */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-[3rem] blur-2xl opacity-20 transform rotate-6"></div>
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-10 md:p-14 text-white shadow-2xl border border-slate-700">
              <Crown className="w-16 h-16 text-amber-400 mb-6" />
              <h3 className="text-3xl font-black mb-4 text-amber-400">کلوپ مشتریان VIP</h3>
              <p className="text-slate-300 leading-relaxed font-medium mb-8">
                با تهیه اشتراک چارسوق، بدون نیاز به گشتن دنبال کد تخفیف، از تمامی فروشگاه‌های طرف قرارداد ما درصد تخفیف ثابت و بی‌قید و شرط بگیرید.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> تخفیف ثابت روی تمام خریدها</li>
                <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> بازگشت وجه (Cashback) بخشی از مبلغ</li>
                <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> دسترسی زودهنگام به حراجی‌ها</li>
              </ul>
              <Link href="/dashboard/client/vip" className="block text-center bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-4 rounded-xl transition-colors shadow-lg">
                خرید و ارتقا به VIP
              </Link>
            </div>
          </div>
          <div className="flex-1 space-y-6 text-center md:text-right">
            <h2 className="text-4xl font-black text-slate-900 leading-tight">چرا باید کاربر ویژه چارسوق باشیم؟</h2>
            <p className="text-slate-600 text-lg leading-relaxed font-medium">
              ما در چارسوق سیستمی طراحی کرده‌ایم که هر خرید برای شما یک سرمایه‌گذاری باشد. مشتریان وفادار ما نه تنها هزینه کمتری می‌پردازند، بلکه از معرفی دوستان خود نیز سود نقدی دریافت می‌کنند.
            </p>
          </div>
        </div>
      </section>

      {/* 4. سکشن جذب کاسبان و صاحبان کسب‌وکار */}
      <section className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 text-center mb-16">
          <h2 className="text-4xl font-black text-slate-900 mb-4">صاحب کسب‌وکار هستید؟</h2>
          <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto">
            به شبکه بزرگ چارسوق بپیوندید، مشتریان جدید پیدا کنید و فروش خود را هوشمندانه مدیریت کنید.
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <TrendingUp className="w-8 h-8 text-blue-600" />, title: "افزایش چشمگیر فروش", desc: "محصولات و خدمات شما در معرض دید هزاران مشتری آماده به خرید قرار می‌گیرد." },
            { icon: <Store className="w-8 h-8 text-blue-600" />, title: "پنل مدیریت اختصاصی", desc: "گزارشات دقیق فروش، مدیریت کدهای تخفیف و بررسی رفتار مشتریان در یک نگاه." },
            { icon: <Ticket className="w-8 h-8 text-blue-600" />, title: "اجرای کمپین‌های هدفمند", desc: "امکان ارسال پیامک تبلیغاتی و قرارگیری در جایگاه‌های ویژه (نردبان) برای دیده شدن بیشتر." }
          ].map((feature, idx) => (
            <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-3">{feature.title}</h4>
              <p className="text-slate-600 font-medium leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href="/register" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg px-10 py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all hover:-translate-y-1">
            ثبت رایگان کسب‌وکار <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>

    </div>
  );
}