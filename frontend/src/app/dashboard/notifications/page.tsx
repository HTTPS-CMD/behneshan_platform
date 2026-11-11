import NotificationsPanel from "@/components/notifications/NotificationsPanel";

export const metadata = { title: "اعلان‌ها | چهارسوق" };

// صفحه‌ی اعلان‌های مشتری و صاحب کسب‌وکار
export default function DashboardNotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <NotificationsPanel />
    </div>
  );
}
