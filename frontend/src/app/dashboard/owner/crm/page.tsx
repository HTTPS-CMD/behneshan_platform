"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { UserCheck, Search, Calculator, CheckCircle2, Loader2, Receipt, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OwnerCRMPage() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [originalAmount, setOriginalAmount] = useState("");

    const [isVerifying, setIsVerifying] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const [customerData, setCustomerData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // استعلام تخفیف مشتری
    const handleVerifyCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setErrorMsg("");
        setSuccessMsg("");
        setCustomerData(null);
        setOriginalAmount("");

        try {
            const token = Cookies.get("access_token");
            const res = await api.post(
                "/directory/owner/crm/verify-discount/",
                { phone_number: phoneNumber },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCustomerData(res.data);
        } catch (error: any) {
            setErrorMsg(error.response?.data?.error || "خطا در استعلام مشتری.");
        } finally {
            setIsVerifying(false);
        }
    };

    // محاسبه زنده مبلغ نهایی
    const calculateFinalAmount = () => {
        if (!originalAmount || isNaN(Number(originalAmount)) || !customerData) return 0;
        const amount = parseFloat(originalAmount);
        const discountPct = customerData.discount_percentage || 0;
        return amount - (amount * (discountPct / 100));
    };

    // ثبت نهایی تراکنش
    const handleRecordTransaction = async () => {
        if (!originalAmount) {
            setErrorMsg("لطفاً مبلغ فاکتور را وارد کنید.");
            return;
        }

        setIsRecording(true);
        setErrorMsg("");

        try {
            const token = Cookies.get("access_token");
            const res = await api.post(
                "/directory/owner/crm/record-transaction/",
                {
                    phone_number: phoneNumber,
                    original_amount: originalAmount
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccessMsg(`تراکنش با موفقیت ثبت شد! مبلغ نهایی فاکتور: ${res.data.final_amount.toLocaleString()} تومان`);
            setCustomerData(null);
            setPhoneNumber("");
            setOriginalAmount("");
        } catch (error: any) {
            setErrorMsg(error.response?.data?.error || "خطا در ثبت تراکنش.");
        } finally {
            setIsRecording(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-6" dir="rtl">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* هدر صفحه */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <UserCheck className="w-7 h-7 text-emerald-600" />
                            پذیرش مشتری و ثبت فاکتور
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            استعلام موجودی تخفیف مشتریان و ثبت خرید حضوری در سیستم CRM
                        </p>
                    </div>
                </div>

                {/* پیام‌های سیستم */}
                {errorMsg && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 font-bold text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        {successMsg}
                    </div>
                )}

                {/* مرحله ۱: استعلام مشتری */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">۱</span>
                        استعلام اطلاعات مشتری
                    </h2>

                    <form onSubmit={handleVerifyCustomer} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="شماره موبایل مشتری (مثال: 09123456789)"
                                dir="ltr"
                                required
                                className="h-14 text-left font-bold text-lg bg-gray-50/50 rounded-xl pl-12"
                            />
                            <Search className="absolute left-4 top-4 w-6 h-6 text-gray-400" />
                        </div>
                        <Button
                            type="submit"
                            disabled={isVerifying || !phoneNumber}
                            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-8 shadow-md"
                        >
                            {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "بررسی و استعلام"}
                        </Button>
                    </form>
                </div>

                {/* مرحله ۲: نمایش اطلاعات و ثبت فاکتور */}
                {customerData && (
                    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border-2 border-emerald-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs">۲</span>
                            تخصیص تخفیف و ثبت تراکنش
                        </h2>

                        {/* اطلاعات یافت شده مشتری */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <span className="block text-xs font-bold text-slate-400 mb-1">نام مشتری</span>
                                <span className="block font-black text-slate-800">{customerData.customer_name}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <span className="block text-xs font-bold text-slate-400 mb-1">وضعیت تخفیف‌ها</span>
                                <div className="space-y-2 mt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">اشتراک VIP:</span>
                                        <span className="font-bold">{customerData.vip_discount}٪</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">کمپین اختصاصی دریافت شده:</span>
                                        <span className="font-bold">{customerData.campaign_discount}٪</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                                        <span className="text-sm font-bold text-emerald-600">تخفیف اعمال شده:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-black text-emerald-600">{customerData.discount_percentage}٪</span>
                                            {customerData.discount_percentage > 0 && (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                                    {customerData.discount_source === "SUBSCRIPTION" ? "اشتراک VIP" : "کمپین فروشگاه"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* فرم مبلغ فاکتور */}
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                            <label className="text-sm font-bold text-slate-800 mb-3 block">مبلغ اولیه فاکتور (تومان)</label>
                            <Input
                                type="number"
                                value={originalAmount}
                                onChange={(e) => setOriginalAmount(e.target.value)}
                                placeholder="مثلاً: 500000"
                                dir="ltr"
                                className="h-14 text-left font-black text-2xl bg-white rounded-xl mb-4"
                            />

                            {/* پیش‌نمایش مبلغ نهایی */}
                            <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl mb-6">
                                <div className="flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-emerald-400" />
                                    <span className="font-medium text-slate-300">مبلغ نهایی پرداختی:</span>
                                </div>
                                <span className="text-2xl font-black text-emerald-400">
                                    {calculateFinalAmount().toLocaleString()} <span className="text-sm font-normal text-slate-400">تومان</span>
                                </span>
                            </div>

                            <Button
                                onClick={handleRecordTransaction}
                                disabled={isRecording || !originalAmount}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl shadow-lg"
                            >
                                {isRecording ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <div className="flex items-center gap-2">
                                        <Receipt className="w-5 h-5" />
                                        ثبت نهایی تراکنش در سیستم
                                    </div>
                                )}
                            </Button>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}