"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import { TrendingUp, Users, Eye, ArrowUpRight, BarChart3 } from "lucide-react";

export default function OwnerAnalyticsPage() {
  const [stats, setStats] = useState({
    total_views: 0,
    total_engagements: 0,
    average_rating: 0,
    campaign_uses: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = Cookies.get("access_token");
        const res = await api.get("/directory/owner/analytics/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات آماری", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        در حال بارگذاری گزارشات آماری...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-900">آمار و گزارشات بازدید</h1>
            <p className="text-sm text-gray-500 mt-1">تحلیل روند رشد مخاطبان و استفاده از تخفیف‌های شعبه.</p>
          </div>
          <Link href="/dashboard/owner" className="text-blue-600 hover:underline text-sm font-bold">
            بازگشت به داشبورد
          </Link>
        </header>

        {/* کارت‌های آماری کلیدی */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">مجموع بازدیدها</p>
              <h3 className="text-2xl font-black text-gray-900 mt-2">{stats.total_views}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">تعاملات ثبت شده</p>
              <h3 className="text-2xl font-black text-gray-900 mt-2">{stats.total_engagements}</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">استفاده از تخفیف‌ها</p>
              <h3 className="text-2xl font-black text-gray-900 mt-2">{stats.campaign_uses}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400">میانگین امتیازات</p>
              <h3 className="text-2xl font-black text-gray-900 mt-2">{stats.average_rating} ⭐</h3>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* بخش نمودار تحلیلی نمایشی */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-4">روند رشد بازدید و تعاملات در ماه گذشته</h3>
          <div className="h-72 w-full bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
            <BarChart3 className="w-12 h-12 mb-2 text-gray-300" />
            <p className="text-sm font-medium">نمودار تعاملی تحلیل داده‌ها بر اساس بازه زمانی انتخابی</p>
          </div>
        </div>

      </div>
    </div>
  );
}