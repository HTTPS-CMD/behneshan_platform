"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, Field, Notice, inputCls } from "@/components/club/ui";
import { apiError } from "@/lib/club";

type Settings = Record<string, string>;
const FIELDS: { key: string; label: string; hint: string; ltr?: boolean; multiline?: boolean; placeholder?: string }[] = [
  { key: "seo_default_og_image", label: "تصویر پیش‌فرض اشتراک‌گذاری", hint: "برای صفحه‌هایی که تصویر اختصاصی ندارند. آدرس با / یا https:// شروع شود.", ltr: true, placeholder: "/brand/logo-full.png" },
  { key: "seo_org_name", label: "نام سازمان (برای اسکیما)", hint: "خالی = چهارسوق" },
  { key: "seo_org_logo", label: "لوگوی سازمان (برای اسکیما)", hint: "نمایش لوگو کنار نتیجه‌ی گوگل. خالی = لوگوی پیش‌فرض برند.", ltr: true },
  { key: "seo_org_phone", label: "شماره تماس سازمان (برای اسکیما)", hint: "اختیاری؛ مثل 031-12345678", ltr: true },
  { key: "seo_instagram", label: "اینستاگرام", hint: "آیدی یا آدرس کامل؛ در اسکیمای سازمان می‌آید.", ltr: true, placeholder: "4soghtalk" },
  { key: "seo_google_verification", label: "کد تأیید Google Search Console", hint: "فقط مقدار content تگ meta (اگر کل تگ را بچسبانید، خودکار جدا می‌شود).", ltr: true },
  { key: "seo_bing_verification", label: "کد تأیید Bing Webmaster", hint: "مقدار msvalidate.01", ltr: true },
  { key: "seo_robots_disallow", label: "مسیرهای اضافه‌ی بسته در robots.txt", hint: "هر مسیر در یک خط و با / شروع شود. مسیرهای پنل و API همیشه بسته‌اند.", ltr: true, multiline: true, placeholder: "/private" },
];

// باید با robots.ts یکی باشد؛ فقط برای نمایش پیش‌نمایش
const BASE_DISALLOW = ["/dashboard", "/admin-panel", "/login", "/register", "/api"];

/** تنظیمات کلی سئو: اسکیمای سازمان، کدهای تأیید و robots.txt */
export default function SeoSettingsForm() {
  const [data, setData] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<Settings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/seo/admin/settings/").then((r) => { setData(r.data); setSaved(r.data); }).catch((e) => toast.error(apiError(e)));
  }, []);

  const dirty = useMemo(() => !!data && !!saved && JSON.stringify(data) !== JSON.stringify(saved), [data, saved]);

  const robotsText = useMemo(() => {
    const extra = (data?.seo_robots_disallow || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("/") && l !== "/");
    const rules = Array.from(new Set([...BASE_DISALLOW, ...extra]));
    return ["User-Agent: *", "Allow: /", ...rules.map((r) => `Disallow: ${r}`), "", "Host: https://4sogh.shop", "Sitemap: https://4sogh.shop/sitemap.xml"].join("\n");
  }, [data]);

  const save = async () => {
    if (!data) return;
    setSaving(true); setErrors({});
    try {
      const r = await api.put("/seo/admin/settings/", data);
      setData(r.data); setSaved(r.data);
      toast.success("تنظیمات ذخیره شد؛ تا یک دقیقه‌ی دیگر روی سایت اعمال می‌شود.");
    } catch (e) {
      const errs = (e as { response?: { data?: { errors?: Settings } } })?.response?.data?.errors;
      if (errs) { setErrors(errs); toast.error("برخی فیلدها نامعتبرند."); } else toast.error(apiError(e));
    } finally { setSaving(false); }
  };

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-5">
      <Notice>عنوان و توضیح صفحه‌ی اصلی را از تب «صفحه‌ها» ← «صفحه‌ی اصلی» تغییر دهید.</Notice>
      <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]} className={f.multiline ? "md:col-span-2" : ""}>
            {f.multiline ? (
              <textarea dir="ltr" rows={4} value={data[f.key] || ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="no-focus-ring w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-900 focus:border-brand-400 focus:ring-3 focus:ring-brand-100" />
            ) : (
              <input dir={f.ltr ? "ltr" : undefined} value={data[f.key] || ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                placeholder={f.placeholder} className={`${inputCls} ${f.ltr ? "text-left" : ""}`} />
            )}
          </Field>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-black text-gray-600">پیش‌نمایش robots.txt</p>
        <pre dir="ltr" className="overflow-auto rounded-2xl bg-gray-900 p-4 text-left text-xs leading-relaxed text-gray-100">{robotsText}</pre>
      </div>

      <div className="flex justify-end">
        <Btn onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" /> ذخیره‌ی تنظیمات</Btn>
      </div>
    </div>
  );
}
