"use client";

import { MotionConfig } from "framer-motion";

/** تنظیم سراسری حرکت: احترام به «کاهش حرکت» سیستم‌عامل + فنر نرم پیش‌فرض */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 260, damping: 30 }}>
      {children}
    </MotionConfig>
  );
}
