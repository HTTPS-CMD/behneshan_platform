"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Review {
  id: number;
  user_phone: string;
  rating: number;
  comment: string;
  created_at: string;
  owner_reply?: string | null;
  reply_date?: string | null;
}

interface Business {
  id: string;
  name: string;
  slug: string;
}

export default function ManageReviewsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessSlug, setSelectedBusinessSlug] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);

  // دریافت لیست کسب‌وکارهای متعلق به کاربر
  useEffect(() => {
    const fetchMyBusinesses = async () => {
      try {
        // نکته: اگر آدرس API دریافت کسب‌وکارهای کاربر در پروژه شما متفاوت است، این خط را اصلاح کنید
        const res = await api.get("/directory/businesses/me/"); 
        
        // اگر ساختار دیتای بک‌اند شامل results است (به خاطر صفحه‌بندی)، از res.data.results استفاده کنید
        const data = res.data.results || res.data;
        setBusinesses(data);
        
        if (data.length > 0) {
          setSelectedBusinessSlug(data[0].slug);
        }
      } catch (error) {
        console.error("خطا در دریافت کسب‌وکارها:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyBusinesses();
  }, []);

  // دریافت نظرات وقتی کسب‌وکار انتخاب می‌شود
  useEffect(() => {
    const fetchReviews = async () => {
      if (!selectedBusinessSlug) return;
      try {
        const res = await api.get(`/directory/businesses/${selectedBusinessSlug}/reviews/`);
        setReviews(res.data);
      } catch (error) {
        console.error("خطا در دریافت نظرات:", error);
      }
    };
    fetchReviews();
  }, [selectedBusinessSlug]);

  // ثبت پاسخ مدیر
  const handleReplySubmit = async (reviewId: number) => {
    const text = replyText[reviewId];
    if (!text || text.trim() === "") {
      alert("لطفاً متن پاسخ را وارد کنید.");
      return;
    }

    setIsSubmitting(reviewId);
    try {
      await api.post(`/directory/reviews/${reviewId}/reply/`, {
        owner_reply: text,
      });
      alert("پاسخ شما با موفقیت ثبت شد.");
      
      // به‌روزرسانی لیست نظرات برای نمایش پاسخ جدید
      setReviews((prevReviews) =>
        prevReviews.map((review) =>
          review.id === reviewId
            ? { ...review, owner_reply: text, reply_date: new Date().toISOString() }
            : review
        )
      );
      
      // پاک کردن فیلد متنی پس از ارسال موفق
      setReplyText((prev) => ({ ...prev, [reviewId]: "" }));
    } catch (error) {
      console.error("خطا در ثبت پاسخ:", error);
      alert("خطایی رخ داد. مجدداً تلاش کنید.");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleReplyChange = (reviewId: number, text: string) => {
    setReplyText((prev) => ({ ...prev, [reviewId]: text }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        در حال بارگذاری اطلاعات...
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">مدیریت نظرات</h2>
        <Link href="/dashboard/owner" className="text-blue-600 hover:underline text-sm font-semibold">
          بازگشت به داشبورد اصلی
        </Link>
      </div>

      {businesses.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl text-gray-500">
          شما هنوز هیچ کسب‌وکاری ثبت نکرده‌اید.
        </div>
      ) : (
        <>
          {/* انتخابگر کسب‌وکار */}
          <div className="mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-gray-700 font-semibold mb-2">
              انتخاب کسب‌وکار برای مشاهده نظرات:
            </label>
            <select
              value={selectedBusinessSlug}
              onChange={(e) => setSelectedBusinessSlug(e.target.value)}
              className="w-full md:w-1/2 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* لیست نظرات */}
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <p className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                هیچ نظری برای این کسب‌وکار ثبت نشده است.
              </p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-sm transition">
                  {/* هدر کامنت */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg text-sm" dir="ltr">
                        {review.user_phone.slice(0, 7) + "****"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString("fa-IR")}
                      </span>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      ⭐ {review.rating}
                    </span>
                  </div>

                  {/* متن کامنت کاربر */}
                  <p className="text-gray-700 leading-relaxed mb-6">
                    {review.comment}
                  </p>

                  {/* بخش پاسخ مدیر */}
                  {review.owner_reply ? (
                    <div className="bg-blue-50 border-r-4 border-blue-500 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-blue-800 text-sm">پاسخ شما:</span>
                        {review.reply_date && (
                          <span className="text-xs text-gray-500">
                            {new Date(review.reply_date).toLocaleDateString("fa-IR")}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm">{review.owner_reply}</p>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <textarea
                        rows={3}
                        value={replyText[review.id] || ""}
                        onChange={(e) => handleReplyChange(review.id, e.target.value)}
                        placeholder="پاسخ خود را به عنوان مدیر کسب‌وکار بنویسید..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-3"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleReplySubmit(review.id)}
                          disabled={isSubmitting === review.id}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
                        >
                          {isSubmitting === review.id ? "در حال ارسال..." : "ثبت پاسخ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}