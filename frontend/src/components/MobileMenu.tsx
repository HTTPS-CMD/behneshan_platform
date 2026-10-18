"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Info, HelpCircle, Send, LayoutGrid, Layers, Headset, Megaphone } from "lucide-react";
import { api } from "@/lib/api";

// تبدیل نام متنی آیکون به کامپوننت ریکت
const iconComponents: Record<string, any> = {
  Home: Home,
  Info: Info,
  HelpCircle: HelpCircle,
  Send: Send,
  LayoutGrid: LayoutGrid,
  Layers: Layers,
  Headset: Headset,
  Megaphone: Megaphone,
};


export default function MobileMenu() {
  const [menuItems, setMenuItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchMobileMenus = async () => {
      try {
        const response = await api.get(
          "http://127.0.0.1:8000/api/v1/cms/data/",
        );
        const mobileLinks = response.data.menus.filter(
          (m: any) => m.position === "mobile",
        );
        setMenuItems(mobileLinks);
      } catch (error) {
        console.error("خطا در دریافت منوی موبایل", error);
      }
    };

    fetchMobileMenus();
  }, []);

  if (menuItems.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-50">
      {/* تغییر پس‌زمینه به سفید شیشه‌ای با سایه قوی‌تر */}
      <nav className="bg-white/90 backdrop-blur-xl border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-6 py-3 flex justify-between items-center">
        {menuItems
          .sort((a: any, b: any) => a.order - b.order)
          .map((menuItem: any) => {
            const cleanIconName = menuItem.icon ? menuItem.icon.trim() : "";
            const RenderIcon = iconComponents[cleanIconName] || HelpCircle;

            return (
              <Link key={menuItem.id} href={menuItem.url} className="flex flex-col items-center gap-1 group">
                {/* تغییر رنگ آیکون به خاکستری و تغییر به سبز هنگام کلیک/هاور */}
                <RenderIcon className="w-6 h-6 text-gray-500 group-hover:text-emerald-600 transition-colors" />
                {/* تغییر رنگ متن */}
                <span className="text-[11px] font-bold text-gray-600 group-hover:text-emerald-600 transition-colors">
                  {menuItem.title}
                </span>
              </Link>
            );
          })}
      </nav>
    </div>
  );
}