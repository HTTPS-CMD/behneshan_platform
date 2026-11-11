"use client";

import { useState } from "react";
import { Bell, Megaphone } from "lucide-react";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import BroadcastPanel from "@/components/notifications/BroadcastPanel";

// صفحه‌ی اعلان‌های ادمین: اعلان‌های خودش + ارسال اعلان همگانی
export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<"inbox" | "broadcast">("inbox");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm" role="tablist">
        {[
          { id: "inbox", label: "اعلان‌های من", icon: Bell },
          { id: "broadcast", label: "ارسال اعلان همگانی", icon: Megaphone },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id as "inbox" | "broadcast")}
            className={`flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${tab === id ? "bg-brand-900 text-white" : "text-gray-500 hover:text-gray-800"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {tab === "inbox" ? (
        <div className="max-w-3xl"><NotificationsPanel /></div>
      ) : (
        <BroadcastPanel />
      )}
    </div>
  );
}
