"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import { Rocket, Send, Loader2, ArrowRight, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface BusinessRequest {
    id: number;
    request_type: string;
    request_type_display: string;
    description: string;
    is_approved: boolean;
    created_at: string;
}

export default function OwnerRequestsPage() {
    const [requests, setRequests] = useState<BusinessRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        request_type: "LADDER",
        description: "",
    });

    const fetchRequests = async () => {
        try {
            const token = Cookies.get("access_token");
            const res = await api.get("/directory/owner/requests/", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data.results || res.data);
        } catch (error) {
            console.error("خطا در دریافت درخواست‌ها:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = Cookies.get("access_token");
            await api.post("/directory/owner/requests/", formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            alert("درخواست شما با موفقیت ثبت شد و پس از بررسی تیم چارسوق اعمال می‌گردد.");
            setFormData({ ...formData, description: "" });
            fetchRequests();
        } catch (error) {
            alert("خطا در ثبت درخواست. لطفاً دوباره تلاش کنید.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8" dir="rtl">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* هدر صفحه */}
                <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Rocket className="w-7 h-7 text-purple-600" />
                            درخواست امکانات ویژه
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">ارسال درخواست برای نردبان، تبلیغات پیامکی و معرفی ویژه در چارسوق.</p>
                    </div>
                    <Link href="/dashboard/owner" className="flex items-center gap-2 text-slate-500 hover:text-purple-600 transition-colors bg-gray-50 px-4 py-2 rounded-xl font-bold text-sm">
                        <ArrowRight className="w-4 h-4" />
                        بازگشت
                    </Link>
                </header>

                {/* فرم ثبت درخواست */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3">نوع درخواست</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { id: "LADDER", label: "نردبان (صدرنشینی)", desc: "نمایش در بالاترین نتایج" },
                                    { id: "SMS", label: "تبلیغات پیامکی", desc: "ارسال پیامک به کاربران" },
                                    { id: "FEATURED", label: "معرفی ویژه روز", desc: "قرارگیری در بنرهای اصلی" }
                                ].map((type) => (
                                    <div 
                                        key={type.id}
                                        onClick={() => setFormData({ ...formData, request_type: type.id })}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                            formData.request_type === type.id 
                                            ? "border-purple-600 bg-purple-50" 
                                            : "border-gray-200 bg-white hover:border-purple-200"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.request_type === type.id ? 'border-purple-600' : 'border-gray-300'}`}>
                                                {formData.request_type === type.id && <div className="w-2 h-2 bg-purple-600 rounded-full" />}
                                            </div>
                                            <span className={`font-black ${formData.request_type === type.id ? 'text-purple-900' : 'text-gray-700'}`}>{type.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 pr-6 font-medium">{type.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">توضیحات تکمیلی (اختیاری)</label>
                            <Textarea 
                                value={formData.description} 
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                                placeholder="اگر توضیحات خاصی درباره زمان یا نحوه اجرای درخواست دارید اینجا بنویسید..." 
                                className="min-h-[100px] bg-gray-50/50 rounded-xl resize-none"
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isSubmitting} className="h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 rounded-xl shadow-lg w-full md:w-auto">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 ml-2" /> ثبت درخواست</>}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* تاریخچه درخواست‌ها */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-black text-gray-800 mb-6">تاریخچه درخواست‌های شما</h3>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500 font-bold">تا کنون درخواستی ثبت نکرده‌اید.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((req) => (
                                <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="font-black text-gray-800">{req.request_type_display}</span>
                                            <span className="text-xs text-gray-400 font-medium">({new Date(req.created_at).toLocaleDateString('fa-IR')})</span>
                                        </div>
                                        {req.description && <p className="text-sm text-gray-600 font-medium">{req.description}</p>}
                                    </div>
                                    <div className="shrink-0">
                                        {req.is_approved ? (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-sm font-bold w-full md:w-auto justify-center">
                                                <CheckCircle2 className="w-4 h-4" /> تایید شده
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold w-full md:w-auto justify-center">
                                                <Clock className="w-4 h-4" /> در حال بررسی
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}