"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Crown, CheckCircle2, Loader2, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionPlan {
    id: number;
    name: string;
    base_discount_percentage: number;
    price_per_month: string;
    is_active: boolean;
}

export default function ClientVIPPage() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    // دریافت لیست پلن‌ها از بک‌اند
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await api.get("/directory/client/subscription/plans/");
                setPlans(res.data);
            } catch (error) {
                console.error("خطا در دریافت پلن‌ها:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlans();
    }, []);

    // هندل کردن خرید اشتراک
    const handlePurchase = async (planId: number) => {
        setIsPurchasing(planId);
        setMessage(null);

        try {
            const token = Cookies.get("access_token");
            const res = await api.post(
                "/directory/client/subscription/purchase/",
                { plan_id: planId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setMessage({ type: "success", text: res.data.message });
        } catch (error: any) {
            setMessage({ 
                type: "error", 
                text: error.response?.data?.error || "خطایی در فعال‌سازی اشتراک رخ داد." 
            });
        } finally {
            setIsPurchasing(null);
            // اسکرول به بالای صفحه برای دیدن پیام
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* هدر صفحه */}
                <div className="text-center space-y-4 mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-2">
                        <Crown className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">چهارسوق VIP</h1>
                    <p className="text-slate-500 max-w-xl mx-auto font-medium">
                        با تهیه اشتراک VIP، در تمامی فروشگاه‌های عضو پلتفرم چهارسوق، تخفیف ثابت و تضمین‌شده دریافت کنید.
                    </p>
                </div>

                {/* پیام‌های موفقیت یا خطا */}
                {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 font-bold text-sm border ${
                        message.type === "success" 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}>
                        {message.type === "success" ? (
                            <CheckCircle2 className="w-6 h-6 shrink-0" />
                        ) : (
                            <AlertCircle className="w-6 h-6 shrink-0" />
                        )}
                        {message.text}
                    </div>
                )}

                {/* نمایش پلن‌ها */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20">
                        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                        <p className="text-slate-500 font-medium">در حال دریافت لیست اشتراک‌ها...</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 font-bold">در حال حاضر پلن فعالی برای خرید وجود ندارد.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                        {plans.map((plan) => (
                            <div 
                                key={plan.id} 
                                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="mb-6">
                                    <h3 className="text-xl font-black text-slate-800 mb-2">{plan.name}</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-slate-900">
                                            {Number(plan.price_per_month).toLocaleString()}
                                        </span>
                                        <span className="text-sm font-bold text-slate-400">تومان / ماهانه</span>
                                    </div>
                                </div>

                                <div className="space-y-4 flex-1 mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-600">
                                            <span className="text-emerald-600 font-black text-base">{plan.base_discount_percentage}٪</span> تخفیف ثابت در تمام خریدها
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-600">پشتیبانی ویژه مشتریان</span>
                                    </div>
                                </div>

                                <Button 
                                    onClick={() => handlePurchase(plan.id)}
                                    disabled={isPurchasing === plan.id}
                                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition-all"
                                >
                                    {isPurchasing === plan.id ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-5 h-5" />
                                            خرید و فعال‌سازی
                                        </div>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}