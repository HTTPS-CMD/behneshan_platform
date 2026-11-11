"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Gift, Handshake, Lightbulb, MessageSquareText, Receipt, Settings2, Users, Wallet } from "lucide-react";

const TABS = [
  { href: "/dashboard/owner/club/transactions", label: "تراکنش‌ها", icon: Receipt },
  { href: "/dashboard/owner/club/customers", label: "مشتریان", icon: Users },
  { href: "/dashboard/owner/club/incentives", label: "طرح‌های تشویقی", icon: Gift },
  { href: "/dashboard/owner/club/sms", label: "پیامک", icon: MessageSquareText },
  { href: "/dashboard/owner/club/share", label: "اشتراک‌گذاری", icon: Handshake },
  { href: "/dashboard/owner/club/insights", label: "دیتای هوشمند", icon: Lightbulb },
  { href: "/dashboard/owner/club/wallet", label: "کیف‌پول", icon: Wallet },
  { href: "/dashboard/owner/club/settings", label: "شعب و تنظیمات", icon: Settings2 },
];

/** عنوان و تب‌های بخش «باشگاه مشتریان» */
export default function ClubHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold text-saffron-700">باشگاه مشتریان</p>
          <h1 className="mt-1 text-2xl font-black text-brand-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm" aria-label="بخش‌های باشگاه">
        {TABS.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}
              className={`relative flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors ${active ? "text-white" : "text-gray-500 hover:text-brand-700"}`}>
              {active && <motion.span layoutId="club-tab" className="absolute inset-0 rounded-xl bg-brand-700" transition={{ type: "spring", damping: 30, stiffness: 380 }} />}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
