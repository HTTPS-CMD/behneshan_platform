/**
 * کوکی‌های نشست (H6):
 *  - refresh_token: httpOnly — جاوااسکریپت صفحه (و هر XSS یا پکیج آلوده) به آن دسترسی ندارد
 *  - user_role: فقط برای نمایش رابط کاربری (قابل اعتماد نیست؛ proxy نقش را از امضای توکن می‌خواند)
 * access توکن هیچ‌وقت در کوکی ذخیره نمی‌شود و فقط در حافظه‌ی مرورگر است.
 */
import type { NextRequest, NextResponse } from "next/server";

export const REFRESH_COOKIE = "refresh_token";
export const ROLE_COOKIE = "user_role";
const LEGACY_ACCESS_COOKIE = "access_token";
const MAX_AGE = 7 * 24 * 60 * 60; // برابر REFRESH_TOKEN_LIFETIME جنگو

export const BACKEND_API =
  process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const isHttps = (req: NextRequest) =>
  req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";

export function setSessionCookies(req: NextRequest, res: NextResponse, refresh: string, role: string) {
  const base = { path: "/", sameSite: "lax" as const, secure: isHttps(req), maxAge: MAX_AGE };
  res.cookies.set(REFRESH_COOKIE, refresh, { ...base, httpOnly: true });
  res.cookies.set(ROLE_COOKIE, role || "CLIENT", { ...base, httpOnly: false });
  res.cookies.set(LEGACY_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of [REFRESH_COOKIE, ROLE_COOKIE, LEGACY_ACCESS_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

/** فقط درخواست‌های هم‌مبدأ (جلوگیری از CSRF روی مسیرهای نشست) */
export function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // مرورگرها برای POST هم‌مبدأ گاهی Origin نمی‌فرستند؛ کوکی SameSite=Lax هم محافظ است
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** هدرهایی که به جنگو فرستاده می‌شوند تا IP و مرورگر واقعی کاربر (برای محدودیت نرخ و لاگ ورود) حفظ شود */
export function forwardHeaders(req: NextRequest): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const xff = req.headers.get("x-forwarded-for");
  if (xff) h["X-Forwarded-For"] = xff;
  const ua = req.headers.get("user-agent");
  if (ua) h["User-Agent"] = ua;
  return h;
}
