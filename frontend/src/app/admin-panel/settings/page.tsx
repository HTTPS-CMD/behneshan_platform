"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface SiteSetting {
    id?: number;
    key: string;
    value: string;
    description: string;
}

export default function AdminSettings() {
    const { accessToken: token } = useAuthStore();
    const [settings, setSettings] = useState<SiteSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);

    // فرم یکپارچه با تمام فیلدهایی که خواستی
    const [formData, setFormData] = useState({
        key: "",
        textValue: "", // متنی که تو سایت نشون میده
        align: "center", // جایگاه
        size: "lg", // سایز
        description: "", // توضیحات ادمین
    });

    const fetchSettings = async () => {
        try {
            // دقت کن که آدرس API اینجا مخصوص تنظیمات است، نه منوها!
            const response = await api.get("/cms/admin/settings/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = response.data.results || response.data;
            setSettings(data);
        } catch (error) {
            console.error("خطا در دریافت تنظیمات:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // جادوی فرانت‌اند: تبدیل ۳ فیلد به یک پکیج JSON برای دیتابیس
            const payloadValue = JSON.stringify({
                text: formData.textValue,
                align: formData.align,
                size: formData.size
            });

            const payload = {
                key: formData.key,
                value: payloadValue,
                description: formData.description
            };

            if (editingId) {
                await api.put(`/cms/admin/settings/${editingId}/`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                alert("تنظیمات ویرایش شد.");
            } else {
                await api.post("/cms/admin/settings/", payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                alert("تنظیمات اضافه شد.");
            }
            
            // ریست کردن فرم
            setFormData({ key: "", textValue: "", align: "center", size: "lg", description: "" });
            setEditingId(null);
            fetchSettings();
        } catch (error) {
            console.error("خطا در ذخیره:", error);
            alert("خطایی رخ داد!");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("آیا از حذف این تنظیم مطمئن هستید؟")) return;
        try {
            // مسیر درست برای حذف تنظیمات
            await api.delete(`/cms/admin/settings/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSettings();
        } catch (error) {
            console.error("خطا در حذف:", error);
            alert("مشکلی در حذف پیش آمد.");
        }
    };

    const handleEdit = (setting: SiteSetting) => {
        setEditingId(setting.id as number);
        
        let parsedText = setting.value;
        let parsedAlign = "center";
        let parsedSize = "lg";

        // تلاش برای باز کردن پکیج JSON هنگام ویرایش
        try {
            const parsed = JSON.parse(setting.value);
            if (parsed.text !== undefined) {
                parsedText = parsed.text;
                parsedAlign = parsed.align || "center";
                parsedSize = parsed.size || "lg";
            }
        } catch (e) {
            // اگر متن معمولی بود و JSON نبود
        }

        setFormData({
            key: setting.key,
            textValue: parsedText,
            align: parsedAlign,
            size: parsedSize,
            description: setting.description || "",
        });
    };

    // تابع کمکی برای نمایش تمیز در جدول
    const renderTableValue = (valStr: string) => {
        try {
            const parsed = JSON.parse(valStr);
            if(parsed.text !== undefined) {
                return (
                    <div className="flex flex-col gap-1 text-xs">
                        <span><strong>متن:</strong> {parsed.text}</span>
                        <span className="text-gray-400">سایز: {parsed.size} | چیدمان: {parsed.align}</span>
                    </div>
                );
            }
        } catch (e) {}
        return valStr;
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">مدیریت متون و تنظیمات سایت</h2>

            {/* فرم اصلی دقیقاً با ساختاری که خواستی */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">شناسه (مثلاً hero_config)</label>
                        <input required type="text" name="key" value={formData.key} onChange={handleChange} className="w-full p-3 border rounded-xl" dir="ltr" disabled={editingId !== null} />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">جایگاه متن</label>
                        <select name="align" value={formData.align} onChange={handleChange} className="w-full p-3 border rounded-xl cursor-pointer">
                            <option value="right">راست‌چین</option>
                            <option value="center">وسط‌چین</option>
                            <option value="left">چپ‌چین</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">سایز متن</label>
                        <select name="size" value={formData.size} onChange={handleChange} className="w-full p-3 border rounded-xl cursor-pointer">
                            <option value="sm">کوچک</option>
                            <option value="md">متوسط</option>
                            <option value="lg">بزرگ (Pro Max)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">توضیحات ادمین</label>
                        <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full p-3 border rounded-xl" />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">متن نمایشی داخل سایت</label>
                    <textarea required name="textValue" value={formData.textValue} onChange={handleChange} className="w-full p-3 border rounded-xl h-24 resize-none" placeholder="متن خود را اینجا بنویسید..." />
                </div>

                <button type="submit" className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition">
                    {editingId ? "ثبت ویرایش" : "ایجاد کلید"}
                </button>
                {editingId && (
                     <button type="button" onClick={() => { setEditingId(null); setFormData({ key: "", textValue: "", align: "center", size: "lg", description: "" }); }} className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl mr-2">انصراف</button>
                )}
            </form>

            {/* لیست تنظیمات */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                        <tr>
                            <th className="p-4 font-bold">شناسه</th>
                            <th className="p-4 font-bold">جزئیات ثبت شده</th>
                            <th className="p-4 font-bold">توضیحات</th>
                            <th className="p-4 font-bold">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700">
                        {settings.map((setting) => (
                            <tr key={setting.key} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                <td className="p-4 font-bold" dir="ltr text-left">{setting.key}</td>
                                <td className="p-4">{renderTableValue(setting.value)}</td>
                                <td className="p-4 text-gray-500">{setting.description || "-"}</td>
                                <td className="p-4 flex gap-3">
                                    <button onClick={() => handleEdit(setting)} className="text-blue-600 font-bold">ویرایش</button>
                                    <button onClick={() => setting.id && handleDelete(setting.id)} className="text-red-500 font-bold">حذف</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}