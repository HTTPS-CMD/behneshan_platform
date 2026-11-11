import { redirect } from "next/navigation";

/** «پذیرش مشتری» با «باشگاه مشتریان ← تراکنش‌ها» یکی شد */
export default function LegacyCrmPage() {
  redirect("/dashboard/owner/club/transactions");
}
