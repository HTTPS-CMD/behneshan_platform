"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/store/useAuthStore";
import { verifyOtp } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ShieldCheck, ArrowRight, Loader2, Home } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import AuthSidePanel from "@/components/auth/AuthSidePanel";
import OtpTimer from "@/components/auth/OtpTimer";
import { dashboardPathFor } from "@/lib/authRedirect";
import Logo from "@/components/brand/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { register, handleSubmit } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (isAuthenticated) router.replace(dashboardPathFor(role));
  }, [isAuthenticated, role, router]);

  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [step, timeLeft]);

  const onRequestOTP = async (data: any) => {
    setIsLoading(true);
    try {
      await api.post("/identity/request-otp/", {
        action: "login",
        phone_number: data.phone_number,
      });
      setPhoneNumber(data.phone_number);
      setStep(2);
      setTimeLeft(120);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.info("شما هنوز ثبت‌نام نکرده‌اید. در حال انتقال به صفحه ثبت‌نام...");
        router.push("/register");
      } else {
        toast.error(error.response?.data?.error || "خطا در ارتباط با سرور.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyOTP = async (data: any) => {
    setIsLoading(true);
    try {
      // تأیید از مسیر امن Next: refresh توکن مستقیم در کوکی httpOnly ذخیره می‌شود (H6)
      const response = await verifyOtp({
        phone_number: phoneNumber,
        otp_code: data.otp_code,
      });
      if (response.status === 200) {
        const { role } = response.data;
        window.location.href = role === "ADMIN" ? "/admin-panel" : role === "BUSINESS_OWNER" ? "/dashboard/owner" : "/dashboard/client";
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "کد وارد شده اشتباه است.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full font-sans bg-gray-50/50" dir="rtl">
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 bg-white relative overflow-hidden">
        
        {/* دکمه بازگشت به خانه */}
        <Link href="/" className="absolute top-6 right-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors z-20 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
          <Home className="w-4 h-4" />
          بازگشت به خانه
        </Link>

        <div className="w-full max-w-[420px] relative z-10 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center mb-8">
            <div className="mb-5 flex justify-center"><Logo variant="mark" size={72} /></div>
            <h2 className="text-3xl font-black text-brand-900 tracking-tight">ورود به حساب کاربری</h2>
            <p className="text-sm text-gray-500 mt-2 font-medium">لطفاً شماره موبایل خود را وارد کنید.</p>
          </div>

          <div className="relative min-h-[300px]">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit(onRequestOTP)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 ml-1">شماره موبایل</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 group-focus-within:text-brand-500"><Phone className="w-4 h-4" /></div>
                      <Input {...register("phone_number")} required maxLength={11} placeholder="0912..." dir="ltr" className="h-12 pr-10 text-left bg-gray-50/50 rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "دریافت کد تایید"}
                  </Button>
                  <p className="text-center text-sm font-bold text-gray-500 mt-6">
                    حساب کاربری ندارید؟ <Link href="/register" className="text-brand-600 hover:underline">ثبت‌نام کنید</Link>
                  </p>
                </motion.form>
              ) : (
                <motion.form key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit(onVerifyOTP)} className="space-y-5">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-sm font-bold text-gray-700" dir="ltr">{phoneNumber}</div>
                    <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-brand-600">ویرایش شماره</button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-sm font-bold text-gray-700">کد تایید</label>
                      <OtpTimer seconds={timeLeft} />
                    </div>
                    <Input {...register("otp_code")} className="h-14 text-center tracking-[1em] text-xl font-black rounded-xl" dir="ltr" required maxLength={6} />
                  </div>
                  <Button type="submit" disabled={isLoading || timeLeft === 0} className="w-full h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ورود به سیستم"}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AuthSidePanel />
    </div>
  );
}