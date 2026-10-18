"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import { Heart, Loader2, Store, MapPin, Star, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Business {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    average_rating: number;
    review_count: number;
    location: { name: string };
    category: { name: string };
}

export default function ClientFavoritesPage() {
    const [favorites, setFavorites] = useState<Business[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const fetchFavorites = async () => {
        try {
            const token = Cookies.get("access_token");
            const res = await api.get("/directory/client/favorite-businesses/", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFavorites(res.data.results || res.data);
        } catch (error) {
            console.error("خطا در دریافت لیست علاقه‌مندی‌ها:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const handleRemoveFavorite = async (slug: string, id: string) => {
        setTogglingId(id);
        try {
            const token = Cookies.get("access_token");
            await api.post(`/directory/businesses/${slug}/toggle-favorite/`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFavorites(prev => prev.filter(biz => biz.id !== id));
        } catch (error) {
            alert("خطا در حذف از علاقه‌مندی‌ها.");
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-6">
                
                <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
                            فروشگاه‌های منتخب من
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">لیست کسب‌وکارهایی که برای دسترسی سریع‌تر نشان کرده‌اید.</p>
                    </div>
                    <Link href="/dashboard/client" className="flex items-center gap-2 text-slate-500 hover:text-rose-600 transition-colors bg-gray-50 px-4 py-2 rounded-xl font-bold text-sm">
                        <ArrowRight className="w-4 h-4" />
                        بازگشت
                    </Link>
                </header>

                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-rose-500" /></div>
                    ) : favorites.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <Store className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-bold">هیچ فروشگاهی در لیست منتخب شما وجود ندارد.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {favorites.map((biz) => (
                                <div key={biz.id} className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow relative group">
                                    <div className="flex gap-4 items-start mb-4">
                                        <div className="w-16 h-16 rounded-xl bg-gray-50 shrink-0 border border-gray-100 overflow-hidden">
                                            {biz.logo ? (
                                                <img src={biz.logo} alt={biz.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xl font-black text-gray-400">
                                                    {biz.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <Link href={`/business/${biz.slug}`} className="font-bold text-gray-900 hover:text-rose-600 transition-colors line-clamp-1">
                                                {biz.name}
                                            </Link>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                {biz.category?.name}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                        <div className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {biz.location?.name}</span>
                                            <span className="flex items-center gap-1 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {biz.average_rating} ({biz.review_count})</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => handleRemoveFavorite(biz.slug, biz.id)}
                                            disabled={togglingId === biz.id}
                                            className="text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                                        >
                                            {togglingId === biz.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}