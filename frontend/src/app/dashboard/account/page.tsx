"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, CheckCircle2, LoaderCircle, Lock, Save, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import {
  PROFILE_UPDATED_EVENT,
  type UserProfile,
  initialOf,
  maskNationalId,
  maskPhone,
  roleInfo,
} from "@/components/layout/profileUtils";

// صفحه‌ی حساب کاربری مشترک (مشتری و ادمین؛ صاحب کسب‌وکار صفحه‌ی خودش را دارد)
export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<UserProfile>("/identity/profile/")
      .then(({ data }) => {
        setProfile(data);
        setFullName(data.full_name || "");
      })
      .catch(() => setError("دریافت اطلاعات حساب با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = fullName.trim();
    if (value.length < 3) {
      setError("نام و نام خانوادگی باید حداقل ۳ حرف باشد.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { data } = await api.patch<UserProfile>("/identity/profile/", { full_name: value });
      setProfile(data);
      setSaved(true);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { full_name: data.full_name } }));
    } catch {
      setError("ذخیره‌ی تغییرات با خطا مواجه شد. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24 text-gray-500"><LoaderCircle className="h-7 w-7 animate-spin" /></div>;
  }

  const info = roleInfo(profile?.role);
  const unchanged = fullName.trim() === (profile?.full_name || "");
  const readonlyField = "flex min-h-12 items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 text-sm text-gray-600";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* کارت معرفی */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-brand-900 p-6 text-white sm:p-8"
      >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black ring-4 ring-white/10 ${info.avatar}`}>
            {initialOf(profile?.full_name) ?? <UserRound className="h-7 w-7" />}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">{profile?.full_name || "کاربر چهارسوق"}</h1>
            <p className="mt-1 text-sm text-brand-200" dir="ltr" style={{ textAlign: "right" }}>{maskPhone(profile?.phone_number)}</p>
            <span className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${info.badge}`}>
              <BadgeCheck className="h-3.5 w-3.5" />
              {info.label}
            </span>
          </div>
        </div>
      </motion.section>

      {/* فرم */}
      <motion.form
        onSubmit={save}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-lg font-black text-gray-900">اطلاعات حساب</h2>

        <div>
          <label htmlFor="full_name" className="mb-2 block text-sm font-bold text-gray-700">نام و نام خانوادگی</label>
          <input
            id="full_name"
            value={fullName}
            maxLength={255}
            onChange={(e) => {
              setFullName(e.target.value);
              setSaved(false);
            }}
            className="min-h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="مثلاً: سارا محمدی"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-bold text-gray-700">شماره موبایل</span>
            <div className={readonlyField}>
              <span dir="ltr">{maskPhone(profile?.phone_number)}</span>
              <Lock className="h-4 w-4 text-gray-300" aria-label="غیرقابل ویرایش" />
            </div>
          </div>
          <div>
            <span className="mb-2 block text-sm font-bold text-gray-700">کد ملی</span>
            <div className={readonlyField}>
              <span dir="ltr">{maskNationalId(profile?.national_id)}</span>
              <Lock className="h-4 w-4 text-gray-300" aria-label="غیرقابل ویرایش" />
            </div>
          </div>
        </div>
        <p className="text-xs leading-6 text-gray-500">شماره موبایل و کد ملی با سامانه‌ی شاهکار تأیید شده‌اند و قابل تغییر نیستند. برای تغییر با پشتیبانی تماس بگیرید.</p>

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600" role="alert">{error}</p>}
        {saved && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand-700" role="status">
            <CheckCircle2 className="h-4 w-4" />
            تغییرات ذخیره شد.
          </motion.p>
        )}

        <button
          type="submit"
          disabled={saving || unchanged}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          ذخیره‌ی تغییرات
        </button>
      </motion.form>
    </div>
  );
}
