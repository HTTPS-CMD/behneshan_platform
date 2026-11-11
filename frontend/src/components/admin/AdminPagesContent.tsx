"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Save, FileText } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { toEnDigits } from "@/lib/club";

const PAGE_OPTIONS = [
    { value: "about", label: "درباره ما" },
    { value: "contact", label: "تماس با ما" },
    { value: "terms_client", label: "قوانین مشتریان" },
    { value: "terms_business", label: "قوانین کسب و کار" },
];

export default function AdminPagesContent() {
    const [selectedPage, setSelectedPage] = useState(PAGE_OPTIONS[0].value);
    const [content, setContent] = useState({ title: "", content: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // دریافت محتوای صفحه‌ی انتخاب شده
    useEffect(() => {
        if (selectedPage === "contact") return; // متن ثابت است؛ نیازی به دریافت نیست
        const fetchContent = async () => {
            setIsLoading(true);
            try {
                // استفاده از API ادمین یا عمومی برای گرفتن دیتای فعلی
                const res = await api.get(`/directory/content/${selectedPage}/`);
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
            await api.put(`/directory/admin/content/${selectedPage}/`, content);
            toast.success("تغییرات با موفقیت ذخیره شد!");
        } catch (error) {
            toast.error("خطا در ذخیره اطلاعات.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <FileText className="w-6 h-6 text-brand-600" />
                <h2 className="text-xl font-black text-brand-800">مدیریت متون سایت</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">انتخاب صفحه برای ویرایش</label>
                    <select
                        value={selectedPage}
                        onChange={(e) => setSelectedPage(e.target.value)}
                        // تغییر در کلاس‌ها: محدود کردن عرض در دسکتاپ (md:w-72) و اضافه کردن cursor-pointer
                        className="w-full md:w-72 h-12 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-brand-500 font-bold outline-none cursor-pointer transition-all"
                    >
                        {PAGE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {selectedPage === "contact" ? (
                    // صفحه‌ی تماس چیدمان ثابت دارد؛ فقط فیلدهای «اطلاعات تماس» پایین از پنل ویرایش می‌شوند
                    <p className="rounded-xl bg-brand-50 p-4 text-sm font-medium leading-relaxed text-brand-800">
                        متن صفحه‌ی «تماس با ما» ثابت است و از این‌جا ویرایش نمی‌شود. آدرس، شماره تماس، اینستاگرام و وب‌سایت را از بخش «اطلاعات تماس» همین صفحه تغییر دهید.
                    </p>
                ) : isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">عنوان صفحه</label>
                            <input
                                type="text"
                                value={content.title}
                                onChange={(e) => setContent({ ...content, title: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500"
                                placeholder="مثلاً: درباره پلتفرم چهارسوق"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">متن اصلی</label>
                            <textarea
                                value={content.content}
                                onChange={(e) => setContent({ ...content, content: e.target.value })}
                                className="w-full h-64 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 leading-loose"
                                placeholder="متن قوانین یا توضیحات را اینجا بنویسید..."
                            />
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full md:w-auto h-12 px-8 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 ml-2" /> ذخیره تغییرات</>}
                        </Button>
                    </div>
                )}

                {selectedPage === "contact" && <ContactInfoFields />}
            </div>
        </div>
    );
}

// ---------- اطلاعات تماس (جدول «راه‌های ارتباطی» صفحه‌ی تماس با ما) ----------
type CField = { key: string; label: string; hint: string; multiline?: boolean; ltr?: boolean };
const CONTACT_FIELDS: CField[] = [
    { key: "contact_address", label: "آدرس", hint: "اگر خالی باشد، ردیف آدرس در صفحه نمایش داده نمی‌شود.", multiline: true },
    { key: "contact_phone", label: "شماره تماس", hint: "اگر خالی باشد، ردیف شماره تماس نمایش داده نمی‌شود.", ltr: true },
    { key: "contact_instagram", label: "آیدی اینستاگرام", hint: "بدون @ ؛ پیش‌فرض: 4soghtalk", ltr: true },
    { key: "contact_website", label: "وب‌سایت", hint: "پیش‌فرض: 4sogh.shop", ltr: true },
    { key: "private_contact_notify_phone", label: "موبایل مدیر برای پیامک پیام جدید", hint: "فقط برای پیامک اعلان؛ در سایت نمایش داده نمی‌شود. مثال: 09123456789", ltr: true },
];

type Row = { id?: number; value: string };

function ContactInfoFields() {
    const [rows, setRows] = useState<Record<string, Row>>({});
    const [initial, setInitial] = useState<Record<string, Row>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/cms/admin/settings/");
                const list: any[] = Array.isArray(res.data) ? res.data : res.data?.results || [];
                const map: Record<string, Row> = {};
                CONTACT_FIELDS.forEach((f) => {
                    const hit = list.find((x) => x.key === f.key);
                    map[f.key] = { id: hit?.id, value: hit?.value || "" };
                });
                setRows(map);
                setInitial(map);
            } catch {
                toast.error("خطا در دریافت اطلاعات تماس.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const save = async () => {
        const sms = toEnDigits((rows.private_contact_notify_phone?.value || "").trim());
        if (sms && !/^09\d{9}$/.test(sms)) {
            toast.error("شماره موبایل مدیر را به‌صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
            return;
        }
        setSaving(true);
        try {
            const next: Record<string, Row> = { ...rows };
            for (const f of CONTACT_FIELDS) {
                const cur = rows[f.key] || { value: "" };
                const old = initial[f.key] || { value: "" };
                let value = cur.value.trim();
                if (f.key === "private_contact_notify_phone") value = sms;
                if (value === old.value.trim()) continue;
                if (old.id && !value) {
                    await api.delete(`/cms/admin/settings/${old.id}/`);
                    next[f.key] = { value: "" };
                } else if (old.id) {
                    await api.patch(`/cms/admin/settings/${old.id}/`, { value });
                    next[f.key] = { id: old.id, value };
                } else if (value) {
                    const r = await api.post("/cms/admin/settings/", { key: f.key, value, description: f.label });
                    next[f.key] = { id: r.data?.id, value };
                }
            }
            setRows(next);
            setInitial(next);
            toast.success("اطلاعات تماس ذخیره شد.");
        } catch {
            toast.error("خطا در ذخیره‌ی اطلاعات تماس.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 border-t border-gray-100 pt-6">
            <div>
                <h3 className="text-lg font-black text-brand-800">اطلاعات تماس (جدول راه‌های ارتباطی)</h3>
                <p className="mt-1 text-xs text-gray-500">این مقادیر در جدول صفحه‌ی «تماس با ما» نمایش داده می‌شوند و جدا از متن بالا ذخیره می‌شوند.</p>
            </div>
            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
            ) : (
                <>
                    {CONTACT_FIELDS.map((f) => {
                        const common = {
                            id: `ci-${f.key}`,
                            value: rows[f.key]?.value || "",
                            onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
                                setRows({ ...rows, [f.key]: { ...rows[f.key], value: e.target.value } }),
                            dir: f.ltr ? "ltr" : undefined,
                            className: `w-full rounded-xl border border-gray-200 px-4 focus:ring-2 focus:ring-brand-500 outline-none ${f.ltr ? "text-left" : ""}`,
                        };
                        return (
                            <div key={f.key}>
                                <label htmlFor={common.id} className="block text-sm font-bold text-gray-700 mb-2">{f.label}</label>
                                {f.multiline
                                    ? <textarea {...common} rows={3} className={`${common.className} py-3 leading-loose`} />
                                    : <input {...common} type="text" className={`${common.className} h-12`} />}
                                <p className="mt-1 text-xs text-gray-500">{f.hint}</p>
                            </div>
                        );
                    })}
                    <Button
                        onClick={save}
                        disabled={saving}
                        className="w-full md:w-auto h-12 px-8 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 ml-2" /> ذخیره اطلاعات تماس</>}
                    </Button>
                </>
            )}
        </div>
    );
}
