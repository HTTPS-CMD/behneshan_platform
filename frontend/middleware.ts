import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ۱. خواندن توکن و نقش از کوکی‌ها
  const token = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("user_role")?.value;

  // مسیرهای محافظت‌شده (مثلاً تمام مسیرهای داخل داشبورد و ادمین)
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin-panel");

  // ۲. اگر کاربر لاگین نکرده و می‌خواهد وارد پنل شود -> هدایت به صفحه ورود
  if (isProtectedRoute && !token) {
    // نکته: '/login' را با آدرس صفحه لاگین خودت جایگزین کن
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ۳. کنترل دسترسی بر اساس نقش (Role-Based Routing)
  if (token && role) {
    // ---- این بخش اضافه شود ----
    // هدایت مسیر اصلی داشبورد به زیرمجموعه مناسب
    if (pathname === "/dashboard") {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin-panel", request.url));
      } else if (role === "BUSINESS_OWNER") {
        return NextResponse.redirect(new URL("/dashboard/owner", request.url));
      } else {
        return NextResponse.redirect(new URL("/dashboard/client", request.url));
      }
    }

    // جلوگیری از ورود مشتری عادی به پنل صاحب کسب‌وکار
    if (
      pathname.startsWith("/dashboard/owner") &&
      role !== "BUSINESS_OWNER" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard/client", request.url));
    }

    // (اختیاری) هدایت صاحب کسب‌وکار به پنل خودش اگر اشتباهاً وارد پنل کلاینت شد
    if (pathname.startsWith("/dashboard/client") && role === "BUSINESS_OWNER") {
      return NextResponse.redirect(new URL("/dashboard/owner", request.url));
    }
  }

  // اگر مشکلی نبود، اجازه عبور بده
  return NextResponse.next();
}

// ۴. مشخص کردن مسیرهایی که این میدلور باید روی آن‌ها اعمال شود
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin-panel/:path*",
    // می‌توانی مسیرهای دیگر را هم با کاما اضافه کنی
  ],
};
