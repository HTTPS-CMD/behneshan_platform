"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Clock, Loader2, ChevronLeft, CheckCircle2, CalendarDays, Ticket, Wallet, Coins, Users, Trophy } from "lucide-react";

export default function ClientDashboard() {
  const { isAuthenticated, role } = useAuthStore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // استیت‌های قبلی
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [vipStatus, setVipStatus] = useState<any>(null);
  const [myCampaigns, setMyCampaigns] = useState<any[]>([]);
  
  // استیت‌های جدید برای پنل مشتریان
  const [profile, setProfile] = useState<any>(null);
  const [referrals, setReferrals] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (role === "BUSINESS_OWNER") {
        router.replace("/dashboard/owner");
      } else if (role === "ADMIN") {
        router.replace("/admin-panel");
      }
    }
  }, [isMounted, isAuthenticated, role, router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isAuthenticated || role !== "CLIENT") return;
      
      try {
        const token = Cookies.get("access_token");
        const headers = { headers: { Authorization: `Bearer ${token}` } };
        
        // فراخوانی همزمان تمام APIهای داشبورد مشتری
        const [vipRes, visitsRes, campaignsRes, profileRes, referralsRes] = await Promise.all([
          api.get("/directory/client/vip/status/", headers).catch(() => ({ data: { is_vip: false } })),
          api.get("/directory/client/recent-visits/", headers).catch(() => ({ data: [] })),
          api.get("/directory/client/campaigns/", headers).catch(() => ({ data: [] })),
          api.get("/identity/client/dashboard/", headers).catch(() => ({ data: null })),
          api.get("/identity/client/referrals/", headers).catch(() => ({ data: null }))
        ]);

        setVipStatus(vipRes.data);
        setRecentVisits(visitsRes.data);
        setMyCampaigns(campaignsRes.data);
        setProfile(profileRes.data);
        setReferrals(referralsRes.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات داشبورد:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isMounted) fetchDashboardData();
  }, [isMounted, isAuthenticated, role]);

  if (!isMounted || !isAuthenticated || role === "BUSINESS_OWNER" || role === "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">
        در حال انتقال...
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* هدر و خوش‌آمدگویی */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-800">
            خوش آمدید، {profile?.full_name || "کاربر عزیز"}
          </h2>
          <p className="text-gray-500 mt-1 font-medium">نمای کلی حساب کاربری شما در چارسوق.</p>
        </div>
        {profile?.level_display && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">سطح: {profile.level_display}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>
      ) : (
        <>
          {/* کارت‌های آماری جدید (کیف پول و سودها) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400">موجودی کیف پول</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{profile?.wallet_balance?.toLocaleString()} <span className="text-sm font-normal text-gray-500">تومان</span></h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400">سود از خریدهای پیشین</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{profile?.purchase_profit?.toLocaleString()} <span className="text-sm font-normal text-gray-500">تومان</span></h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400">سود از معرفی دوستان</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{referrals?.total_referral_profit?.toLocaleString() || 0} <span className="text-sm font-normal text-gray-500">تومان</span></h3>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* کارت اشتراک VIP */}
            <Card className={`col-span-full lg:col-span-2 border-none shadow-lg relative overflow-hidden ${vipStatus?.is_vip ? "bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900" : "bg-gradient-to-br from-slate-900 to-slate-800 text-white"}`}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Crown className={`w-7 h-7 ${vipStatus?.is_vip ? "text-slate-900" : "text-amber-400"}`} />
                  {vipStatus?.is_vip ? "اشتراک VIP فعال" : "ارتقا به VIP"}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                {vipStatus?.is_vip ? (
                  <div className="space-y-6 mt-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl font-black text-lg flex items-center gap-2">
                        {vipStatus.plan_name}
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        {vipStatus.discount_percentage}% تخفیف ثابت
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm">
                        <CalendarDays className="w-4 h-4" />
                        اعتبار: {new Date(vipStatus.expiry_date).toLocaleDateString('fa-IR')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                      با تهیه اشتراک VIP، از تمامی فروشگاه‌های چارسوق تخفیف ثابت و بی‌قید و شرط بگیرید.
                    </p>
                    <Link href="/dashboard/client/vip" className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-sm transition-all shadow-md hover:shadow-lg">
                      مشاهده پلن‌ها و خرید
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>

            {/* کارت بازدیدهای اخیر */}
            <Card className="shadow-sm border-gray-100 rounded-2xl flex flex-col">
              <CardHeader className="pb-4 border-b border-gray-50">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-800 font-black">
                  <Clock className="w-5 h-5 text-blue-500" />
                  فروشگاه‌های اخیر
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex-1">
                {recentVisits.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-10 font-medium">بازدیدی ثبت نشده است.</div>
                ) : (
                  <ul className="space-y-3">
                    {recentVisits.map((visit: any) => (
                      <li key={visit.id}>
                        <Link href={`/business/${visit.business_slug}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                          <div>
                            <span className="block font-bold text-sm text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{visit.business_name}</span>
                            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{visit.owner_name}</span>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* کارت کمپین‌های من */}
            <Card className="shadow-sm border-gray-100 rounded-2xl flex flex-col lg:col-span-2 mt-6">
              <CardHeader className="pb-4 border-b border-gray-50">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-800 font-black">
                  <Ticket className="w-5 h-5 text-rose-500" />
                  کدهای تخفیف فعال من
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex-1">
                {myCampaigns.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-10 font-medium">کد تخفیف فعالی ندارید.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myCampaigns.map((camp: any) => (
                      <div key={camp.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                          <Link href={`/business/${camp.business_slug}`} className="font-bold text-gray-800 hover:text-emerald-600 transition block mb-1">{camp.business_name}</Link>
                          <span className="text-rose-600 font-black text-sm block">{camp.title}</span>
                        </div>
                        {camp.is_redeemed ? (
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">استفاده شده</span>
                        ) : (
                          <div className="bg-white border-2 border-dashed border-gray-300 px-4 py-2 rounded-lg text-sm font-black tracking-widest text-slate-800" dir="ltr">{camp.code}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* کارت دوستان دعوت شده */}
            <Card className="shadow-sm border-gray-100 rounded-2xl flex flex-col mt-6">
              <CardHeader className="pb-4 border-b border-gray-50">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-800 font-black">
                  <Users className="w-5 h-5 text-purple-500" />
                  دوستان دعوت‌شده ({referrals?.total_invited_count || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex-1 max-h-[300px] overflow-y-auto">
                {referrals?.friends?.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-10 font-medium">هنوز دوستی را دعوت نکرده‌اید.</div>
                ) : (
                  <ul className="space-y-3">
                    {referrals?.friends?.map((friend: any, index: number) => (
                      <li key={index} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div>
                          <span className="block font-bold text-sm text-gray-800">{friend.name}</span>
                          <span className="text-xs text-gray-500 mt-1 block" dir="ltr">{friend.phone}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold bg-white px-2 py-1 rounded-md border border-gray-200">
                          {new Date(friend.joined_at).toLocaleDateString('fa-IR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}