import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { refreshSession } from '@/lib/auth';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
});

// === ۱. درخواست: افزودن access توکن (از حافظه) ===
api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config; // رندر سمت سرور: درخواست عمومی

  const state = useAuthStore.getState();
  let token = state.accessToken;
  // بعد از رفرش صفحه، access در حافظه نیست؛ اگر کاربر لاگین است اول نشست تمدید می‌شود
  if (!token && state.isAuthenticated) {
    token = await refreshSession();
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// === ۲. پاسخ: تمدید خودکار نشست در صورت 401 ===
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (typeof window !== 'undefined' && originalRequest && error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (useAuthStore.getState().isAuthenticated) {
        const newAccessToken = await refreshSession();
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      }

      // نشست معتبری وجود ندارد -> خروج و انتقال به صفحه‌ی ورود
      // کوکی httpOnly‌ی refresh هم باید پاک شود؛ وگرنه proxy کاربر را «لاگین‌شده» می‌داند و از /login
      // دوباره به داشبورد برمی‌گرداند (حلقه‌ی بی‌نهایت)
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch {
        /* حتی اگر ناموفق بود، ادامه بده */
      }
      useAuthStore.getState().clearSession();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
