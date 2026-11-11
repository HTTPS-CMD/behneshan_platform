import { redirectIfLoggedIn } from "@/lib/guestOnly";

// کاربری که وارد حساب شده، صفحه‌ی ورود را نمی‌بیند و به داشبورد خودش می‌رود
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  await redirectIfLoggedIn();
  return children;
}
