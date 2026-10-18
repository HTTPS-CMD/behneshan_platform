"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, User, ShieldCheck, ArrowRight, Loader2, TimerReset, IdCard, Store, Home, AlertOctagon, Lightbulb, X } from "lucide-react";

// تعریف ساختار دیتای ارور
interface ErrorState {
    title: string;
    cause: string;
    solution: string;
}

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [role, setRole] = useState<"CLIENT" | "BUSINESS_OWNER">("CLIENT");
    const [phoneNumber, setPhoneNumber] = useState("");
    const { register, handleSubmit } = useForm();
    const [isLoading, setIsLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(120);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // استیت مربوط به مدیریت خطاهای اختصاصی
    const [customError, setCustomError] = useState<ErrorState | null>(null);

    // استیت‌های مربوط به کد معرف
    const [referralCode, setReferralCode] = useState("");
    const [referralData, setReferralData] = useState<{ message: string; business_name: string } | null>(null);
    const [referralError, setReferralError] = useState("");
    const [isValidating, setIsValidating] = useState(false);


    useEffect(() => {
        if (step === 2 && timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [step, timeLeft]);


    const validateReferralCode = async () => {
        if (!referralCode.trim()) {
            setReferralError("لطفاً کد معرف را وارد کنید.");
            return;
        }

        setIsValidating(true);
        setReferralError("");
        setReferralData(null);

        try {
            // دقت کن که آدرس API با چیزی که در urls.py ساختی یکی باشد
            const res = await api.get(`/directory/campaigns/validate/?code=${referralCode}`);

            // در صورت موفقیت، اطلاعات کسب‌وکار و پیام در استیت ذخیره می‌شود
            setReferralData({
                message: res.data.message,
                business_name: res.data.business_name
            });
        } catch (error: any) {
            // در صورت خطا (مثلا پر شدن ظرفیت یا اشتباه بودن کد) پیام ارور نمایش داده می‌شود
            setReferralError(error.response?.data?.error || "کد وارد شده نامعتبر است.");
        } finally {
            setIsValidating(false);
        }
    };

    // تابع هوشمند برای تبدیل خطاهای بک‌اند به ۳ بخش (مشکل، دلیل، راهکار)
    const handleApiError = (error: any) => {
        const backendMsg = error.response?.data?.error || "";

        if (backendMsg.includes("تطابق ندارد")) {
            return {
                title: "عدم تطابق اطلاعات هویتی (سامانه شاهکار)",
                cause: "کد ملی وارد شده متعلق به مالک این شماره موبایل نیست.",
                solution: "لطفاً شماره موبایلی را وارد کنید که سیم‌کارت آن دقیقاً به نام خودتان (صاحب کد ملی) ثبت شده باشد.",
            };
        }
        if (backendMsg.includes("ثبت‌نام کرده‌اید")) {
            return {
                title: "حساب کاربری از قبل وجود دارد",
                cause: "این شماره موبایل قبلاً در پلتفرم چهارسوق ثبت شده است.",
                solution: "نیازی به ثبت‌نام مجدد نیست. در حال انتقال به صفحه ورود...",
            };
        }
        if (backendMsg.includes("کد ملی قبلاً")) {
            return {
                title: "کد ملی تکراری است",
                cause: "یک حساب کاربری دیگر با این کد ملی در سیستم وجود دارد.",
                solution: "اگر قبلاً ثبت‌نام کرده‌اید، مستقیماً از صفحه ورود اقدام کنید.",
            };
        }
        if (backendMsg.includes("نامعتبر است")) {
            return {
                title: "کد تایید اشتباه است",
                cause: "کدی که وارد کردید با کد پیامک شده مطابقت ندارد یا زمان آن منقضی شده است.",
                solution: "لطفاً کد را با دقت بررسی کنید یا درخواست ارسال مجدد کد بدهید.",
            };
        }

        return {
            title: "خطای ارتباط با سرور",
            cause: "در حال حاضر امکان پردازش درخواست شما وجود ندارد.",
            solution: "لطفاً اتصال اینترنت خود را بررسی کرده و چند دقیقه دیگر مجدداً تلاش کنید.",
        };
    };

    const onRequestOTP = async (data: any) => {
        if (!acceptedTerms) {
            setCustomError({
                title: "تایید قوانین الزامی است",
                cause: "شما هنوز قوانین و مقررات پلتفرم را نپذیرفته‌اید.",
                solution: "لطفاً تیک پذیرش قوانین را در پایین فرم علامت بزنید."
            });
            return; // توقف اجرا
        }
        setIsLoading(true);
        setCustomError(null); // پاک کردن ارورهای قبلی

        try {
            await api.post("http://127.0.0.1:8000/api/v1/identity/request-otp/", {
                action: "register",
                phone_number: data.phone_number,
                national_id: data.national_id,
                full_name: data.full_name,
                role: role,
                business_name: data.business_name,
            });
            setPhoneNumber(data.phone_number);
            setStep(2);
            setTimeLeft(120);
        } catch (error: any) {
            const parsedError = handleApiError(error);
            setCustomError(parsedError);

            // اگر کاربر تکراری بود، بعد از ۳ ثانیه او را به لاگین بفرست
            if (error.response?.status === 409 && error.response.data.error.includes("ثبت‌نام کرده‌اید")) {
                setTimeout(() => router.push("/login"), 3500);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const onVerifyOTP = async (data: any) => {
        setIsLoading(true);
        setCustomError(null);

        try {
            const payload = {
                phone_number: phoneNumber,
                otp_code: data.otp_code,
                // اضافه کردن کد معرف در صورتی که با موفقیت بررسی شده باشد
                ...(referralData && { referral_code: referralCode }),
            };

            const response = await api.post("http://127.0.0.1:8000/api/v1/identity/verify-otp/", payload);

            if (response.status === 200) {
                const { access, refresh, role: userRole } = response.data;
                useAuthStore.getState().login(access, refresh, userRole);
                window.location.href = userRole === "ADMIN" ? "/admin-panel" : userRole === "BUSINESS_OWNER" ? "/dashboard/owner" : "/dashboard/client";
            }
        } catch (error) {
            setCustomError(handleApiError(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex w-full font-sans bg-gray-50/50" dir="rtl">
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 bg-white relative overflow-hidden overflow-y-auto">

                <Link href="/" className="absolute top-6 right-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors z-20 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                    <Home className="w-4 h-4" />
                    بازگشت به خانه
                </Link>

                <div className="w-full max-w-[420px] relative z-10 py-10">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">ایجاد حساب کاربری</h2>
                        <p className="text-sm text-gray-500 mt-2 font-medium">اطلاعات هویتی خود را جهت اعتبارسنجی وارد کنید.</p>
                    </div>

                    {/* کامپوننت نمایش ارور اختصاصی با انیمیشن */}
                    <AnimatePresence>
                        {customError && (
                            <motion.div
                                initial={{ opacity: 0, y: -15, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -15, height: 0 }}
                                className="mb-6 overflow-hidden"
                            >
                                <div className="bg-rose-50 border-r-4 border-rose-500 p-4 rounded-xl shadow-sm relative">
                                    <button
                                        onClick={() => setCustomError(null)}
                                        className="absolute top-3 left-3 text-rose-400 hover:text-rose-600 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex gap-3">
                                        <AlertOctagon className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            {/* ۱. عنوان مشکل */}
                                            <h4 className="text-rose-800 font-bold text-sm mb-1">{customError.title}</h4>
                                            {/* ۲. دلیل بروز خطا */}
                                            <p className="text-rose-600 text-xs font-medium mb-3 leading-relaxed">{customError.cause}</p>
                                            {/* ۳. راهکار عملی */}
                                            <div className="bg-rose-100/60 p-2.5 rounded-lg border border-rose-200/50">
                                                <p className="text-rose-700 text-xs font-bold flex items-start gap-1.5 leading-relaxed">
                                                    <Lightbulb className="w-4 h-4 shrink-0 text-amber-500" />
                                                    <span className="pt-0.5">{customError.solution}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.form key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit(onRequestOTP)} className="space-y-4">

                                    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                                        <button type="button" onClick={() => { setRole("CLIENT"); setCustomError(null); }} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === "CLIENT" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"}`}>مشتری هستم</button>
                                        <button type="button" onClick={() => { setRole("BUSINESS_OWNER"); setCustomError(null); }} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === "BUSINESS_OWNER" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"}`}>صاحب کسب‌وکارم</button>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-700 ml-1">نام و نام خانوادگی</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400"><User className="w-4 h-4" /></div>
                                            <Input {...register("full_name")} required placeholder="علی محمدی" className="h-12 pr-10 bg-gray-50/50 rounded-xl" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-700 ml-1">کد ملی</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400"><IdCard className="w-4 h-4" /></div>
                                                <Input {...register("national_id")} required maxLength={10} placeholder="0012345678" dir="ltr" className="h-12 pr-10 text-left bg-gray-50/50 rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-700 ml-1">شماره موبایل</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400"><Phone className="w-4 h-4" /></div>
                                                <Input {...register("phone_number")} required maxLength={11} placeholder="0912..." dir="ltr" className="h-12 pr-10 text-left bg-gray-50/50 rounded-xl" />
                                            </div>
                                        </div>
                                    </div>

                                    {role === "BUSINESS_OWNER" && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 pt-2">
                                            <label className="text-xs font-bold text-gray-700 ml-1">نام کسب‌وکار شما</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400"><Store className="w-4 h-4" /></div>
                                                <Input {...register("business_name")} required placeholder="فروشگاه چهارسوق" className="h-12 pr-10 bg-gray-50/50 rounded-xl" />
                                            </div>
                                        </motion.div>
                                    )}
                                    {/* فیلد کد معرف (فقط برای مشتریان) */}
                                    {role === "CLIENT" && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 pt-2">
                                            <label className="text-xs font-bold text-gray-700 ml-1">کد معرف یا تخفیف (اختیاری)</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={referralCode}
                                                    onChange={(e) => {
                                                        setReferralCode(e.target.value);
                                                        if (referralData || referralError) {
                                                            setReferralData(null);
                                                            setReferralError("");
                                                        }
                                                    }}
                                                    placeholder="مثلاً: ZHAMAN-1405"
                                                    className="h-12 bg-gray-50/50 rounded-xl flex-1 text-left"
                                                    dir="ltr"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={validateReferralCode}
                                                    disabled={isValidating || !referralCode.trim()}
                                                    className="h-12 bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
                                                >
                                                    {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "بررسی کد"}
                                                </Button>
                                            </div>

                                            {/* پیام‌های وضعیت کد معرف */}
                                            {referralData && (
                                                <p className="text-emerald-600 text-xs font-bold mt-1.5">
                                                    ✔️ {referralData.message}
                                                </p>
                                            )}
                                            {referralError && (
                                                <p className="text-rose-500 text-xs font-bold mt-1.5">
                                                    ❌ {referralError}
                                                </p>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* --- چک‌باکس قوانین و مقررات --- */}
                                    <div className="flex items-center gap-2 mt-4 mb-2">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={acceptedTerms}
                                            onChange={(e) => {
                                                setAcceptedTerms(e.target.checked);
                                                if (e.target.checked) setCustomError(null); // وقتی تیک زد ارور پاک بشه
                                            }}
                                            className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <label htmlFor="terms" className="text-sm font-bold text-gray-600 cursor-pointer">
                                            من <a href={role === "CLIENT" ? "/terms/client" : "/terms/business"} target="_blank" className="text-emerald-600 hover:underline">قوانین و مقررات سایت</a> را مطالعه کرده و می‌پذیرم.
                                        </label>
                                    </div>
                                    {/* ----------------------------- */}

                                    <div className="pt-4">
                                        <Button type="submit" disabled={isLoading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg transition-all">
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "اعتبارسنجی و ارسال کد"}
                                        </Button>
                                    </div>

                                    <p className="text-center text-sm font-bold text-gray-500 mt-6">
                                        قبلاً ثبت‌نام کرده‌اید؟ <Link href="/login" className="text-emerald-600 hover:underline">وارد شوید</Link>
                                    </p>
                                </motion.form>
                            ) : (
                                <motion.form key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit(onVerifyOTP)} className="space-y-5 mt-10">
                                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="text-sm font-bold text-gray-700" dir="ltr">{phoneNumber}</div>
                                        <button type="button" onClick={() => { setStep(1); setCustomError(null); }} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">ویرایش شماره</button>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-sm font-bold text-gray-700">کد تایید ۶ رقمی</label>
                                            <span className="text-xs font-bold flex items-center gap-1 text-gray-500"><TimerReset className="w-3.5 h-3.5" />{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
                                        </div>
                                        <Input {...register("otp_code")} className="h-14 pr-12 pl-4 text-center tracking-[1em] bg-gray-50/50 rounded-xl text-xl font-black shadow-sm" dir="ltr" required maxLength={6} />
                                    </div>

                                    <Button type="submit" disabled={isLoading || timeLeft === 0} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg">
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ورود به سیستم"}
                                    </Button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            <div className="hidden lg:flex w-1/2 bg-slate-900 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2000')] bg-cover bg-center" />
        </div>
    );
}