"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageViewTracker() {
    const pathname = usePathname();

    useEffect(() => {
        // نمی‌خواهیم بازدید از صفحات پنل ادمین ثبت شود
        if (pathname.startsWith("/admin-panel")) return;

        const recordView = async () => {
            try {
                // آدرس بک‌اند خود را در صورت نیاز اصلاح کنید (مثلا متغیر محیطی)
                await fetch("http://127.0.0.1:8000/api/v1/analytics/record-view/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ url: pathname }),
                });
            } catch (error) {
                // چون این یک سیستم در پس‌زمینه است، در صورت خطا مزاحم کاربر نمی‌شویم
                console.error("خطا در ثبت بازدید:", error);
            }
        };

        recordView();
    }, [pathname]);

    return null; // این کامپوننت هیچ خروجی بصری ندارد و کاملاً مخفی است
}