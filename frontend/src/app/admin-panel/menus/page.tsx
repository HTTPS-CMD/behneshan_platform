"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface Menu {
    id?: number;
    title: string;
    url: string;
    icon: string;
    position: string;
    order: number;
    is_active: boolean;
}

export default function AdminMenus() {
    const { accessToken: token } = useAuthStore();
    const [menus, setMenus] = useState<Menu[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState<Menu>({
        title: "",
        url: "/",
        icon: "",
        position: "header",
        order: 0,
        is_active: true,
    });

    // دریافت لیست منوها
    // دریافت لیست منوها
    const fetchMenus = async () => {
        try {
            const response = await api.get("/cms/admin/menus/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            // پشتیبانی از ساختارهای مختلف پاسخ DRF (پاجینیشن یا لیست مستقیم)
            const data = response.data.results || response.data;
            setMenus(data);
        } catch (error) {
            console.error("خطا در دریافت منوها:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMenus();
    }, []);

    // هندل کردن تغییرات فرم
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
        });
    };

    // ارسال فرم (ایجاد یا ویرایش)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/cms/admin/menus/${editingId}/`, formData, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                alert("منو با موفقیت ویرایش شد.");
            } else {
                await api.post("/cms/admin/menus/", formData, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                alert("منو با موفقیت اضافه شد.");
            }
            setFormData({ title: "", url: "/", icon: "", position: "header", order: 0, is_active: true });
            setEditingId(null);
            fetchMenus();
        } catch (error) {
            console.error("خطا در ذخیره منو:", error);
            alert("خطایی رخ داد!");
        }
    };

    // حذف منو
    const handleDelete = async (id: number) => {
        if (!confirm("آیا از حذف این منو مطمئن هستید؟")) return;
        try {
            await api.delete(`/cms/admin/menus/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchMenus();
        } catch (error) {
            console.error("خطا در حذف:", error);
        }
    };

    // لود کردن دیتای منو برای ویرایش
    const handleEdit = (menu: Menu) => {
        setEditingId(menu.id as number);
        setFormData(menu);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">مدیریت منوهای سایت</h2>

            {/* فرم ایجاد/ویرایش */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عنوان منو</label>
                    <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-3 border rounded-xl focus:border-emerald-500 outline-none" placeholder="مثلا: درباره ما" />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">لینک مقصد</label>
                    <input required type="text" name="url" value={formData.url} onChange={handleChange} className="w-full p-3 border rounded-xl focus:border-emerald-500 outline-none" dir="ltr" placeholder="/about" />
                </div>

                {/* فیلد جایگاه */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">جایگاه</label>
                    <select name="position" value={formData.position} onChange={handleChange} className="w-full p-3 border rounded-xl focus:border-emerald-500 outline-none">
                        <option value="header">هدر (بالای سایت)</option>
                        <option value="footer">فوتر (پایین سایت)</option>
                        <option value="mobile">منوی موبایل</option>
                    </select>
                </div>

                {/* فیلد نام آیکون (فقط برای موبایل نمایش داده می‌شود) */}
                {formData.position === "mobile" && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">نام آیکون</label>
                        <input
                            type="text"
                            name="icon"
                            value={formData.icon || ""}
                            onChange={handleChange}
                            className="w-full p-3 border rounded-xl focus:border-emerald-500 outline-none"
                            dir="ltr"
                            placeholder="مثلا: Home"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ترتیب نمایش</label>
                    <input type="number" name="order" value={formData.order} onChange={handleChange} className="w-full p-3 border rounded-xl focus:border-emerald-500 outline-none" />
                </div>

                <div className="flex items-center gap-2 mt-8">
                    <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-5 h-5 accent-emerald-600" />
                    <label className="text-sm font-bold text-gray-700">فعال برای نمایش</label>
                </div>

                <div className="flex items-end">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition">
                        {editingId ? "ثبت ویرایش" : "افزودن منوی جدید"}
                    </button>
                    {editingId && (
                        <button type="button" onClick={() => { setEditingId(null); setFormData({ title: "", url: "/", icon: "", position: "header", order: 0, is_active: true }); }} className="w-full bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl ml-2 transition">
                            انصراف
                        </button>
                    )}
                </div>
            </form>

            {/* لیست منوها */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                        <tr>
                            <th className="p-4 font-bold">عنوان</th>
                            <th className="p-4 font-bold">لینک</th>
                            <th className="p-4 font-bold">جایگاه</th>
                            <th className="p-4 font-bold">ترتیب</th>
                            <th className="p-4 font-bold">وضعیت</th>
                            <th className="p-4 font-bold">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">در حال بارگذاری...</td></tr>
                        ) : menus.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">هیچ منویی یافت نشد.</td></tr>
                        ) : (
                            menus.map((menu: any) => (
                                <tr key={menu.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="p-4 font-bold">{menu.title}</td>
                                    <td className="p-4 text-emerald-600" dir="ltr">{menu.url}</td>
                                    <td className="p-4">
                                        {menu.position === 'header' ? 'هدر' :
                                            menu.position === 'footer' ? 'فوتر' :
                                                <span className="flex items-center gap-1">
                                                    موبایل <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md" dir="ltr">({menu.icon || 'بدون آیکون'})</span>
                                                </span>
                                        }
                                    </td>
                                    <td className="p-4">{menu.order}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${menu.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {menu.is_active ? "فعال" : "غیرفعال"}
                                        </span>
                                    </td>
                                    <td className="p-4 flex gap-3">
                                        <button onClick={() => handleEdit(menu)} className="text-blue-600 hover:text-blue-800 font-bold">ویرایش</button>
                                        <button onClick={() => handleDelete(menu.id)} className="text-red-500 hover:text-red-700 font-bold">حذف</button>
                                    </td>
                                </tr>
                            ))
                        )}

                    </tbody>
                </table>
            </div>
        </div>
    );
}