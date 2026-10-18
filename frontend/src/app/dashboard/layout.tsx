import DashboardLayout from "@/components/layout/DashboardLayout"; // مسیر فایلی که در پیام قبل ساختیم

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}