"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Users, Search, CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Transaction {
    id: number;
    customer_phone: string;
    customer_name: string;
    original_amount: number;
    applied_discount_percentage: number;
    discount_source: string;
    final_amount: number;
    created_at: string;
}

export default function OwnerCustomersPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const token = Cookies.get("access_token");
                const res = await api.get("/directory/owner/crm/customers/", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTransactions(res.data);
            } catch (error) {
                console.error("خطا در دریافت لیست مشتریان:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCustomers();
    }, []);

    // فیلتر کردن زنده مشتریان بر اساس شماره یا نام
    const filteredTransactions = transactions.filter(t =>
        t.customer_phone.includes(searchQuery) ||
        (t.customer_name && t.customer_name.includes(searchQuery))
    );

    const formatSource = (source: string) => {
        if (source === 'SUBSCRIPTION') return 'اشتراک VIP';
        if (source === 'CAMPAIGN') return 'کمپین اختصاصی';
        return 'بدون تخفیف';
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-6" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* هدر و نوار جستجو */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Users className="w-7 h-7 text-blue-600" />
                            پایگاه داده مشتریان من
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            لیست افرادی که از شما خرید کرده‌اند و تاریخچه تراکنش‌های سیستم CRM
                        </p>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="جستجوی نام یا شماره موبایل..."
                            className="pl-10 h-12 bg-gray-50/50 rounded-xl font-medium"
                        />
                        <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    </div>
                </div>

                {/* جدول داده‌ها */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                            <p className="text-sm font-medium">در حال دریافت لیست مشتریان...</p>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                            <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="font-bold text-lg text-gray-600">هیچ تراکنشی یافت نشد</p>
                            <p className="text-sm mt-1">تراکنش‌های ثبت شده در سیستم پذیرش، اینجا نمایش داده می‌شوند.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="p-5 whitespace-nowrap">اطلاعات مشتری</th>
                                        <th className="p-5 whitespace-nowrap">مبلغ فاکتور</th>
                                        <th className="p-5 whitespace-nowrap">تخفیف اعمال شده</th>
                                        <th className="p-5 whitespace-nowrap">پرداختی نهایی</th>
                                        <th className="p-5 whitespace-nowrap">تاریخ تراکنش</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-5">
                                                <div className="font-bold text-gray-900 text-base">{t.customer_name || 'کاربر ناشناس'}</div>
                                                <div className="text-sm text-gray-500 mt-1 font-medium" dir="ltr">{t.customer_phone}</div>
                                            </td>
                                            <td className="p-5 font-medium text-gray-500">
                                                {t.original_amount.toLocaleString()} <span className="text-xs">تومان</span>
                                            </td>
                                            <td className="p-5">
                                                {t.applied_discount_percentage > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-emerald-600 font-black text-base">{t.applied_discount_percentage}٪</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md w-max font-bold">
                                                            {formatSource(t.discount_source)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 font-medium">بدون تخفیف</span>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                <span className="font-black text-slate-800 text-lg">
                                                    {t.final_amount.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-500 mr-1 font-bold">تومان</span>
                                            </td>
                                            <td className="p-5 text-gray-500 font-medium whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="w-4 h-4 text-gray-400" />
                                                    {new Date(t.created_at).toLocaleDateString('fa-IR')}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}