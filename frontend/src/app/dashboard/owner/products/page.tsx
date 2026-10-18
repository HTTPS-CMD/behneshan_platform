"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Cookies from "js-cookie";
import Link from "next/link";
import { Package, Plus, Trash2, Tag, Zap, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Product {
    id: number;
    name: string;
    price: number;
    discount_percentage: number;
    is_flash_sale: boolean;
    final_price: number;
}

export default function OwnerProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        price: "",
        discount_percentage: "0",
        is_flash_sale: false,
    });

    const fetchProducts = async () => {
        try {
            const token = Cookies.get("access_token");
            const res = await api.get("/directory/owner/products/", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data.results || res.data);
        } catch (error) {
            console.error("خطا در دریافت محصولات:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = Cookies.get("access_token");
            await api.post("/directory/owner/products/", {
                name: formData.name,
                price: parseInt(formData.price),
                discount_percentage: parseInt(formData.discount_percentage),
                is_flash_sale: formData.is_flash_sale
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            alert("محصول با موفقیت اضافه شد!");
            setFormData({ name: "", price: "", discount_percentage: "0", is_flash_sale: false });
            fetchProducts();
        } catch (error) {
            alert("خطا در ثبت محصول. لطفاً اطلاعات را بررسی کنید.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("آیا از حذف این محصول مطمئن هستید؟")) return;
        try {
            const token = Cookies.get("access_token");
            await api.delete(`/directory/owner/products/${id}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchProducts();
        } catch (error) {
            alert("خطا در حذف محصول.");
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* هدر صفحه */}
                <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Package className="w-7 h-7 text-blue-600" />
                            مدیریت محصولات و خدمات
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">محصولات خود را اضافه کنید و تخفیف‌ها را مدیریت نمایید.</p>
                    </div>
                    <Link href="/dashboard/owner" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors bg-gray-50 px-4 py-2 rounded-xl font-bold text-sm">
                        <ArrowRight className="w-4 h-4" />
                        بازگشت
                    </Link>
                </header>

                {/* فرم ثبت محصول جدید */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-black text-slate-800 mb-6">افزودن محصول جدید</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-2">نام محصول / خدمت</label>
                                <Input required name="name" value={formData.name} onChange={handleChange} placeholder="مثال: پیراهن مردانه" className="h-12 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">قیمت پایه (تومان)</label>
                                <Input required type="number" name="price" value={formData.price} onChange={handleChange} placeholder="مثال: 500000" dir="ltr" className="h-12 text-left bg-gray-50 font-bold" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">درصد تخفیف</label>
                                <Input required type="number" min="0" max="100" name="discount_percentage" value={formData.discount_percentage} onChange={handleChange} placeholder="0" dir="ltr" className="h-12 text-left bg-gray-50 font-bold" />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-gray-100 mt-4">
                            <label className="flex items-center gap-3 cursor-pointer bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 w-full md:w-auto">
                                <div className="relative flex items-center">
                                    <input type="checkbox" name="is_flash_sale" checked={formData.is_flash_sale} onChange={handleChange} className="w-5 h-5 accent-amber-500 rounded cursor-pointer" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-amber-900 flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500 fill-amber-500"/> قرارگیری در فروش فوری</span>
                                    <span className="text-xs font-bold text-amber-700/70">نمایش ویژه در لیست محصولات شگفت‌انگیز</span>
                                </div>
                            </label>

                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 rounded-xl shadow-lg">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5 ml-2" /> ثبت محصول</>}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* لیست محصولات ثبت شده */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-gray-800">لیست محصولات شما</h3>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-bold">هنوز هیچ محصولی ثبت نکرده‌اید.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map((product) => (
                                <div key={product.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group overflow-hidden">
                                    {product.is_flash_sale && (
                                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl flex items-center gap-1">
                                            <Zap className="w-3 h-3 fill-white" /> فروش فوری
                                        </div>
                                    )}
                                    <div className="mt-2 mb-4">
                                        <h4 className="font-bold text-gray-800 text-lg mb-1 truncate">{product.name}</h4>
                                        {product.discount_percentage > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-400 line-through">{product.price.toLocaleString()}</span>
                                                <span className="bg-rose-100 text-rose-700 text-xs font-black px-2 py-0.5 rounded-md">{product.discount_percentage}%</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-500 opacity-0 hidden md:block">بدون تخفیف</span>
                                        )}
                                        <div className="text-blue-600 font-black text-xl mt-1">
                                            {product.final_price.toLocaleString()} <span className="text-xs text-gray-400 font-bold">تومان</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end border-t border-gray-100 pt-3">
                                        <button onClick={() => handleDelete(product.id)} className="text-rose-500 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-bold">
                                            <Trash2 className="w-4 h-4" /> حذف
                                        </button>
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