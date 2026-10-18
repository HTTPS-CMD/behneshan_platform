"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Percent, Zap, Loader2, ArrowRight, Tag, ShoppingBag } from "lucide-react";

interface Product {
    id: number;
    name: string;
    price: number;
    discount_percentage: number;
    final_price: number;
    is_flash_sale: boolean;
    business: number;
}

export default function DailyDiscountsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDiscounts = async () => {
            try {
                const res = await api.get("/directory/daily-discounts/");
                setProducts(res.data.results || res.data);
            } catch (error) {
                console.error("خطا در دریافت تخفیفات:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDiscounts();
    }, []);

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-rose-500 selection:text-white" dir="rtl">
            
            {/* هدر سایت */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30">
                            چ
                        </div>
                        <div>
                            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-slate-900 to-slate-700 block">چارسوق</span>
                        </div>
                    </Link>
                    <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-rose-600 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-300">
                        <ArrowRight className="w-4 h-4" />
                        بازگشت به خانه
                    </Link>
                </div>
            </header>

            {/* محتوای اصلی */}
            <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col items-center text-center mb-12 space-y-4">
                    <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-inner">
                        <Percent className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">تخفیفات شگفت‌انگیز روز</h1>
                    <p className="text-slate-500 font-medium max-w-xl text-lg">بهترین قیمت‌ها و پیشنهادات ویژه فروشگاه‌های چارسوق را اینجا پیدا کنید. این تخفیف‌ها زمان محدودی دارند!</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-rose-500" /></div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-300">
                        <Tag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">تخفیفی برای امروز یافت نشد!</h3>
                        <p className="text-slate-500 font-medium">فردا دوباره سر بزنید تا از جدیدترین پیشنهادات باخبر شوید.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {products.map((product) => (
                            <div key={product.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative group hover:shadow-xl hover:-translate-y-1 hover:border-rose-200 transition-all duration-300 flex flex-col justify-between">
                                
                                {/* تگ‌های فروش فوری و درصد تخفیف */}
                                <div className="absolute -top-4 -left-2 flex flex-col gap-2 z-10">
                                    <div className="bg-rose-500 text-white font-black text-lg px-4 py-2 rounded-2xl shadow-lg shadow-rose-500/30 transform -rotate-6 group-hover:rotate-0 transition-transform">
                                        {product.discount_percentage}٪
                                    </div>
                                    {product.is_flash_sale && (
                                        <div className="bg-amber-500 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1 w-max">
                                            <Zap className="w-3 h-3 fill-white" /> فوری
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 mb-6 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center mb-4 text-slate-400 group-hover:text-rose-500 transition-colors">
                                        <ShoppingBag className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 line-clamp-2 min-h-[56px] leading-relaxed">
                                        {product.name}
                                    </h3>
                                </div>

                                <div className="border-t border-slate-100 pt-5 mt-auto">
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col text-right">
                                            <span className="text-sm font-bold text-slate-400 line-through decoration-rose-300 mb-1">
                                                {product.price.toLocaleString()}
                                            </span>
                                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                {product.final_price.toLocaleString()}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 pb-1">تومان</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}