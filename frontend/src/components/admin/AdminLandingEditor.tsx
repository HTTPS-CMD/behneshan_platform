"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, ImagePlus, LoaderCircle, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { toast } from "@/components/ui/toaster";
import type { LandingContent, LandingPayload } from "@/components/site/landingTypes";

type SectionKey = keyof LandingContent;

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "۱. بخش اول (هیرو)",
  promo: "۲. نوار جشنواره",
  vip: "۳. باشگاه مشتریان VIP",
  business: "۴. جذب کسب‌وکارها",
};

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

function Field({ label, value, onChange, multiline, ltr, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  ltr?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      {multiline ? (
        <textarea rows={3} value={value} maxLength={600} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={placeholder} />
      ) : (
        <input value={value} maxLength={600} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined} placeholder={placeholder} />
      )}
    </label>
  );
}

/** یک بخش از لندینگ با تیک «نمایش» — بیرون از کامپوننت اصلی تا با هر تایپ، فیلدها از نو ساخته نشوند و فوکوس نپرد */
function Section({ title, visible, onToggle, children }: {
  title: string;
  visible: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <motion.fieldset
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 rounded-2xl border p-5 transition ${visible ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 opacity-70"}`}
    >
      <legend className="px-1 font-black text-gray-800">{title}</legend>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-gray-600">
        <input type="checkbox" checked={visible} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        نمایش این بخش در صفحه
      </label>
      {children}
    </motion.fieldset>
  );
}

/** ویرایشگر صفحه‌ی لندینگ در پنل ادمین (محتوای سایت ← صفحه‌ی لندینگ) */
export default function AdminLandingEditor() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = (data: LandingPayload) => {
    setContent(data.content);
    setHeroImage(data.hero_image);
    setNewImage(null);
    setRemoveImage(false);
    setDirty(false);
  };

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api
      .get<LandingPayload>("/cms/admin/landing/")
      .then(({ data }) => apply(data))
      .catch((err: { response?: { status?: number } }) => {
        // خطای ۵۰۰ معمولاً یعنی جدول لندینگ هنوز ساخته نشده (migrate اجرا نشده)
        setLoadError(
          err.response?.status === 500
            ? "سرور خطا داد. اگر تازه این بخش اضافه شده، در پوشه‌ی backend دستور python manage.py migrate را اجرا کنید."
            : "دریافت محتوای لندینگ با خطا مواجه شد."
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // به‌روزرسانی یک فیلد در یک بخش
  const set = <S extends SectionKey>(section: S, key: keyof LandingContent[S], value: unknown) => {
    setContent((c) => (c ? { ...c, [section]: { ...c[section], [key]: value } } : c));
    setDirty(true);
  };

  const save = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("content", JSON.stringify(content));
      if (newImage) form.append("hero_image", newImage);
      if (removeImage) form.append("remove_hero_image", "1");
      const { data } = await api.put<LandingPayload>("/cms/admin/landing/", form);
      apply(data);
      toast.success("صفحه‌ی لندینگ ذخیره شد و همین حالا در سایت نمایش داده می‌شود.");
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string } } }).response?.data;
      toast.error(res?.error || "ذخیره‌ی تغییرات با خطا مواجه شد.");
    } finally {
      setSaving(false);
    }
  };

  // پیش‌نمایش تصویر انتخاب‌شده (آدرس موقت بعد از تعویض آزاد می‌شود)
  const localPreview = useMemo(() => (newImage ? URL.createObjectURL(newImage) : null), [newImage]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const previewImage = localPreview ?? (removeImage ? null : heroImage ? mediaUrl(heroImage) : null);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center" dir="rtl">
        <p className="max-w-md text-sm font-medium leading-7 text-rose-700">{loadError}</p>
        <button onClick={load} className="rounded-xl bg-white px-5 py-2 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-100">تلاش دوباره</button>
      </div>
    );
  }

  if (loading || !content) {
    return <div className="flex justify-center py-16 text-gray-400"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
  }


  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-brand-800">ویرایش صفحه‌ی لندینگ</h3>
          <p className="text-sm text-gray-500">لینک دکمه‌ها فقط می‌تواند آدرس صفحات خود سایت باشد (با / شروع شود).</p>
        </div>
        <a href="/landing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:underline">
          مشاهده‌ی صفحه <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <Section title={SECTION_LABELS.hero} visible={content.hero.visible} onToggle={(v) => set("hero", "visible", v)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="برچسب بالای عنوان" value={content.hero.badge} onChange={(v) => set("hero", "badge", v)} />
          <Field label="عنوان اصلی" value={content.hero.title} onChange={(v) => set("hero", "title", v)} />
        </div>
        <Field label="توضیح زیر عنوان" multiline value={content.hero.subtitle} onChange={(v) => set("hero", "subtitle", v)} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="متن دکمه‌ی اصلی" value={content.hero.primary_text} onChange={(v) => set("hero", "primary_text", v)} />
          <Field label="لینک دکمه‌ی اصلی" ltr value={content.hero.primary_link} onChange={(v) => set("hero", "primary_link", v)} placeholder="/daily-discounts" />
          <Field label="متن دکمه‌ی دوم" value={content.hero.secondary_text} onChange={(v) => set("hero", "secondary_text", v)} />
          <Field label="لینک دکمه‌ی دوم" ltr value={content.hero.secondary_link} onChange={(v) => set("hero", "secondary_link", v)} placeholder="/register" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-600">تصویر پس‌زمینه (اختیاری — JPG/PNG/WebP، حداکثر ۵ مگابایت)</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-brand-900">
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImage} alt="پیش‌نمایش تصویر هیرو" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-slate-400">بدون تصویر (گرادیانت)</span>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
              <ImagePlus className="h-4 w-4" />
              انتخاب تصویر
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) return toast.error("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
                  setNewImage(f);
                  setRemoveImage(false);
                  setDirty(true);
                }}
              />
            </label>
            {(heroImage || newImage) && !removeImage && (
              <button
                type="button"
                onClick={() => { setNewImage(null); setRemoveImage(true); setDirty(true); }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" /> حذف تصویر
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section title={SECTION_LABELS.promo} visible={content.promo.visible} onToggle={(v) => set("promo", "visible", v)}>
        <Field label="عنوان" value={content.promo.title} onChange={(v) => set("promo", "title", v)} />
        <Field label="متن" multiline value={content.promo.text} onChange={(v) => set("promo", "text", v)} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="متن دکمه" value={content.promo.button_text} onChange={(v) => set("promo", "button_text", v)} />
          <Field label="لینک دکمه" ltr value={content.promo.button_link} onChange={(v) => set("promo", "button_link", v)} />
        </div>
      </Section>

      <Section title={SECTION_LABELS.vip} visible={content.vip.visible} onToggle={(v) => set("vip", "visible", v)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="عنوان کارت" value={content.vip.card_title} onChange={(v) => set("vip", "card_title", v)} />
          <Field label="عنوان کنار کارت" value={content.vip.side_title} onChange={(v) => set("vip", "side_title", v)} />
        </div>
        <Field label="متن کارت" multiline value={content.vip.card_text} onChange={(v) => set("vip", "card_text", v)} />
        <Field label="متن کنار کارت" multiline value={content.vip.side_text} onChange={(v) => set("vip", "side_text", v)} />
        <div className="grid gap-4 md:grid-cols-3">
          {content.vip.bullets.map((b, i) => (
            <Field
              key={i}
              label={`مزیت ${i + 1}`}
              value={b}
              onChange={(v) => set("vip", "bullets", content.vip.bullets.map((x, j) => (j === i ? v : x)))}
            />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="متن دکمه" value={content.vip.button_text} onChange={(v) => set("vip", "button_text", v)} />
          <Field label="لینک دکمه" ltr value={content.vip.button_link} onChange={(v) => set("vip", "button_link", v)} />
        </div>
      </Section>

      <Section title={SECTION_LABELS.business} visible={content.business.visible} onToggle={(v) => set("business", "visible", v)}>
        <Field label="عنوان" value={content.business.title} onChange={(v) => set("business", "title", v)} />
        <Field label="متن" multiline value={content.business.text} onChange={(v) => set("business", "text", v)} />
        <div className="grid gap-4 md:grid-cols-3">
          {content.business.features.map((f, i) => (
            <div key={i} className="space-y-3 rounded-xl bg-gray-50 p-3">
              <Field
                label={`ویژگی ${i + 1} — عنوان`}
                value={f.title}
                onChange={(v) => set("business", "features", content.business.features.map((x, j) => (j === i ? { ...x, title: v } : x)))}
              />
              <Field
                label="توضیح"
                multiline
                value={f.desc}
                onChange={(v) => set("business", "features", content.business.features.map((x, j) => (j === i ? { ...x, desc: v } : x)))}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="متن دکمه" value={content.business.button_text} onChange={(v) => set("business", "button_text", v)} />
          <Field label="لینک دکمه" ltr value={content.business.button_link} onChange={(v) => set("business", "button_link", v)} />
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-600 px-8 font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {dirty ? "ذخیره‌ی تغییرات" : "ذخیره شده"}
        </button>
      </div>
    </div>
  );
}
