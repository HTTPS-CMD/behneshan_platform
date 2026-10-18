import { create } from "zustand";
import Cookies from "js-cookie";

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  role: string | null; // <--- فیلد نقش اضافه شد

  // متد لاگین حالا نقش را هم می‌گیرد
  login: (access: string, refresh: string, role: string) => void;

  // متد جدید برای زمان ارتقای کاربر (مثلاً بعد از ثبت کسب‌وکار)
  updateTokensAndRole: (access: string, refresh: string, role: string) => void;

  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // هنگام لود سایت، چک می‌کنیم آیا توکنی از قبل در مرورگر هست یا نه
  isAuthenticated: !!Cookies.get("access_token"),
  accessToken: Cookies.get("access_token") || null,
  role: Cookies.get("user_role") || null, // <--- خواندن نقش از کوکی

  login: (access, refresh, role) => {
    // اعتبار توکن اصلی در بک‌اند ۶۰ دقیقه و رفرش ۷ روز است؛ رفرش خودکار در api.ts انجام می‌شود
    const opts = { expires: 7, sameSite: "lax" as const, secure: window.location.protocol === "https:" };
    Cookies.set("access_token", access, opts);
    Cookies.set("refresh_token", refresh, opts);
    Cookies.set("user_role", role, opts);

    set({ isAuthenticated: true, accessToken: access, role });
  },

  updateTokensAndRole: (access, refresh, role) => {
    // جایگزین کردن توکن‌ها و نقش جدید در کوکی‌ها
    const opts = { expires: 7, sameSite: "lax" as const, secure: window.location.protocol === "https:" };
    Cookies.set("access_token", access, opts);
    Cookies.set("refresh_token", refresh, opts);
    Cookies.set("user_role", role, opts);

    set({ accessToken: access, role });
  },

  logout: () => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    Cookies.remove("user_role"); // <--- پاک کردن نقش
    set({ isAuthenticated: false, accessToken: null, role: null });
  },
}));
