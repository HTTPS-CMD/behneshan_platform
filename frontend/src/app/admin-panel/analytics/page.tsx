"use client";

import { useState, useEffect } from "react";
import { Users, Eye, BarChart, MonitorSmartphone, MapPin, Clock } from "lucide-react";
import { api } from "@/lib/api";

// تعریف تایپ‌های دیتای دریافتی از جنگو
interface AnalyticsData {
    users: { total: number; new_last_30_days: number };
    page_views: {
        total: number;
        today: number;
        top_pages: { url: string; views: number }[];
    };
    recent_logins: {
        username: string;
        ip_address: string;
        timestamp: string;
        user_agent: string;
        role?: string | null;
    }[];
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const { data: json } = await api.get<AnalyticsData>("/analytics/dashboard-stats/");
                setData(json);
            } catch (error) {
                console.error("خطا در دریافت اطلاعات داشبورد:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    // جلوگیری از کرش کردن در صورت نبود دیتا یا عدم دسترسی
    if (isLoading) return <div className="p-8 text-center text-slate-400">در حال دریافت آمار لحظه‌ای...</div>;
    if (!data || !data.users) return <div className="p-8 text-center text-rose-500 font-bold border border-rose-200 bg-rose-50 rounded-xl m-6">خطا در دریافت اطلاعات. لطفاً مطمئن شوید که با حساب کاربری ادمین لاگین کرده‌اید.</div>;

    return (
        <div className="p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-brand-800 dark:text-white mb-2">آمار و عملکرد سایت</h1>
                <p className="text-sm text-slate-500">گزارش لحظه‌ای از وضعیت بازدیدها و کاربران سیستم</p>
            </div>

            {/* کارت‌های آماری */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="کل کاربران" value={data.users.total} subValue={`${data.users.new_last_30_days} کاربر جدید در ۳۰ روز اخیر`} icon={<Users className="w-6 h-6 text-brand-500" />} />
                <StatCard title="بازدیدهای امروز" value={data.page_views.today} subValue="از ساعت ۰۰:۰۰ بامداد" icon={<Eye className="w-6 h-6 text-brand-500" />} />
                <StatCard title="مجموع بازدیدها" value={data.page_views.total} subValue="کل تاریخچه سایت" icon={<BarChart className="w-6 h-6 text-indigo-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* جدول صفحات پربازدید */}
                <div className="bg-white dark:bg-brand-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-brand-800">
                    <h2 className="text-lg font-semibold mb-4 text-brand-800 dark:text-white">۵ صفحه پربازدید</h2>
                    <div className="space-y-4">
                        {data.page_views.top_pages.map((page, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-brand-800/50 rounded-xl">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300" dir="ltr">{page.url}</span>
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">
                                    {page.views} بازدید
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* لاگین‌های اخیر */}
                <div className="bg-white dark:bg-brand-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-brand-800">
                    <h2 className="text-lg font-semibold mb-4 text-brand-800 dark:text-white">ورودهای اخیر به سیستم</h2>
                    <div className="space-y-4">
                        {data.recent_logins.map((login, index) => (
                            <div key={index} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-brand-800/50 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        {login.username || "کاربر"}
                                        {login.role && (
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_BADGE[login.role]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                                                {ROLE_BADGE[login.role]?.label ?? login.role}
                                            </span>
                                        )}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span dir="ltr">{new Date(login.timestamp).toLocaleString("fa-IR")}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>{login.ip_address || "IP نامشخص"}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MonitorSmartphone className="w-3.5 h-3.5" />
                                        <span className="truncate max-w-[200px]" title={login.user_agent}>
                                            {describeDevice(login.user_agent)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// کامپوننت کمکی برای کارت‌های بالای صفحه
function StatCard({ title, value, subValue, icon }: { title: string, value: number, subValue: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-brand-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
                <div className="p-2 bg-slate-50 dark:bg-brand-800 rounded-lg">{icon}</div>
            </div>
            <div className="text-3xl font-bold text-brand-800 dark:text-white mb-1">{value.toLocaleString("fa-IR")}</div>
            <div className="text-xs text-slate-400">{subValue}</div>
        </div>
    );
}
const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
    ADMIN: { label: "مدیر", cls: "bg-brand-800 text-cream" },
    BUSINESS_OWNER: { label: "کسب‌وکار", cls: "bg-saffron-100 text-saffron-800" },
    CLIENT: { label: "مشتری", cls: "bg-brand-50 text-brand-700" },
};

// «Mozilla/5.0 (Macintosh…) Chrome/…» ← «Chrome · macOS»
function describeDevice(ua?: string) {
    if (!ua || ua === "نامشخص") return "دستگاه نامشخص";
    const browser =
        /Edg\//.test(ua) ? "Edge" :
        /OPR\/|Opera/.test(ua) ? "Opera" :
        /Firefox\//.test(ua) ? "Firefox" :
        /Chrome\//.test(ua) ? "Chrome" :
        /Safari\//.test(ua) ? "Safari" : "مرورگر دیگر";
    const os =
        /iPhone|iPad/.test(ua) ? "iOS" :
        /Android/.test(ua) ? "Android" :
        /Windows/.test(ua) ? "Windows" :
        /Mac OS X|Macintosh/.test(ua) ? "macOS" :
        /Linux/.test(ua) ? "Linux" : "";
    return os ? `${browser} · ${os}` : browser;
}
