"use client";

import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { getCmsData } from "@/lib/cms";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Flame, MapPin, Search, SearchX, Sparkles, Star, Ticket, X } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import SearchParamsSync from "@/components/site/SearchParamsSync";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { mediaUrl } from "@/lib/format";

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
  const [heroIndex, setHeroIndex] = useState(0);

  // استیت‌های مربوط به جستجو و فیلتر
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [locations, setLocations] = useState<Taxonomy[]>([]);

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

    const fetchInitialData = async () => {
      try {
        // متغیر storiesRes به براکت زیر اضافه شد
        const [catsRes, locsRes, cmsRes, storiesRes] = await Promise.all([
          api.get("/taxonomy/categories/"),
          api.get("/taxonomy/locations/"),
          getCmsData().then((data) => ({ data })),
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
    // اگر آدرس فیلتر دارد (مثلاً از منوی موبایل)، SearchParamsSync نتیجه‌ی فیلترشده را می‌گیرد
    if (!new URLSearchParams(window.location.search).toString()) fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filters: برای وقتی که فیلترها از آدرس صفحه (منوی موبایل) می‌آیند و state هنوز به‌روز نشده
  const fetchBusinesses = async (page = 1, filters?: { search: string; category: string; location: string }) => {
    setLoading(true);
    try {
      const response = await api.get("/directory/businesses/", {
        params: {
          search: filters ? filters.search : searchTerm,
          category: filters ? filters.category : selectedCategory,
          location: filters ? filters.location : selectedLocation,
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


  // فیلتر از آدرس صفحه (دسته‌بندی/جستجوی منوی پایین موبایل)
  const applyUrlFilters = (q: URLSearchParams) => {
    const filters = { search: q.get("search") || "", category: q.get("category") || "", location: q.get("location") || "" };
    setSearchTerm(filters.search);
    setSelectedCategory(filters.category);
    setSelectedLocation(filters.location);
    fetchBusinesses(1, filters);
    if (filters.search || filters.category || filters.location) {
      setTimeout(() => document.getElementById("latest-title")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
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

  // اسلایدر بنرهای هیرو: هر چند ثانیه یک‌بار بنر بعدی با محو شدن نرم نمایش داده می‌شود.
  // فاصله‌ی زمانی از تنظیم hero_slider_interval (ثانیه) خوانده می‌شود؛ پیش‌فرض ۵ ثانیه.
  const heroInterval = Math.max(2, Number(cmsData?.settings?.hero_slider_interval) || 5) * 1000;
  const heroIndexSafe = mainBanners.length ? heroIndex % mainBanners.length : 0;
  const promotionalBanners = cmsData?.banners?.filter((b: any) => b.position === "promotional") || [];
  const sidebarBanners = cmsData?.banners?.filter((b: any) => b.position === "sidebar") || [];

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



  useEffect(() => {
    if (mainBanners.length < 2) return;
    // با هر تغییر بنر (خودکار یا کلیک روی نقطه‌ها) زمان‌سنج از نو شروع می‌شود
    const id = setTimeout(() => setHeroIndex((i) => (i + 1) % mainBanners.length), heroInterval);
    return () => clearTimeout(id);
  }, [heroIndex, mainBanners.length, heroInterval]);

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between font-sans selection:bg-saffron-200 selection:text-brand-900" dir="rtl">
      <div>
        {/* ================= هدر ================= */}
        <SiteHeader />
        <Suspense fallback={null}>
          <SearchParamsSync onChange={applyUrlFilters} />
        </Suspense>

        {/* ================= استوری‌ها ================= */}
        {activeStories.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 mb-2">
            <Stagger className="flex items-center gap-4 overflow-x-auto pb-4 pt-2 snap-x hide-scrollbar">
              {activeStories.map((story) => (
                <StaggerItem key={story.id} className="snap-start shrink-0">
                  <button
                    onClick={() => setSelectedStory(story)}
                    className="flex flex-col items-center gap-2 w-20 group outline-none"
                    aria-label={`استوری ${story.business_name}`}
                  >
                    <div className="relative w-[68px] h-[68px] rounded-full p-[3px] bg-[conic-gradient(from_180deg,var(--color-saffron-500),var(--color-brand-700),var(--color-saffron-400),var(--color-saffron-500))] transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                      <div className="w-full h-full bg-cream rounded-full p-0.5 overflow-hidden">
                        {story.business_logo ? (
                          <img src={story.business_logo} alt={story.business_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-brand-50 rounded-full flex items-center justify-center text-brand-700 font-black text-xl">
                            {story.business_name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-brand-700 truncate w-full text-center">{story.business_name}</span>
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 md:px-8 relative">

          {/* ================= هیرو ================= */}
          <section className="relative z-30 w-full min-h-[520px] md:min-h-[580px] rounded-[2rem] md:rounded-[2.75rem] mt-6 mb-14 flex flex-col justify-center items-center bg-brand-900 shadow-2xl shadow-brand-900/20 isolate">
            {/* لایه‌ی پس‌زمینه جدا برش می‌خورد تا منوهای بازشونده‌ی جستجو بیرون از بنر کامل دیده شوند */}
            <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden rounded-[inherit]">
              {mainBanners.length > 0 ? (
                <AnimatePresence initial={false}>
                  <motion.div
                    key={mainBanners[heroIndexSafe].id}
                    initial={{ opacity: 0, scale: 1.08 }}
                    animate={{ opacity: 1, scale: 1.02 }}
                    exit={{ opacity: 0 }}
                    transition={{ opacity: { duration: 1.2, ease: "easeInOut" }, scale: { duration: heroInterval / 1000 + 1.2, ease: "linear" } }}
                    className="absolute inset-0"
                  >
                    {/* next/image: تصویر را به اندازه‌ی صفحه‌ی کاربر کوچک و به WebP/AVIF تبدیل می‌کند؛ بنر اول با اولویت بالا بارگذاری می‌شود */}
                    <Image
                      src={mediaUrl(mainBanners[heroIndexSafe].image)}
                      alt={mainBanners[heroIndexSafe].title}
                      fill
                      priority={heroIndexSafe === 0}
                      fetchPriority={heroIndexSafe === 0 ? "high" : "auto"}
                      sizes="(max-width: 1280px) 100vw, 1216px"
                      quality={75}
                      className="object-cover"
                    />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="w-full h-full bg-[radial-gradient(70%_80%_at_85%_10%,rgba(218,127,55,0.35),transparent_60%),radial-gradient(60%_70%_at_10%_100%,rgba(63,110,156,0.45),transparent_60%)]" />
              )}
              {/* لایه‌ی سرمه‌ای روی عکس برای خوانایی متن */}
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-brand-950/95 via-brand-900/70 to-brand-800/40" />
              <div className="pointer-events-none absolute inset-0 z-10 bg-girih-light opacity-80" />
              {/* طاق تزئینی برگرفته از لوگو */}
              <svg aria-hidden="true" viewBox="0 0 400 300" className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 w-[620px] max-w-[120%] text-cream/10 z-10">
                <path d="M20 300V170C20 80 110 20 200 8c90 12 180 72 180 162v130" fill="none" stroke="currentColor" strokeWidth="10" />
                <path d="M60 300V180c0-70 70-118 140-130 70 12 140 60 140 130v120" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </div>

            {/* نقطه‌های اسلایدر بنر (فقط وقتی بیش از یک بنر فعال است) */}
            {mainBanners.length > 1 && (
              <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                {mainBanners.map((banner: any, i: number) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setHeroIndex(i)}
                    aria-label={`نمایش بنر ${i + 1}`}
                    aria-current={i === heroIndexSafe}
                    className="flex h-6 items-center justify-center px-1"
                  >
                    <span className={`block h-1.5 rounded-full transition-all duration-500 ${i === heroIndexSafe ? "w-7 bg-saffron-400" : "w-1.5 bg-cream/50 hover:bg-cream/80"}`} />
                  </button>
                ))}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`relative z-20 w-full max-w-4xl mx-auto px-4 py-14 flex flex-col ${alignClass}`}
            >
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/10 px-4 py-1.5 text-xs font-bold text-saffron-200 backdrop-blur"
              >
                <Sparkles className="h-3.5 w-3.5" />
                تخفیف واقعی از کسب‌وکارهای تأییدشده
              </motion.span>

              <h1 className={`${titleSizeClass} font-black mb-5 leading-[1.25] text-cream drop-shadow-[0_2px_12px_rgba(10,32,54,0.4)]`}>
                {siteTitle}
              </h1>

              <p className={`${descSizeClass} text-brand-100 font-semibold leading-relaxed mb-10 max-w-2xl`}>
                {siteDescription}
              </p>

              {/* باکس جستجو و فیلتر */}
              <form
                onSubmit={handleSearch}
                className="bg-white/95 backdrop-blur-xl p-2 md:p-2.5 rounded-3xl md:rounded-full shadow-2xl shadow-brand-950/30 ring-1 ring-white/60 flex flex-col md:flex-row gap-1 md:gap-2 w-full max-w-4xl mx-auto"
              >
                <label className="flex-1 flex items-center gap-2 px-4 rounded-2xl md:rounded-full transition-colors focus-within:bg-cream">
                  <Search className="h-5 w-5 shrink-0 text-brand-400" />
                  <span className="sr-only">جستجو</span>
                  <input
                    type="text"
                    placeholder="نام کسب‌وکار یا خدمات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="no-focus-ring w-full py-3.5 bg-transparent text-base text-brand-900 placeholder-brand-300 font-medium"
                  />
                </label>

                <div className="hidden md:block w-px h-8 bg-cream-200 self-center"></div>

                <div className="relative md:w-48">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === "category" ? null : "category")}
                    aria-expanded={activeDropdown === "category"}
                    className="w-full py-3.5 px-4 rounded-2xl md:rounded-full bg-transparent text-sm font-bold text-brand-800 flex justify-between items-center gap-2 transition-colors hover:bg-cream focus:outline-none"
                  >
                    <span className="truncate">{categories.find(c => c.id === selectedCategory)?.name || "دسته بندی (همه)"}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-brand-400 transition-transform duration-300 ${activeDropdown === "category" ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {activeDropdown === "category" && (
                      <motion.ul
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="absolute top-full mt-3 right-0 w-full min-w-[12rem] bg-white border border-cream-200 shadow-2xl shadow-brand-900/15 rounded-2xl max-h-64 overflow-y-auto py-2 z-50 text-right"
                      >
                        <li onClick={() => { setSelectedCategory(""); setActiveDropdown(null); }} className="px-4 py-2.5 text-sm text-brand-700 hover:bg-saffron-50 hover:text-saffron-800 cursor-pointer transition">همه دسته‌بندی‌ها</li>
                        {categories.map((cat) => (
                          <li key={cat.id} onClick={() => { setSelectedCategory(cat.id); setActiveDropdown(null); }} className={`px-4 py-2.5 text-sm cursor-pointer transition hover:bg-saffron-50 hover:text-saffron-800 ${selectedCategory === cat.id ? "font-bold text-saffron-700" : "text-brand-700"}`}>
                            {cat.name}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>

                <div className="hidden md:block w-px h-8 bg-cream-200 self-center"></div>

                <div className="relative md:w-48">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === "location" ? null : "location")}
                    aria-expanded={activeDropdown === "location"}
                    className="w-full py-3.5 px-4 rounded-2xl md:rounded-full bg-transparent text-sm font-bold text-brand-800 flex justify-between items-center gap-2 transition-colors hover:bg-cream focus:outline-none"
                  >
                    <span className="truncate">{locations.find(l => l.id === selectedLocation)?.name || "مکان (همه)"}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-brand-400 transition-transform duration-300 ${activeDropdown === "location" ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {activeDropdown === "location" && (
                      <motion.ul
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="absolute top-full mt-3 right-0 w-full min-w-[12rem] bg-white border border-cream-200 shadow-2xl shadow-brand-900/15 rounded-2xl max-h-64 overflow-y-auto py-2 z-50 text-right"
                      >
                        <li onClick={() => { setSelectedLocation(""); setActiveDropdown(null); }} className="px-4 py-2.5 text-sm text-brand-700 hover:bg-saffron-50 hover:text-saffron-800 cursor-pointer transition">همه مکان‌ها</li>
                        {locations.map((loc) => (
                          <li key={loc.id} onClick={() => { setSelectedLocation(loc.id); setActiveDropdown(null); }} className={`px-4 py-2.5 text-sm cursor-pointer transition hover:bg-saffron-50 hover:text-saffron-800 ${selectedLocation === loc.id ? "font-bold text-saffron-700" : "text-brand-700"}`}>
                            {loc.name}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-saffron-500 hover:bg-saffron-400 active:scale-[0.98] text-brand-950 font-black px-9 py-4 rounded-2xl md:rounded-full transition-all duration-300 shadow-lg shadow-saffron-500/40 text-sm w-full md:w-auto mt-1 md:mt-0"
                >
                  <Search className="h-4 w-4" />
                  جستجو کن
                </button>
              </form>
            </motion.div>
          </section>

          {/* ================= دسته‌بندی‌ها ================= */}
          {categories.length > 0 && (
          <section className="mb-16" aria-label="دسته‌بندی‌ها">
            <Stagger className="flex items-center justify-start md:justify-center overflow-x-auto gap-3 md:gap-4 pb-4 px-2 snap-x hide-scrollbar">
              {categories.slice(0, 8).map((cat) => {
                // آیکون از دیتابیس (ایموجی یا لینک عکس)؛ اگر خالی بود یک پین پیش‌فرض
                const iconDisplay = cat.icon || "📌";
                const isActive = selectedCategory === cat.id;
                return (
                  <StaggerItem key={cat.id} className="snap-center shrink-0">
                    <button
                      onClick={() => { setSelectedCategory(cat.id); fetchBusinesses(1); }}
                      className={`flex flex-col items-center gap-3 p-4 w-[104px] group cursor-pointer rounded-3xl border transition-all duration-300 hover:-translate-y-1.5 active:scale-95 ${isActive ? "bg-brand-800 border-brand-800 shadow-xl shadow-brand-900/20" : "bg-white border-cream-200 shadow-sm hover:shadow-xl hover:shadow-saffron-500/15 hover:border-saffron-200"}`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 group-hover:rotate-[-6deg] ${isActive ? "bg-cream/10" : "bg-cream group-hover:bg-saffron-100"}`}>
                        {iconDisplay.startsWith('http') || iconDisplay.startsWith('/') ? (
                          <img src={iconDisplay} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <span aria-hidden="true">{iconDisplay}</span>
                        )}
                      </div>
                      <span className={`text-xs font-bold transition text-center truncate w-full ${isActive ? "text-cream" : "text-brand-700 group-hover:text-saffron-700"}`}>
                        {cat.name}
                      </span>
                    </button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </section>
          )}

          {promotionalBanners.length > 0 && (
            <Reveal className="w-full mb-16 rounded-[1.75rem] overflow-hidden shadow-xl shadow-brand-900/10 ring-1 ring-cream-200">
              <Swiper modules={[Autoplay, Pagination]} autoplay={{ delay: 5000 }} pagination={{ clickable: true }} className="w-full h-32 md:h-48">
                {promotionalBanners.map((banner: any) => (
                  <SwiperSlide key={banner.id}>
                    <a href={banner.url || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                      <img src={mediaUrl(banner.image)} alt={banner.title} className="w-full h-full object-cover" />
                    </a>
                  </SwiperSlide>
                ))}
              </Swiper>
            </Reveal>
          )}

          {/* ================= تخفیف‌های داغ ================= */}
          {loading ? (
            <div className="mb-16">
              <div className="flex justify-between items-end mb-6 px-2">
                <div>
                  <div className="h-8 w-48 bg-cream-200 rounded-xl mb-3 animate-pulse"></div>
                  <div className="h-4 w-32 bg-cream-200 rounded-lg animate-pulse"></div>
                </div>
              </div>
              <div className="flex gap-5 overflow-hidden px-2 pb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={`skeleton-hot-${i}`} className="min-w-[280px] w-full md:w-1/3 lg:w-1/4 bg-cream-100 rounded-[2rem] p-6 border border-cream-200 h-[180px] animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : hotDeals.length > 0 && (
            <Reveal as="section" className="mb-16">
              <div className="flex justify-between items-end mb-4 px-2">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-brand-900 flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-saffron-500 text-brand-950 shadow-lg shadow-saffron-500/30">
                      <Flame className="h-5 w-5" />
                    </span>
                    تخفیف‌های داغ امروز
                  </h2>
                  <p className="text-brand-500 text-sm mt-2 font-medium">بهترین پیشنهادات با زمان محدود</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <button type="button" aria-label="پیشنهاد قبلی" className="hot-deals-prev flex h-11 w-11 items-center justify-center rounded-xl border border-cream-200 bg-white text-brand-700 shadow-sm transition-all hover:bg-brand-800 hover:text-cream disabled:opacity-40">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="پیشنهاد بعدی" className="hot-deals-next flex h-11 w-11 items-center justify-center rounded-xl border border-cream-200 bg-white text-brand-700 shadow-sm transition-all hover:bg-brand-800 hover:text-cream disabled:opacity-40">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <Swiper
                modules={[Autoplay, Navigation]}
                spaceBetween={20}
                slidesPerView={1.15}
                breakpoints={{ 640: { slidesPerView: 2.2 }, 1024: { slidesPerView: 3.4 } }}
                speed={800}
                grabCursor
                loop={hotDeals.length > 6}
                rewind={hotDeals.length <= 6}
                autoplay={{ delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                navigation={{ prevEl: ".hot-deals-prev", nextEl: ".hot-deals-next" }}
                className="!pb-14 !pt-6 !px-4 -mx-4"
              >
                {hotDeals.map((business) => (
                  <SwiperSlide key={`hot-${business.id}`}>
                    <Link
                      href={`/business/${business.slug}`}
                      className="group relative block overflow-hidden rounded-[2rem] border border-saffron-200/70 bg-gradient-to-br from-saffron-50 via-cream to-white p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-saffron-500/25"
                    >
                      <span className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-saffron-200/40 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                      <div className="relative flex items-center gap-4 mb-5">
                        {business.logo ? (
                          <img src={business.logo} alt={business.name} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-saffron-700 font-black text-xl shadow-sm">
                            {business.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-brand-900 line-clamp-1">{business.name}</h3>
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-saffron-500 px-2.5 py-1 text-xs font-black text-brand-950 shadow-sm">
                            <Ticket className="h-3.5 w-3.5" />
                            {business.active_campaign?.title || "پیشنهاد ویژه"}
                          </span>
                        </div>
                      </div>

                      <div className="relative bg-white rounded-2xl p-3.5 flex justify-between items-center shadow-sm ring-1 ring-cream-200">
                        <span className="text-sm font-bold text-brand-500 mr-2">دریافت کد تخفیف</span>
                        <span className="inline-flex items-center gap-1 bg-brand-800 text-cream text-sm font-bold px-4 py-2 rounded-xl transition-colors group-hover:bg-saffron-500 group-hover:text-brand-950">
                          مشاهده
                          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                        </span>
                      </div>
                    </Link>
                  </SwiperSlide>
                ))}
              </Swiper>
            </Reveal>
          )}

          {/* ================= کسب‌وکارها + سایدبار ================= */}
          <div className="flex flex-col lg:flex-row gap-8 mb-20">
            <section className="flex-1 w-full min-w-0" aria-labelledby="latest-title">
              <Reveal className="flex justify-between items-center mb-8">
                <h2 id="latest-title" className="scroll-mt-28 text-2xl md:text-3xl font-black text-brand-900 tracking-tight">
                  جدیدترین <span className="text-saffron-600">کسب‌وکارها</span>
                </h2>
              </Reveal>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-3xl p-5 border border-cream-200 shadow-sm animate-pulse h-64 flex flex-col justify-between">
                      <div className="flex gap-4 mb-4">
                        <div className="w-14 h-14 bg-cream-200 rounded-2xl"></div>
                        <div className="flex-1 py-1"><div className="h-4 bg-cream-200 rounded w-3/4 mb-2"></div><div className="h-3 bg-cream-200 rounded w-1/2"></div></div>
                      </div>
                      <div className="space-y-2"><div className="h-3 bg-cream-200 rounded w-full"></div><div className="h-3 bg-cream-200 rounded w-5/6"></div></div>
                      <div className="border-t border-cream-200 pt-4 mt-4 flex justify-between"><div className="h-4 bg-cream-200 rounded w-1/3"></div><div className="h-4 bg-cream-200 rounded w-1/4"></div></div>
                    </div>
                  ))}
                </div>
              ) : businesses.length === 0 ? (
                <Reveal className="text-center bg-white p-12 rounded-3xl shadow-sm border border-cream-200">
                  <SearchX className="mx-auto mb-4 h-12 w-12 text-brand-300" />
                  <h3 className="text-lg font-bold text-brand-800 mb-2">نتیجه‌ای یافت نشد!</h3>
                  <p className="text-sm text-brand-500">هیچ کسب‌وکاری با مشخصات مورد نظر شما ثبت نشده است.</p>
                </Reveal>
              ) : (
                <Stagger key={currentPage} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businesses.map((business) => (
                    <StaggerItem key={business.id} className="h-full">
                      <Link
                        href={`/business/${business.slug}`}
                        className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-cream-200 bg-white p-5 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-saffron-200 hover:shadow-2xl hover:shadow-brand-900/10"
                      >
                        {/* نوار رنگی بالای کارت در حالت هاور */}
                        <span className="absolute inset-x-0 top-0 h-1 origin-right scale-x-0 bg-gradient-to-l from-saffron-500 to-brand-700 transition-transform duration-500 group-hover:scale-x-100" />

                        <div>
                          <div className="mb-5 flex items-start gap-3">
                            {business.logo ? (
                              <img src={business.logo} alt={business.name} className="w-14 h-14 shrink-0 rounded-2xl object-cover ring-1 ring-cream-200 shadow-sm transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                              <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-brand-50 to-cream border border-brand-100 flex items-center justify-center text-brand-700 font-black text-xl">
                                {business.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h3 className="flex items-center gap-1 text-base font-bold text-brand-900 transition-colors group-hover:text-saffron-700">
                                <span className="line-clamp-1">{business.name}</span>
                                {business.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-500" aria-label="تأییدشده" />}
                              </h3>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="inline-block rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600">
                                  {business.category?.name || "عمومی"}
                                </span>
                                {business.active_campaign && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-saffron-500 px-2 py-1 text-[11px] font-black text-brand-950">
                                    <Flame className="h-3 w-3" />
                                    {business.active_campaign?.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="text-brand-600/90 text-sm mb-4 line-clamp-2 leading-7">
                            {business.description}
                          </p>
                        </div>

                        <div className="flex justify-between items-center text-xs font-semibold text-brand-500 border-t border-cream-200 pt-4 mt-auto">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-saffron-600" /> {business.location?.name || "نامشخص"}
                          </span>
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-lg ring-1 ring-amber-100">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {business.average_rating}
                            <span className="text-amber-600/70">({business.review_count})</span>
                          </span>
                        </div>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}

              {/* صفحه‌بندی */}
              {!loading && businesses.length > 0 && (
                <nav className="flex justify-center items-center gap-4 mt-14 mb-8" aria-label="صفحه‌بندی">
                  <button
                    onClick={() => fetchBusinesses(currentPage - 1)} disabled={!hasPrev}
                    aria-label="صفحه‌ی قبل"
                    className="w-11 h-11 flex items-center justify-center bg-white border border-cream-200 rounded-xl text-brand-700 shadow-sm transition-all hover:border-brand-200 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="text-brand-700 font-bold text-sm bg-white px-5 py-2.5 rounded-xl shadow-sm border border-cream-200">
                    صفحه {currentPage} از {totalPages}
                  </span>
                  <button
                    onClick={() => fetchBusinesses(currentPage + 1)} disabled={!hasNext}
                    aria-label="صفحه‌ی بعد"
                    className="w-11 h-11 flex items-center justify-center bg-brand-800 text-cream rounded-xl shadow-md shadow-brand-900/20 transition-all hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </nav>
              )}
            </section>

            {/* سایدبار */}
            {sidebarBanners.length > 0 && (
              <aside className="w-full lg:w-1/4 lg:max-w-[300px] shrink-0">
                <Reveal className="sticky top-28">
                  <Swiper modules={[Autoplay, Pagination]} autoplay={{ delay: 3500 }} pagination={{ clickable: true }} className="w-full rounded-[2rem] overflow-hidden shadow-xl shadow-brand-900/10 ring-1 ring-cream-200">
                    {sidebarBanners.map((banner: any) => (
                      <SwiperSlide key={banner.id}>
                        <a href={banner.url || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-auto relative group">
                          <div className="absolute inset-0 bg-brand-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                          <img src={mediaUrl(banner.image)} alt={banner.title} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700" />
                        </a>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </Reveal>
              </aside>
            )}
          </div>
        </main>
      </div>

      {/* ================= مودال استوری ================= */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            key="story-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-brand-950/95 backdrop-blur-xl flex flex-col items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={`استوری ${selectedStory.business_name}`}
          >
            <div className="absolute top-0 left-0 right-0 z-50 w-full max-w-md mx-auto pt-4 px-4 flex flex-col gap-3">
              <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden">
                <motion.div
                  key={selectedStory.id}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-saffron-400"
                />
              </div>

              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cream p-0.5">
                    {selectedStory.business_logo ? (
                      <img src={selectedStory.business_logo} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold">{selectedStory.business_name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <Link href={`/business/${selectedStory.business_slug}`} className="text-white font-bold text-sm hover:underline drop-shadow-md">
                      {selectedStory.business_name}
                    </Link>
                    <span className="text-white/70 text-[10px]">تازه‌ها</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStory(null)}
                  aria-label="بستن استوری"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <motion.div
              key={`media-${selectedStory.id}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full h-full max-w-md md:h-[85vh] md:aspect-[9/16] bg-brand-900 md:rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center"
            >
              <img src={selectedStory.media} alt="استوری" className="w-full h-full object-contain" />

              {selectedStory.link && (
                <div className="absolute bottom-12 left-0 right-0 flex justify-center pb-safe">
                  <a
                    href={selectedStory.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-saffron-500 px-6 py-3 text-sm font-black text-brand-950 shadow-lg transition-transform hover:scale-105"
                  >
                    <ExternalLink className="h-4 w-4" />
                    مشاهده لینک
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= فوتر ================= */}
      <SiteFooter />
    </div>
  );
}
