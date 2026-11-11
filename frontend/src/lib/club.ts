/** ابزارهای مشترک «باشگاه مشتریان» */

const FA = "۰۱۲۳۴۵۶۷۸۹";

export const toFaDigits = (v: string | number) => String(v).replace(/\d/g, (d) => FA[Number(d)]);
export const toEnDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** ۱۲۵۰۰۰ -> «۱۲۵٬۰۰۰» */
export const fmtMoney = (v: number | string | null | undefined) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString("fa-IR") : "۰";
};

/** فقط رقم (برای ورودی مبلغ با جداکننده) */
export const parseAmount = (v: string) => Number(toEnDigits(v).replace(/[^\d]/g, "") || 0);

export const PAYMENT_METHODS = [
  { value: "CASH", label: "نقدی" },
  { value: "POS", label: "کارت‌خوان" },
  { value: "CARD", label: "کارت به کارت" },
  { value: "ONLINE", label: "آنلاین" },
  { value: "OTHER", label: "سایر" },
] as const;

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const LABEL_COLORS: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  saffron: "bg-saffron-50 text-saffron-700 border-saffron-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  slate: "bg-gray-100 text-gray-700 border-gray-200",
};

/** «1403/05/12» معتبر است؟ */
export const isJalaliDate = (v: string) => /^1[34]\d{2}\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/.test(toEnDigits(v.trim()));

/** امروز به شمسی «1405/07/29» */
export const todayJalali = () => {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year").replace(/\D/g, "")}/${get("month")}/${get("day")}`;
};

/** پیام خطای API */
export const apiError = (e: any, fallback = "خطایی رخ داد.") => {
  const d = e?.response?.data;
  if (!d) return fallback;
  if (typeof d === "string") return fallback;
  if (d.error) return d.error;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  if (Array.isArray(first) && first.length) return String(first[0]);
  return fallback;
};

/** ذخیره‌ی فایل دریافتی از API */
export const saveBlob = (data: BlobPart, filename: string) => {
  const url = URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const INCENTIVE_KINDS = [
  { value: "FIRST_PURCHASE", label: "اولین خرید", hint: "روی اولین خرید هر مشتری خودکار اعمال می‌شود." },
  { value: "WINBACK", label: "فراموشی (بازگشت مشتری)", hint: "به مشتری‌ای که مدتی خرید نکرده هدیه‌ی بازگشت داده می‌شود." },
  { value: "BIRTHDAY", label: "تولد", hint: "روز تولد مشتری (یا چند روز قبل) هدیه داده می‌شود." },
  { value: "ANNIVERSARY", label: "سالگرد ازدواج", hint: "برای مشتریان متأهلی که تاریخ سالگرد ثبت کرده‌اند." },
] as const;

export const REWARD_TYPES = [
  { value: "PERCENT", label: "تخفیف درصدی" },
  { value: "AMOUNT", label: "تخفیف مبلغ ثابت" },
  { value: "CREDIT", label: "اعتبار کیف‌پول" },
  { value: "GIFT", label: "هدیه‌ی کالایی" },
] as const;
