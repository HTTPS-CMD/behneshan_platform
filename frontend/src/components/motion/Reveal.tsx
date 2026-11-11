"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

/**
 * ابزارهای حرکت مشترک سایت (فقط ظاهر؛ روی داده و منطق صفحه‌ها اثری ندارند).
 * اگر کاربر در سیستم‌عامل «کاهش حرکت» را روشن کرده باشد، MotionProvider حرکت‌ها را خاموش می‌کند.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "article" | "header" | "footer";
};

/** ظاهر شدن نرم هنگام رسیدن به بخش در اسکرول */
export function Reveal({ children, className, delay = 0, y = 24, as = "div" }: Props) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

/** ظاهر شدن پشت‌سرهم آیتم‌های یک لیست یا گرید */
export function Stagger({ children, className, as = "div" }: Omit<Props, "delay" | "y">) {
  const Tag = motion[as];
  // به‌جای whileInView از animate استفاده می‌شود تا آیتم‌هایی که بعداً اضافه می‌شوند
  // (مثلاً وقتی دسته‌بندی‌ها دیرتر از API می‌رسند) هم نمایش داده شوند و نامرئی نمانند.
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={className} variants={container} initial="hidden" animate={inView ? "show" : "hidden"}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }: Omit<Props, "delay" | "y">) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={staggerItem}>
      {children}
    </Tag>
  );
}
