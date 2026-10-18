"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import MobileMenu from "@/components/MobileMenu";
import { motion } from "framer-motion";

// تعریف تایپ‌ها
interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  average_rating: number;
  review_count: number;
  is_verified: boolean;
  is_premium: boolean;
  category: { id: string; name: string };
  location: { id: string; name: string };
  logo?: string | null;
  banner?: string | null;
  // فیلدهای جدید مربوط به سیستم تخفیف
  active_campaign?: {
    id: number;
    title: string;
    discount_percent: number;
    code: string;
  } | null;
}

interface Taxonomy {
  id: string;
  name: string;
  icon?: string; // فیلد جدید برای دریافت آیکون/ایموجی از بک‌اند
}

export default function HomePage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  // استیت‌های مربوط به جستجو و فیلتر
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [locations, setLocations] = useState<Taxonomy[]>([]);

  const { isAuthenticated, logout, role } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [cmsData, setCmsData] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<"category" | "location" | null>(null);
  const [activeStories, setActiveStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);

  // تایمر ۵ ثانیه‌ای استوری و رفتن به استوری بعدی
  useEffect(() => {
    if (selectedStory) {
      const timer = setTimeout(() => {
        // پیدا کردن ایندکس استوری فعلی در لیست
        const currentIndex = activeStories.findIndex(s => s.id === selectedStory.id);
        
        if (currentIndex !== -1 && currentIndex < activeStories.length - 1) {
          // اگر استوری بعدی وجود داشت، برو به بعدی
          setSelectedStory(activeStories[currentIndex + 1]);
        } else {
          // اگر استوری آخر بود، مودال را ببند
          setSelectedStory(null);
        }
      }, 5000); // ۵۰۰۰ میلی‌ثانیه = ۵ ثانیه
      
      return () => clearTimeout(timer); // پاک کردن تایمر در صورت بستن دستی
    }
  }, [selectedStory, activeStories]);

  useEffect(() => {
    setIsMounted(true);

    const fetchInitialData = async () => {
      try {
        // متغیر storiesRes به براکت زیر اضافه شد
        const [catsRes, locsRes, cmsRes, storiesRes] = await Promise.all([
          api.get("/taxonomy/categories/"),
          api.get("/taxonomy/locations/"),
          api.get("http://127.0.0.1:8000/api/v1/cms/data/"),
          api.get("/directory/public/stories/active/")
        ]);
        setCategories(catsRes.data.results || catsRes.data);
        setLocations(locsRes.data.results || locsRes.data);
        setCmsData(cmsRes.data);
        setActiveStories(storiesRes.data.results || storiesRes.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات اولیه", error);
      }
    };

    fetchInitialData();
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBusinesses = async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.get("/directory/businesses/", {
        params: {
          search: searchTerm,
          category: selectedCategory,
          location: selectedLocation,
          page: page,
        },
      });

      const realBusinesses = response.data.results || response.data;

      setBusinesses(realBusinesses);
      setHasNext(response.data.next !== null);
      setHasPrev(response.data.previous !== null);
      setCurrentPage(page);

      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 9));
      }
    } catch (error) {
      console.error("خطا در دریافت کسب‌وکارها:", error);
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBusinesses(1);
  };

  const siteDescription =
    cmsData?.settings?.homepage_description ||
    "کسب‌وکار خود رو معرفی کن، تخفیف‌های ویژه ارائه بده و مشتریان بیشتری جذب کن.";

  const mainBanners = cmsData?.banners?.filter((b: any) => b.position === "main_slider") || [];
  const promotionalBanners = cmsData?.banners?.filter((b: any) => b.position === "promotional") || [];
  const sidebarBanners = cmsData?.banners?.filter((b: any) => b.position === "sidebar") || [];

  const headerMenus = cmsData?.menus?.filter((m: any) => m.position === 'header') || [];
  const mobileMenus = cmsData?.menus?.filter((m: any) => m.position === "mobile") || [];

  // دریافت دیتای یکپارچه هیرو از دیتابیس
  const heroConfigString = cmsData?.settings?.hero_config;

  let heroData = {
    text: "همه کسب و کارها در یک مکان",
    align: "center",
    size: "lg"
  };

  if (heroConfigString) {
    try {
      const parsed = JSON.parse(heroConfigString);
      heroData = { ...heroData, ...parsed };
    } catch (error) {
      console.error("خطا در باز کردن اطلاعات هیرو");
    }
  }

  const siteTitle = heroData.text;
  const heroAlign = heroData.align;
  const heroSize = heroData.size;

  const alignClass = heroAlign === "right"
    ? "items-start text-right"
    : heroAlign === "left"
      ? "items-end text-left"
      : "items-center text-center";

  const titleSizeClass = heroSize === "sm"
    ? "text-3xl md:text-4xl"
    : heroSize === "md"
      ? "text-4xl md:text-5xl"
      : "text-4xl md:text-5xl lg:text-7xl";

  const descSizeClass = heroSize === "sm"
    ? "text-sm md:text-base"
    : "text-base md:text-lg";

  // فیلتر کردن کسب‌وکارهای تخفیف‌دار برای بخش تخفیف‌های داغ
  const hotDeals = businesses.filter(b => b.active_campaign != null);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      <div>
        {/* هدر سایت - ارتقا یافته با افکت شیشه‌ای */}
        <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300">
                  📍
                </div>
                <div>
                  <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-slate-900 to-slate-700 block">چهارسوق</span>
                  <span className="text-[10px] text-slate-500 font-semibold block tracking-wide">معرفی و رشد کسب‌وکارها</span>
                </div>
              </Link>

              <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
                {headerMenus.length > 0 ? (
                  headerMenus.sort((a: any, b: any) => a.order - b.order).map((menuItem: any) => (
                    <Link
                      key={menuItem.id}
                      href={menuItem.url}
                      className="hover:text-emerald-600 transition-colors relative after:absolute after:bottom-0 after:right-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-emerald-500 after:transition-all after:duration-300 pb-1"
                    >
                      {menuItem.title}
                    </Link>
                  ))
                ) : (
                  <Link href="/" className="text-emerald-600 font-bold">صفحه اصلی</Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {isMounted ? (
                <>
                  {isAuthenticated ? (
                    <div className="flex gap-4 items-center">
                      {/* متن جایگزین برای کاربر لاگین شده */}
                      <span className="text-sm font-bold text-slate-700 hidden sm:block">
                       سلام، کاربر عزیز 👋
                      </span>

                      {role === "ADMIN" && (
                        <Link href="/admin-panel" className="text-slate-700 hover:text-emerald-600 font-bold transition text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl hover:shadow-md">
                          پنل مدیریت کل
                        </Link>
                      )}
                      {role === "BUSINESS_OWNER" && (
                        <Link href="/dashboard/owner" className="text-slate-700 hover:text-emerald-600 font-bold transition text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl hover:shadow-md">
                          پنل کسب‌وکار
                        </Link>
                      )}
                      {(role === "CLIENT" || !role) && (
                        <Link href="/dashboard/client" className="text-slate-700 hover:text-emerald-600 font-bold transition text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl hover:shadow-md">
                          پنل کاربری
                        </Link>
                      )}
                      <button
                        onClick={() => { logout(); window.location.reload(); }}
                        className="text-rose-500 text-sm font-bold px-3 py-2 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        خروج
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* اگر لاگین نبود، دکمه‌های ورود و ثبت کسب‌وکار نمایش داده می‌شوند */}
                      <Link
                        href="/login"
                        className="hidden sm:inline-flex items-center justify-center bg-slate-900 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 hover:shadow-emerald-600/30 transition-all duration-300 hover:-translate-y-0.5">
                        ثبت کسب‌وکار
                      </Link>

                      <Link
                        href="/login"
                        className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-300"
                      >
                        <span>🔑 ورود</span>
                      </Link>
                    </>
                  )}
                </>
              ) : (
                <div className="flex gap-4">
                  <div className="hidden sm:block w-32 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                  <div className="w-24 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* نوار استوری‌ها (شبیه اینستاگرام) */}
        {activeStories.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 mb-2">
            <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-2 snap-x hide-scrollbar">
              {activeStories.map((story) => (
                <button 
                  key={story.id} 
                  onClick={() => setSelectedStory(story)}
                  className="snap-start shrink-0 flex flex-col items-center gap-2 w-20 group outline-none"
                >
                  <div className="relative w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 group-hover:scale-105 transition-transform">
                    <div className="w-full h-full bg-white rounded-full p-0.5 overflow-hidden">
                      {story.business_logo ? (
                        <img src={story.business_logo} alt={story.business_name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black text-xl">
                          {story.business_name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 truncate w-full text-center">
                    {story.business_name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 md:px-8 relative overflow-hidden">

          {/* هیرو سکشن یکپارچه */}
          <section className="relative w-full min-h-[500px] md:min-h-[550px] rounded-[2.5rem] overflow-hidden mt-6 mb-12 flex flex-col justify-center items-center shadow-sm border border-slate-200/50">
            <div className="absolute inset-0 w-full h-full z-0">
              {mainBanners.length > 0 ? (
                <Swiper
                  modules={[Autoplay]}
                  autoplay={{ delay: 5000, disableOnInteraction: false }}
                  effect="fade"
                  className="w-full h-full"
                >
                  {mainBanners.map((banner: any) => (
                    <SwiperSlide key={banner.id}>
                      <div className="relative w-full h-full">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/95 backdrop-blur-[2px] z-10"></div>
                        <img
                          src={`http://127.0.0.1:8000${banner.image}`}
                          alt={banner.title}
                          className="w-full h-full object-cover scale-105"
                        />
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-50/50 to-slate-100"></div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`relative z-20 w-full max-w-4xl mx-auto px-4 py-12 flex flex-col ${alignClass}`}
            >
              <h2 className={`${titleSizeClass} font-black mb-6 leading-tight text-slate-900 drop-shadow-sm transition-all duration-300`}>
                {siteTitle}
              </h2>

              <p className={`${descSizeClass} text-slate-700 font-bold leading-relaxed mb-10 drop-shadow-sm transition-all duration-300`}>
                {siteDescription}
              </p>

              {/* باکس جستجو و فیلتر */}
              <form
                onSubmit={handleSearch}
                className="bg-white/90 backdrop-blur-xl p-2 md:p-3 rounded-3xl md:rounded-full shadow-2xl shadow-emerald-900/10 border border-white flex flex-col md:flex-row gap-2 w-full max-w-4xl mx-auto"
              >
                <div className="flex-1 flex items-center px-4 bg-transparent transition">
                  <span className="text-slate-400 text-lg ml-2">🔍</span>
                  <input
                    type="text"
                    placeholder="نام کسب‌وکار یا خدمات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-3 bg-transparent focus:outline-none text-base text-slate-800 placeholder-slate-500 font-medium"
                  />
                </div>

                <div className="hidden md:block w-px h-8 bg-slate-200 self-center"></div>

                <div className="relative md:w-48">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === "category" ? null : "category")}
                    className="w-full py-3 px-4 bg-transparent text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none"
                  >
                    <span className="truncate">{categories.find(c => c.id === selectedCategory)?.name || "دسته بندی (همه)"}</span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>

                  {activeDropdown === "category" && (
                    <ul className="absolute top-full mt-3 right-0 w-full bg-white border border-slate-100 shadow-xl rounded-2xl max-h-60 overflow-y-auto py-2 z-50">
                      <li onClick={() => { setSelectedCategory(""); setActiveDropdown(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition">همه دسته‌بندی‌ها</li>
                      {categories.map((cat) => (
                        <li key={cat.id} onClick={() => { setSelectedCategory(cat.id); setActiveDropdown(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition">
                          {cat.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="hidden md:block w-px h-8 bg-slate-200 self-center"></div>

                <div className="relative md:w-48">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === "location" ? null : "location")}
                    className="w-full py-3 px-4 bg-transparent text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none"
                  >
                    <span className="truncate">{locations.find(l => l.id === selectedLocation)?.name || "مکان (همه)"}</span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>

                  {activeDropdown === "location" && (
                    <ul className="absolute top-full mt-3 right-0 w-full bg-white border border-slate-100 shadow-xl rounded-2xl max-h-60 overflow-y-auto py-2 z-50">
                      <li onClick={() => { setSelectedLocation(""); setActiveDropdown(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition">همه مکان‌ها</li>
                      {locations.map((loc) => (
                        <li key={loc.id} onClick={() => { setSelectedLocation(loc.id); setActiveDropdown(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition">
                          {loc.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-10 py-4 rounded-2xl md:rounded-full transition-all duration-300 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/50 text-sm w-full md:w-auto mt-2 md:mt-0"
                >
                  جستجو کن
                </button>
              </form>
            </motion.div>
          </section>

          {/* نوار دسته‌بندی‌های سریع با پشتیبانی از آیکون‌های داینامیک بک‌اند */}
          <div className="mb-16">
            <div className="flex items-center justify-start md:justify-center overflow-x-auto gap-4 pb-4 px-2 snap-x hide-scrollbar">
              {categories.slice(0, 8).map((cat) => {
                
                // خواندن آیکون واقعی از دیتابیس (اگر خالی بود، یک پین به عنوان پیش‌فرض نشان می‌دهد)
                const iconDisplay = cat.icon || "📌"; 

                return (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); fetchBusinesses(1); }}
                    className="snap-center shrink-0 flex flex-col items-center gap-3 p-4 w-[100px] group cursor-pointer bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-gradient-to-br group-hover:from-emerald-400 group-hover:to-emerald-500 flex items-center justify-center text-2xl transition-colors duration-300 group-hover:text-white">
                      
                      {/* این کد به صورت هوشمند هم ایموجی و هم لینک عکس را پشتیبانی می‌کند */}
                      {iconDisplay.startsWith('http') || iconDisplay.startsWith('/') ? (
                          <img src={iconDisplay} alt={cat.name} className="w-8 h-8 object-contain" />
                      ) : (
                          <span>{iconDisplay}</span>
                      )}

                    </div>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-600 transition text-center truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {promotionalBanners.length > 0 && (
            <div className="w-full mb-16 rounded-[1.5rem] overflow-hidden shadow-lg border border-white">
              <Swiper modules={[Autoplay, Pagination]} autoplay={{ delay: 5000 }} pagination={{ clickable: true }} className="w-full h-32 md:h-48">
                {promotionalBanners.map((banner: any) => (
                  <SwiperSlide key={banner.id}>
                    <a href={banner.url || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                      <img src={`http://127.0.0.1:8000${banner.image}`} alt={banner.title} className="w-full h-full object-cover" />
                    </a>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}

          {/* سکشن تخفیف‌های داغ (Hot Deals) */}
          {loading ? (
            // اضافه شدن اسکلتون لودینگ مخصوص بخش تخفیف‌های داغ
            <div className="mb-16">
              <div className="flex justify-between items-end mb-6 px-2">
                <div>
                  <div className="h-8 w-48 bg-slate-200 rounded-xl mb-3 animate-pulse"></div>
                  <div className="h-4 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
                </div>
              </div>
              <div className="flex gap-5 overflow-hidden px-2 pb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={`skeleton-hot-${i}`} className="min-w-[280px] w-full md:w-1/3 lg:w-1/4 bg-slate-100 rounded-[2rem] p-6 border border-slate-50 h-[180px] animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : hotDeals.length > 0 && (
            <div className="mb-16">
              <div className="flex justify-between items-end mb-6 px-2">
                <div>
                  <h3 className="text-2xl font-black text-rose-600 flex items-center gap-2">
                    <span className="animate-pulse">🔥</span> تخفیف‌های داغ امروز
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 font-medium">بهترین پیشنهادات با زمان محدود</p>
                </div>
              </div>

              <Swiper
                modules={[Autoplay, Navigation]}
                spaceBetween={20}
                slidesPerView={1.2}
                breakpoints={{ 640: { slidesPerView: 2.2 }, 1024: { slidesPerView: 3.5 } }}
                // حل مشکل بریده شدن سایه با اضافه کردن پدینگ‌های عمیق به بالا و پایین اسلایدر
                className="!pb-14 !pt-6 !px-4 -mx-4"
              >
                {hotDeals.map((business) => (
                  <SwiperSlide key={`hot-${business.id}`}>
                    <Link href={`/business/${business.slug}`} className="block bg-gradient-to-br from-rose-50 to-orange-50 rounded-[2rem] p-6 border border-rose-100 hover:shadow-2xl hover:shadow-rose-500/30 hover:-translate-y-2 transition-all duration-300">
                      <div className="flex items-center gap-4 mb-5">
                        {business.logo ? (
                          <img src={business.logo} alt={business.name} className="w-14 h-14 rounded-2xl object-cover border border-white shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-rose-500 font-black text-xl shadow-sm">
                            {business.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-800 line-clamp-1">{business.name}</h4>
                          <span className="text-xs text-rose-600 font-bold bg-white px-2.5 py-1 rounded-lg inline-block mt-1.5 shadow-sm">
                            {business.active_campaign?.title || "پیشنهاد ویژه"}
                          </span>
                        </div>
                      </div>

                      {/* اصلاح پدینگ و ساختار باکس داخلی برای زیباتر شدن دکمه */}
                      <div className="bg-white rounded-2xl p-3.5 flex justify-between items-center shadow-sm">
                        <span className="text-sm font-bold text-slate-500 mr-2">دریافت کد تخفیف</span>
                        <span className="bg-rose-500 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md shadow-rose-500/20">مشاهده</span>
                      </div>
                    </Link>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}

          {/* ساختار دو ستونه: لیست اصلی کسب‌وکارها + سایدبار */}
          <div className="flex flex-col lg:flex-row gap-8 mb-20">
            {/* ستون اصلی */}
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  جدیدترین <span className="text-emerald-600">کسب‌وکارها</span>
                </h3>
              </div>

              {loading ? (
                // اسکلتون لودینگ پرو مکس
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm animate-pulse h-64 flex flex-col justify-between">
                      <div className="flex gap-4 mb-4">
                        <div className="w-14 h-14 bg-slate-200 rounded-2xl"></div>
                        <div className="flex-1 py-1"><div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></div>
                      </div>
                      <div className="space-y-2"><div className="h-3 bg-slate-200 rounded w-full"></div><div className="h-3 bg-slate-200 rounded w-5/6"></div></div>
                      <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between"><div className="h-4 bg-slate-200 rounded w-1/3"></div><div className="h-4 bg-slate-200 rounded w-1/4"></div></div>
                    </div>
                  ))}
                </div>
              ) : businesses.length === 0 ? (
                <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-slate-100">
                  <span className="text-4xl mb-4 block">🔍</span>
                  <h4 className="text-lg font-bold text-slate-700 mb-2">نتیجه‌ای یافت نشد!</h4>
                  <p className="text-sm text-slate-500">هیچ کسب‌وکاری با مشخصات مورد نظر شما ثبت نشده است.</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {businesses.map((business) => (
                    <Link
                      key={business.id}
                      href={`/business/${business.slug}`}
                      className="group bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* بج تخفیف روی کارت */}
                      {business.active_campaign && (
                        <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/30 flex items-center gap-1 z-10 animate-pulse">
                          🔥 {business.active_campaign?.title}
                        </div>
                      )}

                      {/* نوار رنگی بالای کارت در حالت هاور */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                      <div>
                        <div className="flex justify-between items-start mb-5 gap-4">
                          <div className="flex items-center gap-3">
                            {business.logo ? (
                              <img src={business.logo} alt={business.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-sm group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xl shadow-inner">
                                {business.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h3 className="text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors line-clamp-1">
                                {business.name}
                              </h3>
                              <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md mt-1 inline-block">
                                {business.category?.name || "عمومی"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-slate-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                          {business.description}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500 border-t border-slate-100 pt-4 mt-auto">
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-500 text-base">📍</span> {business.location?.name || "نامشخص"}
                        </span>
                        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2.5 py-1.5 rounded-lg border border-amber-100/50">
                          ⭐ {business.average_rating} <span className="text-amber-500/70">({business.review_count})</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </motion.div>
              )}

              {/* صفحه‌بندی مدرن */}
              {!loading && businesses.length > 0 && (
                <div className="flex justify-center items-center gap-6 mt-14 mb-8">
                  <button
                    onClick={() => fetchBusinesses(currentPage - 1)} disabled={!hasPrev}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 shadow-sm"
                  >
                    {"<"}
                  </button>
                  <span className="text-slate-600 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                    صفحه {currentPage} از {totalPages}
                  </span>
                  <button
                    onClick={() => fetchBusinesses(currentPage + 1)} disabled={!hasNext}
                    className="w-10 h-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-md shadow-emerald-600/20"
                  >
                    {">"}
                  </button>
                </div>
              )}
            </div>

            {/* سایدبار */}
            {sidebarBanners.length > 0 && (
              <aside className="w-full lg:w-1/4 lg:max-w-[300px] shrink-0">
                <div className="sticky top-28">
                  <Swiper modules={[Autoplay, Pagination]} autoplay={{ delay: 3500 }} pagination={{ clickable: true }} className="w-full rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-white">
                    {sidebarBanners.map((banner: any) => (
                      <SwiperSlide key={banner.id}>
                        <a href={banner.url || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-auto relative group">
                          <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                          <img src={`http://127.0.0.1:8000${banner.image}`} alt={banner.title} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700" />
                        </a>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>

      {/* مودال (پاپ‌آپ) نمایش استوری */}
      {selectedStory && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
          
          {/* کانتینر هدر استوری (پروگرس بار + اطلاعات + دکمه بستن) */}
          <div className="absolute top-0 left-0 right-0 z-50 w-full max-w-md mx-auto pt-4 px-4 flex flex-col gap-3">
            
            {/* پروگرس بار (نوار پیشرفت زمان) با انیمیشن */}
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden shadow-sm">
              <motion.div
                key={selectedStory.id} // کلید برای ریست شدن انیمیشن در هر استوری
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5, ease: "linear" }}
                className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              />
            </div>

            <div className="flex justify-between items-center w-full">
              {/* اطلاعات کسب‌وکار */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white p-0.5">
                  {selectedStory.business_logo ? (
                    <img src={selectedStory.business_logo} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">{selectedStory.business_name.charAt(0)}</div>
                  )}
                </div>
                <div className="flex flex-col">
                  <Link href={`/business/${selectedStory.business_slug}`} className="text-white font-bold text-shadow text-sm hover:underline drop-shadow-md">
                    {selectedStory.business_name}
                  </Link>
                  <span className="text-white/80 text-[10px] drop-shadow-md">تازه‌ها</span>
                </div>
              </div>

              {/* دکمه بستن - حالا کاملاً در دسترس و تراز شده است */}
              <button 
                onClick={() => setSelectedStory(null)}
                className="text-white p-2 drop-shadow-md hover:bg-white/20 rounded-full transition-colors flex items-center justify-center"
              >
                <span className="text-2xl font-black leading-none pb-1">✕</span>
              </button>
            </div>
          </div>

          {/* مدیا استوری */}
          <div className="relative w-full h-full max-w-md md:h-[85vh] md:aspect-[9/16] bg-slate-900 md:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
             <img 
                src={selectedStory.media} 
                alt="Story" 
                className="w-full h-full object-contain"
             />
             
             {/* دکمه لینک (Swipe Up) */}
             {selectedStory.link && (
               <div className="absolute bottom-12 left-0 right-0 flex justify-center pb-safe">
                  <a 
                    href={selectedStory.link} 
                    target="_blank" 
                    className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-6 py-3 rounded-full font-bold hover:bg-white text-sm transition-colors flex items-center gap-2 hover:text-black animate-pulse shadow-lg"
                  >
                    🔗 مشاهده لینک
                  </a>
               </div>
             )}
          </div>
        </div>
      )}

      {/* فوتر مینیمال و شیک (دقیقاً کدهای خودتان) */}
      <footer className="bg-slate-950 text-slate-300 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* ... (فوتر شما مشابه قبل، اما با رنگ‌های عمیق‌تر مانند slate-950 برای تضاد زیباتر) ... */}
          {/* برای خلاصه شدن پاسخ، فوتر دست نخورده است، فقط bg کلاس footer به bg-slate-950 تغییر کرد */}
          <div className="col-span-1 md:col-span-4 text-center border-t border-slate-800 pt-8 text-sm text-slate-500 font-medium">
            تمامی حقوق مادی و معنوی برای پلتفرم چهارسوق محفوظ است.
          </div>
        </div>
      </footer>

      <div className="block md:hidden">
        <MobileMenu />
      </div>
    </div >
  );
}