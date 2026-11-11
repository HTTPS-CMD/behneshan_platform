import { create } from "zustand";
import Cookies from "js-cookie";

/**
 * وضعیت ورود کاربر (H6):
 * - access توکن فقط در حافظه است (نه کوکی و نه localStorage).
 * - refresh در کوکی httpOnly است و فقط سرور Next به آن دسترسی دارد (/api/auth/*).
 * - کوکی user_role فقط برای نمایش رابط کاربری است؛ دسترسی واقعی را بک‌اند و proxy با امضای توکن بررسی می‌کنند.
 */
interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  role: string | null;

  /** بعد از تأیید OTP (کوکی‌ها را سرور ست کرده است) */
  login: (access: string, role: string) => void;
  /** بعد از تمدید نشست */
  setSession: (access: string, role: string) => void;
  /** پاک کردن وضعیت محلی بدون تماس با سرور (نشست منقضی شده) */
  clearSession: () => void;
  /** خروج کامل: باطل کردن refresh در سرور و پاک کردن کوکی‌ها */
  logout: () => void;
}

const readRole = () => (typeof document !== "undefined" ? Cookies.get("user_role") || null : null);

// پاک‌سازی توکن‌های قدیمی که قبلاً در کوکی قابل‌خواندن ذخیره می‌شدند
if (typeof document !== "undefined") Cookies.remove("access_token");

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!readRole(),
  accessToken: null,
  role: readRole(),

  login: (access, role) => set({ isAuthenticated: true, accessToken: access, role }),

  setSession: (access, role) => set({ isAuthenticated: true, accessToken: access, role }),

  clearSession: () => {
    Cookies.remove("user_role");
    set({ isAuthenticated: false, accessToken: null, role: null });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
    }
    Cookies.remove("user_role");
    set({ isAuthenticated: false, accessToken: null, role: null });
  },
}));
