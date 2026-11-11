import { toFaDigits } from "@/lib/format";
// ابزارهای مشترک منوی پروفایل و صفحه‌ی حساب کاربری

export interface UserProfile {
  phone_number: string;
  full_name: string | null;
  national_id: string | null;
  role: string;
}

// وقتی نام در صفحه‌ی حساب کاربری عوض شود، منوی هدر هم بدون رفرش به‌روز می‌شود
export const PROFILE_UPDATED_EVENT = "profile-updated";

export const ROLE_INFO: Record<string, { label: string; badge: string; avatar: string }> = {
  ADMIN: { label: "مدیر سایت", badge: "bg-brand-900 text-white", avatar: "bg-brand-900 text-white ring-brand-200" },
  BUSINESS_OWNER: { label: "صاحب کسب‌وکار", badge: "bg-saffron-100 text-saffron-800", avatar: "bg-saffron-500 text-brand-950 ring-saffron-100" },
  CLIENT: { label: "مشتری", badge: "bg-brand-100 text-brand-800", avatar: "bg-brand-600 text-white ring-brand-100" },
};

export const roleInfo = (role?: string | null) => ROLE_INFO[(role || "").toUpperCase()] ?? ROLE_INFO.CLIENT;

export { toFaDigits };

export const maskPhone = (phone?: string | null) =>
  phone && phone.length >= 8 ? toFaDigits(`${phone.slice(0, 4)}***${phone.slice(-4)}`) : toFaDigits(phone || "");

export const maskNationalId = (id?: string | null) => (id ? toFaDigits(`******${id.slice(-4)}`) : "ثبت نشده");

// حرف اول نام برای آواتار؛ اگر نام نبود، آیکون کاربر نمایش داده می‌شود
export const initialOf = (name?: string | null) => (name || "").trim().charAt(0) || null;

export const accountPageFor = (role?: string | null) =>
  role === "BUSINESS_OWNER" ? "/dashboard/owner/account" : "/dashboard/account";
