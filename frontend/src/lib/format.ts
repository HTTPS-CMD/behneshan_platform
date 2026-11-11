// تبدیل‌های مشترک نمایش اعداد و آدرس فایل‌ها

export const toFaDigits = (value: string | number) =>
  String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

// ۱۲۳۴۵۶۷ → ۱٬۲۳۴٬۵۶۷
export const faNumber = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("fa-IR") : toFaDigits(String(value ?? ""));
};

const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL || "").replace(/\/$/, "");

// آدرس کامل فایل آپلودی (بنر، لوگو، استوری). اگر آدرس از قبل کامل باشد دست نمی‌خورد
export const mediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};
