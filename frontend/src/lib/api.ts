import axios from 'axios';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/useAuthStore';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
});

// === ۱. اینترسپتور درخواست (Request) ===
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// === ۲. اینترسپتور پاسخ (Response) ===
api.interceptors.response.use(
  (response) => {
    // اگر پاسخ موفق بود، خود پاسخ رو برگردون
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // اگر خطای 401 (عدم دسترسی) گرفتیم و قبلاً این درخواست رو رفرش نکردیم (_retry)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = Cookies.get('refresh_token');

      if (refreshToken) {
        try {
          // درخواست به بک‌اند برای دریافت اکسس توکن جدید
          // با axios خام (نه api) تا اگر رفرش هم 401 داد، اینترسپتور دوباره رفرش نکند و حلقه‌ی بی‌نهایت نسازد
          const res = await axios.post('http://127.0.0.1:8000/api/v1/identity/token/refresh/', {
            refresh: refreshToken,
          });

          const newAccessToken = res.data.access;
          const currentRole = Cookies.get('user_role') || '';

          // ذخیره توکن جدید در کوکی‌ها (برای ۷ روز طبق تنظیمات جنگو)
          Cookies.set('access_token', newAccessToken, { expires: 7 });
          
          // آپدیت کردن استیت در Zustand
          useAuthStore.getState().updateTokensAndRole(newAccessToken, refreshToken, currentRole);

          // تغییر هدر درخواست اصلی با توکن جدید و ارسال مجدد
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
          
        } catch (refreshError) {
          // اگر رفرش توکن هم منقضی شده بود -> خروج کامل کاربر از حساب
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // اگر کلاً رفرش توکنی وجود نداشت -> خروج کامل کاربر
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);