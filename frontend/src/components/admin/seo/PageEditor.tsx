"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Btn, Field, Modal, Notice, inputCls } from "@/components/club/ui";
import { apiError, toFaDigits } from "@/lib/club";
import { SerpPreview, SocialPreview } from "./SerpPreview";

export type SeoCheck = { id: string; level: "ok" | "warn" | "bad"; message: string; weight: number; earned: number };
export type SeoAnalysis = { score: number | null; status: "good" | "warn" | "bad" | "noindex"; checks: SeoCheck[] };
export type SeoCustom = { title: string; description: string; focus_keyword: string; canonical: string; og_image: string; noindex: boolean };
export type SeoDetail = {
  type: string; key: string; label: string; path: string; url: string;
  custom: SeoCustom; auto: { title: string; description: string };
  effective: { title: string; description: string; canonical: string; og_image: string };
  analysis: SeoAnalysis; customized: boolean;
};

export const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  good: { label: "خوب", cls: "bg-emerald-50 text-emerald-700" },
  warn: { label: "نیازمند بهبود", cls: "bg-saffron-50 text-saffron-800" },
  bad: { label: "ضعیف", cls: "bg-rose-50 text-rose-700" },
  noindex: { label: "noindex", cls: "bg-gray-100 text-gray-600" },
};

export function ScoreBadge({ score, status }: { score: number | null; status: string }) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.bad;
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-black ${st.cls}`}>
      {score === null ? "—" : toFaDigits(score)}
      <span className="font-bold">{st.label}</span>
    </span>
  );
}

const textareaCls =
  "no-focus-ring w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 disabled:bg-gray-50";

function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  return <span className={`text-[11px] font-bold ${ok ? "text-emerald-600" : "text-saffron-700"}`} dir="ltr">{n}/{max}</span>;
}

const LEVEL_ICON = {
  ok: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="خوب" />,
  warn: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" aria-label="نیازمند بهبود" />,
  bad: <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-label="ضعیف" />,
};

type Target = { type: string; key: string; label: string };

/** ویرایشگر سئوی یک صفحه با پیش‌نمایش و نمره‌ی زنده */
export default function PageEditor({ target, onClose, onChanged }: {
  target: Target | null; onClose: () => void; onChanged: () => void;
}) {
  return (
    <Modal open={!!target} onClose={onClose} title={target ? `سئو: ${target.label}` : ""} wide>
      {/* با تغییر صفحه، key عوض می‌شود و همه‌ی state ها از نو شروع می‌شوند */}
      {target && <EditorBody key={`${target.type}:${target.key}`} target={target} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

function EditorBody({ target, onClose, onChanged }: { target: Target; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<SeoDetail | null>(null);
  const [form, setForm] = useState<SeoCustom | null>(null);
  const [live, setLive] = useState<SeoDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const params = { type: target.type, key: target.key };
  const isHome = target.type === "static" && target.key === "/";

  useEffect(() => {
    let cancelled = false;
    api.get("/seo/admin/pages/detail/", { params })
      .then((r) => { if (!cancelled) { setDetail(r.data); setForm(r.data.custom); setLive(r.data); } })
      .catch((e) => { toast.error(apiError(e)); onClose(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.type, target.key]);

  // نمره و پیش‌نمایش با کمی تأخیر بعد از تایپ به‌روز می‌شوند (ذخیره نمی‌شود)
  useEffect(() => {
    if (!form) return;
    const t = setTimeout(() => {
      api.post("/seo/admin/analyze/", { type: target.type, key: target.key, ...form })
        .then((r) => setLive(r.data))
        .catch(() => { /* پیش‌نمایش زنده اختیاری است */ });
    }, 400);
    return () => clearTimeout(t);
  }, [form, target]);

  const dirty = useMemo(() => !!detail && !!form && JSON.stringify(form) !== JSON.stringify(detail.custom), [detail, form]);

  const set = <K extends keyof SeoCustom>(k: K, v: SeoCustom[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await api.put("/seo/admin/pages/detail/", form, { params });
      setDetail(r.data); setForm(r.data.custom); setLive(r.data);
      toast.success("تنظیمات سئو ذخیره شد؛ تا یک دقیقه‌ی دیگر روی سایت اعمال می‌شود.");
      onChanged();
    } catch (e) {
      const d = (e as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      const first = d && Object.values(d)[0];
      toast.error(Array.isArray(first) ? first[0] : typeof first === "string" ? first : apiError(e));
    } finally { setSaving(false); }
  };

  const reset = async () => {
    setResetting(true);
    try {
      const r = await api.delete("/seo/admin/pages/detail/", { params });
      setDetail(r.data); setForm(r.data.custom); setLive(r.data);
      toast.success("به حالت خودکار برگشت.");
      onChanged();
    } catch (e) { toast.error(apiError(e)); }
    finally { setResetting(false); }
  };

  const eff = live?.effective;

  return (
    <>
      {!detail || !form || !live ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p dir="ltr" className="truncate text-left text-xs text-gray-500">{detail.url}</p>
            <ScoreBadge score={live.analysis.score} status={live.analysis.status} />
          </div>

          <SerpPreview title={eff?.title || ""} description={eff?.description || ""} url={detail.url} />

          <div className="space-y-4">
            <Field label="عنوان سئو" hint={form.title ? undefined : "خالی = خودکار (همان مقدار داخل کادر)"}>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={detail.auto.title} className={inputCls} maxLength={255} />
              <div className="mt-1 flex items-center justify-between">
                <button type="button" onClick={() => set("title", detail.auto.title)} className="min-h-8 text-[11px] font-bold text-brand-700 hover:underline">کپی مقدار خودکار برای ویرایش</button>
                <Counter n={(eff?.title || "").length} min={30} max={60} />
              </div>
            </Field>

            <Field label="توضیح متا" hint={form.description ? undefined : "خالی = خودکار"}>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={detail.auto.description}
                rows={3} className={textareaCls} maxLength={500} />
              <div className="mt-1 flex items-center justify-between">
                <button type="button" onClick={() => set("description", detail.auto.description)} className="min-h-8 text-[11px] font-bold text-brand-700 hover:underline">کپی مقدار خودکار برای ویرایش</button>
                <Counter n={(eff?.description || "").length} min={70} max={160} />
              </div>
            </Field>

            <Field label="کلمه‌ی کلیدی اصلی" hint="فقط برای نمره‌دهی داخلی است و در سایت نمایش داده نمی‌شود.">
              <input value={form.focus_keyword} onChange={(e) => set("focus_keyword", e.target.value)} placeholder="مثلاً: رستوران چهارباغ" className={inputCls} maxLength={120} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="تصویر اشتراک‌گذاری" hint="آدرس تصویر، مثل /media/… یا https://… (خالی = تصویر خودکار)">
                <input dir="ltr" value={form.og_image} onChange={(e) => set("og_image", e.target.value)} className={`${inputCls} text-left`} maxLength={500} />
              </Field>
              <Field label="آدرس کانونیکال" hint={isHome ? "برای صفحه‌ی اصلی قابل تنظیم نیست." : "خالی = آدرس خود صفحه"}>
                <input dir="ltr" value={form.canonical} onChange={(e) => set("canonical", e.target.value)} disabled={isHome}
                  className={`${inputCls} text-left`} maxLength={500} />
              </Field>
            </div>

            <label className={`flex min-h-11 items-start gap-3 rounded-xl border p-3 ${isHome ? "border-gray-100 bg-gray-50" : "border-gray-200"}`}>
              <input type="checkbox" checked={form.noindex} disabled={isHome} onChange={(e) => set("noindex", e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="block text-sm font-bold text-gray-800">عدم نمایش در گوگل (noindex)</span>
                <span className="block text-xs text-gray-500">
                  {isHome ? "برای صفحه‌ی اصلی قابل تنظیم نیست." : "این صفحه از نتایج گوگل و sitemap.xml حذف می‌شود."}
                </span>
              </span>
            </label>
          </div>

          <SocialPreview title={eff?.title || ""} description={eff?.description || ""} image={eff?.og_image || ""} url={detail.url} />

          <div>
            <p className="mb-2 text-xs font-black text-gray-600">بررسی سئو</p>
            <ul className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              {live.analysis.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm font-medium text-gray-700">
                  {LEVEL_ICON[c.level]}<span>{c.message}</span>
                </li>
              ))}
            </ul>
          </div>

          {isHome && <Notice>عنوان و توضیح صفحه‌ی اصلی پیش‌فرض همه‌ی صفحه‌هایی است که عنوان اختصاصی ندارند.</Notice>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
            <Btn variant="ghost" onClick={reset} loading={resetting} disabled={!detail.customized || saving}>
              <RotateCcw className="h-4 w-4" /> بازگشت به خودکار
            </Btn>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={onClose}>بستن</Btn>
              <Btn onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" /> ذخیره</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
