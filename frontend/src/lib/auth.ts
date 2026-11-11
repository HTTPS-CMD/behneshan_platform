import axios from "axios";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * تمدید نشست از مسیر امن /api/auth/refresh (refresh در کوکی httpOnly است و به جاوااسکریپت نمی‌رسد).
 * چند درخواست هم‌زمان فقط یک بار رفرش می‌کنند.
 */
let inflight: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  if (!inflight) {
    inflight = axios
      .post("/api/auth/refresh", {}, { withCredentials: true })
      .then((res) => {
        useAuthStore.getState().setSession(res.data.access, res.data.role);
        return res.data.access as string;
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** ورود/ثبت‌نام با کد OTP از مسیر امن Next (پاسخ همان پاسخ جنگو است، بدون refresh) */
export async function verifyOtp(payload: Record<string, unknown>) {
  const res = await axios.post("/api/auth/verify-otp", payload, { withCredentials: true });
  useAuthStore.getState().login(res.data.access, res.data.role);
  return res;
}
