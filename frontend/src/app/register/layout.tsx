import { redirectIfLoggedIn } from "@/lib/guestOnly";

// کاربری که وارد حساب شده، صفحه‌ی ثبت‌نام را نمی‌بیند و به داشبورد خودش می‌رود
export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  await redirectIfLoggedIn();
  return children;
}
