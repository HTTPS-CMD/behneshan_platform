"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import { User, Phone, Save, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OwnerAccountPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [successMessage, setSuccessMessage] = useState("");

    // استیت فرم فقط شامل فیلدهای موجود در بک‌اند شماست
    const [formData, setFormData] = useState({
        full_name: "",
        phone_number: "",
        national_id: "",
    });

    // دریافت اطلاعات حساب کاربری
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = Cookies.get("access_token");
                // درخواست به آدرس جدیدی که در بک‌اند ساختیم
                const res = await api.get("/identity/profile/", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                setFormData({
                    full_name: res.data.full_name || "",
                    phone_number: res.data.phone_number || "",
                    national_id: res.data.national_id || "",
                });
            } catch (error) {
                console.error("خطا در دریافت اطلاعات کاربر", error);
            } finally {
                setIsFetching(false);
            }
        };
        fetchUserData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setSuccessMessage("");

        try {
            const token = Cookies.get("access_token");
            // ارسال درخواست پچ به همان آدرس برای آپدیت نام
            await api.patch("/identity/profile/", { full_name: formData.full_name }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSuccessMessage("اطلاعات حساب کاربری با موفقیت بروزرسانی شد.");
        } catch (error) {
            console.error(error);
            alert("خطایی در بروزرسانی اطلاعات رخ داد.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                در حال بارگذاری اطلاعات حساب...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">

                <header className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">حساب کاربری من</h1>
                        <p className="text-sm text-gray-500 mt-2">اطلاعات شخصی خود را در سیستم مدیریت کنید.</p>
                    </div>
                    <Link href="/dashboard/owner" className="text-blue-600 hover:underline text-sm font-bold">
                        بازگشت به داشبورد
                    </Link>
                </header>

                {successMessage && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" /> نام و نام خانوادگی
                        </label>
                        <Input name="full_name" value={formData.full_name} onChange={handleChange} className="h-12 bg-gray-50/50 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-500" /> شماره موبایل (غیرقابل تغییر)
                            </label>
                            <Input name="phone_number" value={formData.phone_number} disabled dir="ltr" className="h-12 text-left bg-gray-100 text-gray-500 rounded-xl cursor-not-allowed border-none" />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" /> کد ملی احراز شده (شاهکار)
                            </label>
                            <Input name="national_id" value={formData.national_id} disabled dir="ltr" className="h-12 text-left bg-emerald-50/50 text-emerald-800 rounded-xl cursor-not-allowed border-emerald-100" />
                        </div>
                    </div>

                    <div className="pt-6">
                        <Button type="submit" disabled={isLoading} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-lg">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ذخیره تغییرات حساب"}
                        </Button>
                    </div>
                </form>

            </div>
        </div>
    );
}