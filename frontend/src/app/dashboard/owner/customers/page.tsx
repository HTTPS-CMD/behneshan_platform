import { redirect } from "next/navigation";

/** «مشتریان من» با «باشگاه مشتریان ← مشتریان» یکی شد */
export default function LegacyCustomersPage() {
  redirect("/dashboard/owner/club/customers");
}
