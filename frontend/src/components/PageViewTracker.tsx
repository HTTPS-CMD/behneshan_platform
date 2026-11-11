"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import axios from "axios";
import { api } from "@/lib/api";

export default function PageViewTracker() {
    const pathname = usePathname();

    useEffect(() => {
        // نمی‌خواهیم بازدید از صفحات پنل ادمین ثبت شود
        if (pathname.startsWith("/admin-panel")) return;

        const recordView = async () => {
            try {
                // axios خام (بدون توکن و interceptor) تا خطای 401 کاربر را به صفحه‌ی ورود نفرستد
                await axios.post(`${api.defaults.baseURL}/analytics/record-view/`, { url: pathname });
            } catch (error) {
                // چون این یک سیستم در پس‌زمینه است، در صورت خطا مزاحم کاربر نمی‌شویم
                console.error("خطا در ثبت بازدید:", error);
            }
        };

        recordView();
    }, [pathname]);

    return null; // این کامپوننت هیچ خروجی بصری ندارد و کاملاً مخفی است
}