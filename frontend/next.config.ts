import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ریشه‌ی پروژه را صریح مشخص می‌کنیم؛ وگرنه Next به‌خاطر yarn.lock در پوشه‌ی خانه، ریشه را اشتباه تشخیص می‌دهد
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
