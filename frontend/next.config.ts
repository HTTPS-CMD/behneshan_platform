import path from "path";
import type { NextConfig } from "next";

// آدرس سرور فایل‌ها (بنر، لوگو، استوری) برای بهینه‌سازی تصاویر با next/image
const mediaUrl = new URL(process.env.NEXT_PUBLIC_MEDIA_URL || "http://127.0.0.1:8000");
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // جلوگیری از نمایش سایت داخل iframe سایت‌های دیگر (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS فقط روی سرور اصلی (HTTPS) معنا دارد
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // ریشه‌ی پروژه را صریح مشخص می‌کنیم؛ وگرنه Next به‌خاطر yarn.lock در پوشه‌ی خانه، ریشه را اشتباه تشخیص می‌دهد
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: mediaUrl.protocol.replace(":", "") as "http" | "https",
        hostname: mediaUrl.hostname,
        port: mediaUrl.port,
        pathname: "/media/**",
      },
    ],
    // روی لوکال‌هاست بک‌اند روی 127.0.0.1 است؛ Next به‌طور پیش‌فرض بهینه‌سازی تصویر از IP محلی را می‌بندد
    dangerouslyAllowLocalIP: isDev,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
