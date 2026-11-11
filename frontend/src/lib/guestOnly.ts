import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardPathFor } from "@/lib/authRedirect";

/**
 * برای صفحه‌هایی که فقط کاربر مهمان باید ببیند (ورود و ثبت‌نام).
 * روی سرور اجرا می‌شود و به proxy وابسته نیست: اگر کوکی ورود وجود داشت، کاربر به داشبوردش هدایت می‌شود.
 */
export async function redirectIfLoggedIn() {
  const store = await cookies();
  if (store.get("access_token")?.value || store.get("refresh_token")?.value) {
    redirect(dashboardPathFor(store.get("user_role")?.value));
  }
}
