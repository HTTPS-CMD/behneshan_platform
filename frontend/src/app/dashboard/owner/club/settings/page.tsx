"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Layers, Loader2, Pencil, Percent, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import ClubHeader from "@/components/club/ClubHeader";
import { Btn, EmptyState, Field, Modal, Notice, inputCls } from "@/components/club/ui";
import { apiError, fmtMoney, parseAmount, toEnDigits } from "@/lib/club";

interface Line {
  id: number; branch: number; name: string; description: string;
  cashback_percent: string; max_amount: number | null; sms_template?: string; is_active: boolean;
}
interface Branch {
  id: number; name: string; description: string; address: string; is_active: boolean; lines: Line[];
}
interface Settings {
  default_cashback_percent: string; max_credit_use_percent: number; cashback_expiry_days: number;
}

const emptyBranch = { name: "", description: "", address: "", is_active: true };
const emptyLine = { name: "", description: "", cashback_percent: "", max_amount: "", sms_template: "", is_active: true };

export default function ClubSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [branchModal, setBranchModal] = useState<{ open: boolean; edit?: Branch }>({ open: false });
  const [branchForm, setBranchForm] = useState(emptyBranch);
  const [lineModal, setLineModal] = useState<{ open: boolean; branch?: Branch; edit?: Line }>({ open: false });
  const [lineForm, setLineForm] = useState(emptyLine);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([api.get("/loyalty/owner/settings/"), api.get("/loyalty/owner/branches/")]);
      setSettings(s.data);
      setBranches(b.data);
      setLoadError("");
    } catch (e) {
      setLoadError(apiError(e, "دریافت اطلاعات ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await api.put("/loyalty/owner/settings/", {
        default_cashback_percent: toEnDigits(String(settings.default_cashback_percent || 0)),
        max_credit_use_percent: Number(toEnDigits(String(settings.max_credit_use_percent || 0))),
        cashback_expiry_days: Number(toEnDigits(String(settings.cashback_expiry_days || 0))),
      });
      setSettings(res.data);
      toast.success("تنظیمات باشگاه ذخیره شد.");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingSettings(false);
    }
  };

  const openBranch = (edit?: Branch) => {
    setBranchForm(edit ? { name: edit.name, description: edit.description, address: edit.address, is_active: edit.is_active } : emptyBranch);
    setBranchModal({ open: true, edit });
  };

  const saveBranch = async () => {
    if (!branchForm.name.trim()) return toast.error("نام شعبه را وارد کنید.");
    setSaving(true);
    try {
      if (branchModal.edit) await api.patch(`/loyalty/owner/branches/${branchModal.edit.id}/`, branchForm);
      else await api.post("/loyalty/owner/branches/", branchForm);
      toast.success("شعبه ذخیره شد.");
      setBranchModal({ open: false });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async (b: Branch) => {
    if (!window.confirm(`شعبه‌ی «${b.name}» و بخش‌هایش حذف شود؟ تراکنش‌های قبلی باقی می‌مانند.`)) return;
    try {
      await api.delete(`/loyalty/owner/branches/${b.id}/`);
      toast.success("شعبه حذف شد.");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const openLine = (branch: Branch, edit?: Line) => {
    setLineForm(edit ? {
      name: edit.name, description: edit.description, cashback_percent: String(Number(edit.cashback_percent)),
      max_amount: edit.max_amount ? String(edit.max_amount) : "", sms_template: edit.sms_template || "", is_active: edit.is_active,
    } : emptyLine);
    setLineModal({ open: true, branch, edit });
  };

  const saveLine = async () => {
    if (!lineForm.name.trim()) return toast.error("نام بخش را وارد کنید.");
    const pct = Number(toEnDigits(lineForm.cashback_percent || "0"));
    if (!(pct >= 0 && pct <= 100)) return toast.error("درصد کش‌بک باید بین ۰ تا ۱۰۰ باشد.");
    setSaving(true);
    const payload = {
      branch: lineModal.branch!.id, name: lineForm.name, description: lineForm.description,
      cashback_percent: pct, max_amount: lineForm.max_amount ? parseAmount(lineForm.max_amount) : null,
      sms_template: lineForm.sms_template,
      is_active: lineForm.is_active,
    };
    try {
      if (lineModal.edit) await api.patch(`/loyalty/owner/lines/${lineModal.edit.id}/`, payload);
      else await api.post("/loyalty/owner/lines/", payload);
      toast.success("بخش فروش ذخیره شد.");
      setLineModal({ open: false });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteLine = async (l: Line) => {
    if (!window.confirm(`بخش «${l.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/loyalty/owner/lines/${l.id}/`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-9 w-9 animate-spin text-brand-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <ClubHeader title="شعب و تنظیمات باشگاه" subtitle="درصد کش‌بک، شعب و بخش‌های فروش فروشگاه خود را تعیین کنید." />

      {loadError && <Notice tone="error">{loadError}</Notice>}

      {settings && (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-brand-900">
            <Percent className="h-5 w-5 text-saffron-500" /> قوانین کش‌بک
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            بعد از هر خرید، درصدی از مبلغ پرداختی به‌عنوان اعتبار به کیف‌پول مشتری در فروشگاه شما برمی‌گردد و در خریدهای بعدی خرج می‌شود.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="درصد کش‌بک پیش‌فرض" hint="برای خریدهایی که بخش فروش انتخاب نشده">
              <input inputMode="decimal" className={inputCls} dir="ltr" value={settings.default_cashback_percent}
                onChange={(e) => setSettings({ ...settings, default_cashback_percent: e.target.value })} />
            </Field>
            <Field label="حداکثر پرداخت با اعتبار (٪ فاکتور)" hint="مثلاً ۵۰ یعنی نیمی از فاکتور">
              <input inputMode="numeric" className={inputCls} dir="ltr" value={settings.max_credit_use_percent}
                onChange={(e) => setSettings({ ...settings, max_credit_use_percent: e.target.value as any })} />
            </Field>
            <Field label="مدت اعتبار کش‌بک (روز)" hint="۰ یعنی اعتبار منقضی نمی‌شود">
              <input inputMode="numeric" className={inputCls} dir="ltr" value={settings.cashback_expiry_days}
                onChange={(e) => setSettings({ ...settings, cashback_expiry_days: e.target.value as any })} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Btn onClick={saveSettings} loading={savingSettings}><Save className="h-4 w-4" /> ذخیره‌ی تنظیمات</Btn>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-brand-900">
              <GitBranch className="h-5 w-5 text-saffron-500" /> شعب و بخش‌های فروش
            </h2>
            <p className="mt-1 text-sm text-gray-500">هر شعبه می‌تواند چند بخش (مثلاً پوشاک، لوازم خانگی) با درصد کش‌بک جدا داشته باشد.</p>
          </div>
          <Btn variant="accent" onClick={() => openBranch()}><Plus className="h-4 w-4" /> افزودن شعبه</Btn>
        </div>

        {branches.length === 0 ? (
          <EmptyState icon={GitBranch} title="هنوز شعبه‌ای ثبت نکرده‌اید"
            text="اگر فقط یک فروشگاه دارید هم می‌توانید بدون شعبه کار کنید؛ در آن صورت درصد کش‌بک پیش‌فرض اعمال می‌شود." />
        ) : (
          <div className="space-y-4">
            {branches.map((b) => (
              <div key={b.id} className="rounded-2xl border border-gray-100 bg-cream/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-black text-gray-900">
                      {b.name}
                      {!b.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">غیرفعال</span>}
                    </p>
                    {(b.description || b.address) && <p className="mt-1 text-xs text-gray-500">{b.description || b.address}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Btn variant="outline" className="h-10 px-3" onClick={() => openLine(b)}><Plus className="h-4 w-4" /> بخش</Btn>
                    <Btn variant="ghost" className="h-10 w-10 px-0" aria-label="ویرایش شعبه" onClick={() => openBranch(b)}><Pencil className="h-4 w-4" /></Btn>
                    <Btn variant="danger" className="h-10 w-10 px-0" aria-label="حذف شعبه" onClick={() => deleteBranch(b)}><Trash2 className="h-4 w-4" /></Btn>
                  </div>
                </div>
                {b.lines.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {b.lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-gray-800">
                            <Layers className="h-3.5 w-3.5 text-brand-400" /> {l.name}
                            {!l.is_active && <span className="text-[10px] text-gray-500">(غیرفعال)</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            کش‌بک {Number(l.cashback_percent).toLocaleString("fa-IR")}٪
                            {l.max_amount ? ` · سقف ${fmtMoney(l.max_amount)} تومان` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <button aria-label="ویرایش بخش" onClick={() => openLine(b, l)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                          <button aria-label="حذف بخش" onClick={() => deleteLine(l)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">این شعبه بخش فروش ندارد؛ خریدهای آن با درصد پیش‌فرض محاسبه می‌شوند.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={branchModal.open} onClose={() => setBranchModal({ open: false })} title={branchModal.edit ? "ویرایش شعبه" : "افزودن شعبه"}>
        <div className="space-y-4">
          <Field label="نام شعبه *"><input className={inputCls} value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></Field>
          <Field label="توضیحات"><input className={inputCls} value={branchForm.description} onChange={(e) => setBranchForm({ ...branchForm, description: e.target.value })} /></Field>
          <Field label="آدرس"><input className={inputCls} value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></Field>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={branchForm.is_active} onChange={(e) => setBranchForm({ ...branchForm, is_active: e.target.checked })} />
            شعبه فعال است
          </label>
          <Btn className="w-full" onClick={saveBranch} loading={saving}>ذخیره</Btn>
        </div>
      </Modal>

      <Modal open={lineModal.open} onClose={() => setLineModal({ open: false })} title={lineModal.edit ? "ویرایش بخش فروش" : `افزودن بخش به «${lineModal.branch?.name || ""}»`}>
        <div className="space-y-4">
          <Field label="نام بخش *"><input className={inputCls} value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })} placeholder="مثلاً پوشاک" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="درصد کش‌بک"><input inputMode="decimal" dir="ltr" className={inputCls} value={lineForm.cashback_percent} onChange={(e) => setLineForm({ ...lineForm, cashback_percent: e.target.value })} placeholder="5" /></Field>
            <Field label="سقف مبلغ مشمول (تومان)" hint="خالی = بدون سقف">
              <input inputMode="numeric" dir="ltr" className={inputCls} value={lineForm.max_amount ? parseAmount(lineForm.max_amount).toLocaleString("en-US") : ""} onChange={(e) => setLineForm({ ...lineForm, max_amount: e.target.value })} />
            </Field>
          </div>
          <Field label="توضیحات"><input className={inputCls} value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} /></Field>
          <Field label="قالب پیامک خرید این بخش (اختیاری)" hint="خالی = قالب کلی فروشگاه. متغیرها: {نام} {فروشگاه} {مبلغ} {کش_بک} {موجودی}">
            <textarea className={`${inputCls} h-20 py-2`} maxLength={400} value={lineForm.sms_template} onChange={(e) => setLineForm({ ...lineForm, sms_template: e.target.value })} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={lineForm.is_active} onChange={(e) => setLineForm({ ...lineForm, is_active: e.target.checked })} />
            بخش فعال است
          </label>
          <Btn className="w-full" onClick={saveLine} loading={saving}>ذخیره</Btn>
        </div>
      </Modal>
    </div>
  );
}
