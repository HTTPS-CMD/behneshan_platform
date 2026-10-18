import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const refresh = request.cookies.get("refresh_token")?.value;
  const role = request.cookies.get("user_role")?.value;

  // ۱. اگر کاربر لاگین است و می‌خواهد وارد صفحه لاگین یا ثبت‌نام شود:
  if ((pathname === "/login" || pathname === "/register") && (token || refresh)) {
    if (role === "ADMIN" || role === "admin" || role === "superadmin") {
      return NextResponse.redirect(new URL("/admin-panel", request.url));
    }
    if (role === "BUSINESS_OWNER") {
      return NextResponse.redirect(new URL("/dashboard/owner", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard/client", request.url));
  }

  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin-panel");

  // ۲. اگر لاگین نیست و می‌خواهد وارد صفحات محافظت‌شده شود:
  if (isProtectedRoute && !token && !refresh) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role) {
    if (pathname.startsWith("/admin-panel") && role !== "ADMIN" && role !== "admin" && role !== "superadmin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

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
  } else if (pathname.startsWith("/admin-panel")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// اضافه کردن login و register به لیست مسیرهای تحت نظارت:
export const config = {
  matcher: ["/dashboard/:path*", "/admin-panel/:path*", "/login", "/register"],
};