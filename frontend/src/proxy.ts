import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt } from "@/lib/server/jwt";

// نمایش صفحه‌ی ۴۰۴ بدون تغییر آدرس (rewrite به مسیری که وجود ندارد)؛ وضعیت HTTP هم 404 است
const notFound = (request: NextRequest) =>
  NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // نشست و نقش از refresh توکن (کوکی httpOnly) خوانده می‌شوند و امضای آن بررسی می‌شود (H6).
  // کوکی user_role فقط برای نمایش است و دستکاری آن هیچ دسترسی‌ای نمی‌دهد.
  const session = await verifyJwt(request.cookies.get("refresh_token")?.value, "refresh");
  const loggedIn = !!session;
  const role = session?.role;

  // ۱. اگر کاربر لاگین است و می‌خواهد وارد صفحه لاگین یا ثبت‌نام شود:
  if ((pathname === "/login" || pathname === "/register") && loggedIn) {
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin-panel", request.url));
    }
    if (role === "BUSINESS_OWNER") {
      return NextResponse.redirect(new URL("/dashboard/owner", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard/client", request.url));
  }

  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin-panel");

  // پنل مدیریت برای هر کسی جز ادمین «وجود ندارد» (۴۰۴ به‌جای انتقال)، تا آدرسش لو نرود
  if (pathname.startsWith("/admin-panel") && role !== "ADMIN") {
    return notFound(request);
  }

  // ۲. اگر لاگین نیست و می‌خواهد وارد صفحات محافظت‌شده شود:
  if (isProtectedRoute && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role) {
    if (pathname === "/dashboard") {
      if (role === "ADMIN") return NextResponse.redirect(new URL("/admin-panel", request.url));
      if (role === "BUSINESS_OWNER") return NextResponse.redirect(new URL("/dashboard/owner", request.url));
      return NextResponse.redirect(new URL("/dashboard/client", request.url));
    }

    if (pathname.startsWith("/dashboard/owner") && role !== "BUSINESS_OWNER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/client", request.url));
    }

    if (pathname.startsWith("/dashboard/client") && role === "BUSINESS_OWNER") {
      return NextResponse.redirect(new URL("/dashboard/owner", request.url));
    }
  }

  return NextResponse.next();
}

// اضافه کردن login و register به لیست مسیرهای تحت نظارت:
export const config = {
  matcher: ["/dashboard/:path*", "/admin-panel/:path*", "/login", "/register"],
};