"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Eye, MousePointerClick, Star, Building2, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function OwnerDashboardPage() {
  const { isAuthenticated, role, logout } = useAuthStore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const [myBusinesses, setMyBusinesses] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (role === "CLIENT") {
        router.replace("/dashboard/client");
      } else if (role === "ADMIN") {
        router.replace("/admin-panel");
      }
    }
  }, [isMounted, isAuthenticated, role, router]);


  useEffect(() => {
    const fetchDashboardData = async () => {
      if (isAuthenticated && role !== "CLIENT") {
        try {
          const token = Cookies.get("access_token");

          const [bizResponse, analyticsResponse] = await Promise.all([
            api.get("http://127.0.0.1:8000/api/v1/directory/businesses/me/", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            api.get("http://127.0.0.1:8000/api/v1/directory/businesses/analytics/me/", {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => ({ data: [] })),
          ]);

          const data = bizResponse.data.results || bizResponse.data;
          setMyBusinesses(data);

          if (analyticsResponse.data && analyticsResponse.data.length > 0) {
            setChartData(analyticsResponse.data);
          }
        } catch (error) {
          console.error("خطا در دریافت اطلاعات داشبورد", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (isMounted) fetchDashboardData();
  }, [isMounted, isAuthenticated]);

  if (!isMounted || !isAuthenticated || role === "CLIENT") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500 font-medium">
        در حال بررسی دسترسی...
      </div>
    );
  }

  const totalReviews = myBusinesses.reduce((acc, biz) => acc + (biz.review_count || 0), 0);
  const avgRating = myBusinesses.length > 0
    ? (myBusinesses.reduce((acc, biz) => acc + parseFloat(biz.average_rating || 0), 0) / myBusinesses.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6" dir="rtl">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-blue-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">مجموع نظرات دریافت شده</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-800">{totalReviews}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">میانگین امتیازات</CardTitle>
            <Star className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500 flex items-center gap-2">
              {avgRating} <span className="text-xl">⭐</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">کسب‌وکارهای فعال</CardTitle>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{myBusinesses.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              متریک‌های رشد مخاطبان (هفته‌های اخیر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full" dir="ltr">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-gray-500 text-sm">در حال دریافت آمار...</div>
              ) : chartData.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-500 text-sm">دیتای آماری برای نمایش وجود ندارد.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                    <Line type="monotone" dataKey="views" name="بازدیدها" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="engagement" name="تعاملات" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Link href="/dashboard/create" className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                  + ثبت شعبه یا برند جدید
                </Button>
              </Link>
              <Link href="/dashboard/owner/reviews" className="block">
                <Button variant="outline" className="w-full font-bold h-12 text-gray-700">
                  مدیریت پیام‌ها و نظرات
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">برندهای شما</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-gray-500 py-4 text-sm">در حال بارگذاری...</div>
              ) : myBusinesses.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">برندی ثبت نشده است.</div>
              ) : (
                <div className="space-y-3">
                  {myBusinesses.map((biz) => (
                    <div key={biz.id} className="p-3 border rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-blue-200 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-sm text-gray-800">{biz.name}</h4>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${biz.is_verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {biz.is_verified ? "تایید شده" : "در حال بررسی"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/business/${biz.slug}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-xs h-8">مشاهده</Button>
                        </Link>
                        <Link href={`/dashboard/owner/edit/${biz.slug}`} className="flex-1">
                          <Button variant="secondary" size="sm" className="w-full text-xs h-8 bg-blue-50 text-blue-700 hover:bg-blue-100">ویرایش</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}