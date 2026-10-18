"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";

export default function OwnerStoriesManage() {
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [link, setLink] = useState("");

    const fetchStories = async () => {
        try {
            const token = Cookies.get("access_token");
            const res = await api.get("/directory/owner/stories/", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStories(res.data.results || res.data);
        } catch (error) {
            console.error("خطا در دریافت استوری‌ها:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStories();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return alert("لطفاً یک تصویر یا ویدیو برای استوری انتخاب کنید.");

        setUploading(true);
        const formData = new FormData();
        formData.append("media", file);
        if (link) formData.append("link", link);

        try {
            const token = Cookies.get("access_token");
            await api.post("/directory/owner/stories/", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                }
            });
            alert("استوری با موفقیت منتشر شد!");
            setFile(null);
            setLink("");

            // پاک کردن مقدار اینپوت فایل
            const fileInput = document.getElementById('story-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            fetchStories();
        } catch (error) {
            alert("خطا در آپلود استوری. حجم فایل را بررسی کنید.");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("آیا از حذف این استوری مطمئن هستید؟")) return;
        try {
            const token = Cookies.get("access_token");
            await api.delete(`/directory/owner/stories/${id}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStories();
        } catch (error) {
            alert("خطا در حذف استوری");
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100" dir="rtl">
            <h2 className="text-xl font-black text-slate-800 mb-6 border-b pb-4">مدیریت استوری‌ها</h2>

            {/* فرم آپلود استوری */}
            <form onSubmit={handleUpload} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">فایل استوری (عکس)</label>
                    <input
                        id="story-file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full h-12 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all cursor-pointer"
                        required
                    />
                </div>

                <div className="w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">لینک اختیاری (Swipe Up)</label>
                    <input
                        type="url"
                        placeholder="https://..."
                        dir="ltr"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                    />
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    <span>{uploading ? "در حال آپلود..." : "انتشار استوری"}</span>
                </button>
            </form>

            {/* لیست استوری‌های فعال */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">استوری‌های فعال شما (۲۴ ساعت گذشته)</h3>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
                ) : stories.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <ImageIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium">شما در حال حاضر استوری فعالی ندارید.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {stories.map((story) => (
                            <div key={story.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-[9/16] bg-slate-900">
                                <img
                                    src={story.media.startsWith('http') ? story.media : `http://127.0.0.1:8000${story.media}`}
                                    alt="Story"
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                />

                                {/* کاور تیره روی عکس برای بهتر دیده شدن متن و دکمه */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>

                                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10">
                                    <span className="text-[10px] font-bold text-white bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                                        {story.is_active ? "فعال" : "منقضی شده"}
                                    </span>

                                    <button
                                        onClick={() => handleDelete(story.id)}
                                        className="bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-lg transition-colors shadow-lg"
                                        title="حذف استوری"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}