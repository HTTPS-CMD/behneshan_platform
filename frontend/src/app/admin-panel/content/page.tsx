"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { Loader2, Save, FileText } from "lucide-react";

const PAGE_OPTIONS = [
    { value: "about", label: "درباره ما" },
    { value: "contact", label: "تماس با ما" },
    { value: "terms_client", label: "قوانین مشتریان" },
    { value: "terms_business", label: "قوانین کسب و کار" },
];

export default function AdminContentSettings() {
    const [selectedPage, setSelectedPage] = useState(PAGE_OPTIONS[0].value);
    const [content, setContent] = useState({ title: "", content: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // دریافت محتوای صفحه‌ی انتخاب شده
    useEffect(() => {
        const fetchContent = async () => {
            setIsLoading(true);
            try {
                const token = Cookies.get("access_token");
                // استفاده از API ادمین یا عمومی برای گرفتن دیتای فعلی
                const res = await api.get(`/directory/content/${selectedPage}/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setContent({ title: res.data.title || "", content: res.data.content || "" });
            } catch (error) {
                console.error("خطا در دریافت اطلاعات", error);
                setContent({ title: "", content: "" }); // اگر خالی بود ریست شود
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [selectedPage]);

    // ذخیره تغییرات
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = Cookies.get("access_token");
            await api.put(`/directory/admin/content/${selectedPage}/`, content, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("تغییرات با موفقیت ذخیره شد!");
        } catch (error) {
            alert("خطا در ذخیره اطلاعات.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <FileText className="w-6 h-6 text-emerald-600" />
                <h2 className="text-xl font-black text-slate-800">مدیریت متون سایت</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">انتخاب صفحه برای ویرایش</label>
                    <select
                        value={selectedPage}
                        onChange={(e) => setSelectedPage(e.target.value)}
                        // تغییر در کلاس‌ها: محدود کردن عرض در دسکتاپ (md:w-72) و اضافه کردن cursor-pointer
                        className="w-full md:w-72 h-12 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-emerald-500 font-bold outline-none cursor-pointer transition-all"
                    >
                        {PAGE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">عنوان صفحه</label>
                            <input
                                type="text"
                                value={content.title}
                                onChange={(e) => setContent({ ...content, title: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500"
                                placeholder="مثلاً: درباره پلتفرم چهارسوق"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">متن اصلی</label>
                            <textarea
                                value={content.content}
                                onChange={(e) => setContent({ ...content, content: e.target.value })}
                                className="w-full h-64 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 leading-loose"
                                placeholder="متن قوانین یا توضیحات را اینجا بنویسید..."
                            />
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full md:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 ml-2" /> ذخیره تغییرات</>}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}