"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
    Ticket, Users, Plus, CheckCircle,
    Loader2, AlertCircle, X, Megaphone, Lock, Power
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// تعریف تایپ‌ها
interface Campaign {
    id: number;
    code: string;
    discount_percent: number;
    max_usage: number;
    current_usage: number;
    is_active: boolean;
    created_at: string;
}

interface Usage {
    id: number;
    client_phone: string;
    client_name: string;
    claimed_at: string;
    is_redeemed: boolean;
}

export default function OwnerCampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // مدیریت تب‌ها (عمومی vs خصوصی)
    const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

    // استیت‌های مربوط به کمپین عمومی سایت
    const [publicDiscount, setPublicDiscount] = useState("");
    const [isToggling, setIsToggling] = useState<number | null>(null);

    // استیت‌های مربوط به مودال ساخت کد اختصاصی جدید
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaign, setNewCampaign] = useState({ code: "", discount_percent: "", max_usage: "" });
    const [isCreating, setIsCreating] = useState(false);

    // استیت‌های مربوط به مودال لیست مشتریان (usages)
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [usages, setUsages] = useState<Usage[]>([]);
    const [isUsagesLoading, setIsUsagesLoading] = useState(false);

    // تفکیک کمپین‌ها: ظرفیت بالای ۱۰ هزار را به عنوان کمپین عمومی در نظر می‌گیریم
    const publicCampaigns = campaigns.filter(c => c.max_usage >= 10000);
    const privateCampaigns = campaigns.filter(c => c.max_usage < 10000);

    // ۱. دریافت لیست کمپین‌ها
    const fetchCampaigns = async () => {
        try {
            setIsLoading(true);
            const res = await api.get("/directory/owner/campaigns/");
            setCampaigns(res.data);
        } catch (error) {
            alert("خطا در دریافت لیست کدهای تخفیف");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    // ۲. ساخت کمپین عمومی (بدون نیاز به تعیین سقف و کد)
    const handleCreatePublicCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            // ساخت کد تصادفی برای سیستم
            const autoCode = "PUB-" + Math.floor(1000 + Math.random() * 9000);
            await api.post("/directory/owner/campaigns/", {
                code: autoCode,
                discount_percent: parseInt(publicDiscount),
                max_usage: 999999, // ظرفیت نامحدود برای کمپین عمومی سایت
            });
            setPublicDiscount("");
            fetchCampaigns(); // آپدیت لیست
        } catch (error: any) {
            alert("خطا در ایجاد کمپین عمومی.");
        } finally {
            setIsCreating(false);
        }
    };

    // ۳. روشن و خاموش کردن کمپین عمومی
    const handleTogglePublic = async (camp: Campaign) => {
        setIsToggling(camp.id);
        try {
            await api.patch(`/directory/owner/campaigns/${camp.id}/`, {
                is_active: !camp.is_active
            });
            fetchCampaigns();
        } catch (error) {
            alert("خطا در تغییر وضعیت");
        } finally {
            setIsToggling(null);
        }
    };

    // ۴. حذف کامل کمپین عمومی
    const handleDeletePublic = async (id: number) => {
        if (!confirm("آیا از حذف کامل این کمپین مطمئن هستید؟ با این کار کارت تخفیف از صفحه اصلی سایت حذف خواهد شد.")) return;
        try {
            await api.delete(`/directory/owner/campaigns/${id}/`);
            fetchCampaigns();
        } catch (error) {
            alert("خطا در حذف کمپین");
        }
    };

    // ۵. ساخت کد تخفیف اختصاصی/معرف
    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await api.post("/directory/owner/campaigns/", {
                code: newCampaign.code,
                discount_percent: parseInt(newCampaign.discount_percent),
                max_usage: parseInt(newCampaign.max_usage),
            });
            setIsCreateModalOpen(false);
            setNewCampaign({ code: "", discount_percent: "", max_usage: "" });
            fetchCampaigns(); // آپدیت لیست
        } catch (error: any) {
            alert(error.response?.data?.code?.[0] || "خطا در ساخت کد. ممکن است این کد تکراری باشد.");
        } finally {
            setIsCreating(false);
        }
    };

    // ۶. باز کردن مودال مشتریان و دریافت لیست آن‌ها
    const openUsagesModal = async (campaign: Campaign) => {
        setSelectedCampaign(campaign);
        setIsUsagesLoading(true);
        try {
            const res = await api.get(`/directory/owner/campaigns/${campaign.id}/usages/`);
            setUsages(res.data);
        } catch (error) {
            alert("خطا در دریافت لیست مشتریان");
        } finally {
            setIsUsagesLoading(false);
        }
    };

    // ۷. سوزاندن تخفیف مشتری (اعمال خرید حضوری)
    const handleRedeem = async (usageId: number) => {
        if (!confirm("آیا از اعمال این تخفیف و سوزاندن آن مطمئن هستید؟")) return;

        try {
            await api.post(`/directory/owner/redeem/${usageId}/`);
            // آپدیت وضعیت مشتری در لیست بدون رفرش کل صفحه
            setUsages((prev) =>
                prev.map((u) => u.id === usageId ? { ...u, is_redeemed: true } : u)
            );
        } catch (error: any) {
            alert(error.response?.data?.error || "خطا در اعمال تخفیف");
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
            <div className="max-w-5xl mx-auto">

                {/* هدر صفحه */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Ticket className="w-7 h-7 text-emerald-600" />
                            مدیریت کمپین‌ها و کدهای معرف
                        </h1>
                        <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">
                            تخفیف عمومی سایت خود را مدیریت کنید یا کدهای اختصاصی برای مراجعین حضوری بسازید.
                        </p>
                    </div>

                    {/* دکمه ساخت فقط در تب اختصاصی نمایش داده شود */}
                    {activeTab === 'private' && (
                        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 font-bold h-12 px-6 rounded-xl shadow-md w-full md:w-auto">
                            <Plus className="w-5 h-5 ml-2" />
                            ساخت کد جدید
                        </Button>
                    )}
                </div>

                {/* تب‌های جابجایی */}
                <div className="flex overflow-x-auto bg-gray-200/50 p-1.5 rounded-2xl mb-8 w-full md:w-max">
                    <button
                        onClick={() => setActiveTab('public')}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'public' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Megaphone className="w-4 h-4" />
                        کمپین عمومی (ویترین سایت)
                    </button>
                    <button
                        onClick={() => setActiveTab('private')}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'private' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Lock className="w-4 h-4" />
                        کدهای اختصاصی (مراجعین حضوری)
                    </button>
                </div>

                {/* وضعیت بارگذاری کلی */}
                {isLoading ? (
                    <div className="flex justify-center p-10"><Loader2 className="w-10 h-10 animate-spin text-emerald-600" /></div>
                ) : (
                    <>
                        {/* محتوای تب کمپین عمومی */}
                        {activeTab === 'public' && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-300">
                                <h2 className="text-xl font-black text-gray-900 mb-3">تخفیف ویژه ویترین سایت</h2>
                                <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-3xl">
                                    این پیشنهاد در صفحه اصلی سایت و پروفایل کسب‌وکار شما (با آیکون 🔥) نمایش داده می‌شود.
                                    کاربران سایت با کلیک روی آن ترغیب به ثبت‌نام و دریافت کد می‌شوند. با غیرفعال کردن، این کارت از سایت پنهان خواهد شد.
                                </p>

                                {publicCampaigns.length > 0 ? (
                                    <div className="space-y-4">
                                        {publicCampaigns.map((camp) => (
                                            <div key={camp.id} className={`border p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${camp.is_active ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                                                <div>
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${camp.is_active ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                                                        {camp.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                                        {camp.is_active ? 'فعال و در حال نمایش در سایت' : 'غیرفعال (مخفی)'}
                                                    </span>
                                                    <h3 className={`text-2xl font-black mb-1 ${camp.is_active ? 'text-emerald-900' : 'text-gray-700'}`}>
                                                        {camp.discount_percent}٪ تخفیف پیشنهاد ویژه
                                                    </h3>
                                                    <p className="text-sm text-emerald-700/80 font-medium">کد سیستمی: <span dir="ltr">{camp.code}</span> (ظرفیت نامحدود)</p>
                                                </div>
                                                <div className="flex flex-col gap-3 w-full md:w-auto">
                                                    <Button
                                                        onClick={() => handleTogglePublic(camp)}
                                                        disabled={isToggling === camp.id}
                                                        variant="outline"
                                                        className={`font-bold h-12 px-8 ${camp.is_active ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200'}`}
                                                    >
                                                        {isToggling === camp.id ? <Loader2 className="w-5 h-5 animate-spin" /> : camp.is_active ? "غیرفعال کردن (مخفی)" : "روشن کردن و نمایش مجدد"}
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDeletePublic(camp.id)}
                                                        variant="ghost"
                                                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold"
                                                    >
                                                        حذف کامل این کمپین
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <form onSubmit={handleCreatePublicCampaign} className="bg-gray-50 border border-gray-100 p-6 rounded-2xl max-w-lg">
                                        <label className="text-sm font-bold text-gray-800 mb-3 block">درصد تخفیف برای نمایش در سایت</label>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Input
                                                type="number"
                                                min="1" max="100"
                                                required
                                                value={publicDiscount}
                                                onChange={(e) => setPublicDiscount(e.target.value)}
                                                placeholder="مثلاً: 15"
                                                className="h-14 text-xl text-center font-black bg-white rounded-xl"
                                                dir="ltr"
                                            />
                                            <Button type="submit" disabled={isCreating} className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 rounded-xl shadow-lg">
                                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "ایجاد کمپین و نمایش در سایت"}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-4 font-medium flex items-center gap-1.5">
                                            <AlertCircle className="w-4 h-4" />
                                            متن کد و ظرفیت بی‌نهایت به صورت خودکار توسط سیستم تنظیم خواهد شد.
                                        </p>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* محتوای تب کدهای اختصاصی (دقیقاً کدهای قبلی شما) */}
                        {activeTab === 'private' && (
                            <div className="animate-in fade-in duration-300">
                                {privateCampaigns.length === 0 ? (
                                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <h3 className="text-lg font-bold text-gray-700">هیچ کدی ثبت نشده است</h3>
                                        <p className="text-gray-500 text-sm mt-1">برای شروع، اولین کد معرف/اختصاصی خود را بسازید.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {privateCampaigns.map((camp) => (
                                            <div key={camp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:shadow-md">
                                                <div className={`absolute top-0 right-0 w-1.5 h-full ${camp.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />

                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-xl font-black tracking-widest text-slate-800" dir="ltr">{camp.code}</h3>
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md mt-2 inline-block">
                                                            {camp.discount_percent ? `${camp.discount_percent}٪ تخفیف` : "بدون درصد"}
                                                        </span>
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="block text-2xl font-black text-slate-900">{camp.current_usage}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">از {camp.max_usage}</span>
                                                    </div>
                                                </div>

                                                {/* نوار پیشرفت ظرفیت */}
                                                <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
                                                    <div
                                                        className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((camp.current_usage / camp.max_usage) * 100, 100)}%` }}
                                                    />
                                                </div>

                                                <Button onClick={() => openUsagesModal(camp)} variant="outline" className="w-full border-slate-200 hover:bg-slate-50 font-bold text-slate-700">
                                                    <Users className="w-4 h-4 ml-2" />
                                                    مشاهده مشتریان ثبت‌نامی
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

            </div>

            {/* مودال ساخت کد اختصاصی جدید */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-700"><X className="w-6 h-6" /></button>
                        <h3 className="text-xl font-black text-gray-900 mb-6">ایجاد کد معرف اختصاصی</h3>

                        <form onSubmit={handleCreateCampaign} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 mb-1 block">متن کد (انگلیسی/اعداد)</label>
                                <Input required value={newCampaign.code} onChange={(e) => setNewCampaign({ ...newCampaign, code: e.target.value.toUpperCase() })} placeholder="ZHAMAN-VIP" dir="ltr" className="h-12 text-left tracking-widest font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-1 block">درصد تخفیف (اختیاری)</label>
                                    <Input type="number" min="0" max="100" value={newCampaign.discount_percent} onChange={(e) => setNewCampaign({ ...newCampaign, discount_percent: e.target.value })} placeholder="مثلاً 10" className="h-12" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-1 block">ظرفیت استفاده</label>
                                    <Input type="number" required min="1" value={newCampaign.max_usage} onChange={(e) => setNewCampaign({ ...newCampaign, max_usage: e.target.value })} placeholder="مثلاً 50" className="h-12" />
                                </div>
                            </div>
                            <Button type="submit" disabled={isCreating} className="w-full h-14 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-base shadow-lg">
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "ثبت و فعال‌سازی کد"}
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* مودال لیست مشتریان (Usages) - مشترک برای هر دو تب */}
            {selectedCampaign && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900">لیست مشتریان کد: <span className="font-mono text-emerald-600" dir="ltr">{selectedCampaign.code}</span></h3>
                            </div>
                            <button onClick={() => setSelectedCampaign(null)} className="text-gray-400 hover:text-rose-500 bg-white p-2 rounded-xl transition shadow-sm"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                            {isUsagesLoading ? (
                                <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                            ) : usages.length === 0 ? (
                                <p className="text-center text-gray-500 py-10 font-medium">هنوز هیچ کاربری با این کد ثبت‌نام نکرده است.</p>
                            ) : (
                                <div className="space-y-3">
                                    {usages.map((usage) => (
                                        <div key={usage.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition">
                                            <div>
                                                <div className="font-bold text-gray-900 text-base">{usage.client_name || "کاربر ناشناس"}</div>
                                                <div className="text-sm font-medium text-gray-500 mt-1" dir="ltr">{usage.client_phone}</div>
                                                <div className="text-xs text-gray-400 mt-2 font-medium bg-gray-50 inline-block px-2 py-1 rounded-md">{new Date(usage.claimed_at).toLocaleDateString('fa-IR')}</div>
                                            </div>
                                            <div className="sm:text-left text-right">
                                                {usage.is_redeemed ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-sm font-bold">
                                                        <CheckCircle className="w-4 h-4" />
                                                        تخفیف استفاده شده
                                                    </div>
                                                ) : (
                                                    <Button onClick={() => handleRedeem(usage.id)} size="sm" className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg px-6 h-10 w-full sm:w-auto shadow-md">
                                                        اعمال تخفیف (سوزاندن)
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}