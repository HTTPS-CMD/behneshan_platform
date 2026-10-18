import type { Metadata } from "next";
import "./globals.css";
import PageViewTracker from "@/components/PageViewTracker";

export const metadata: Metadata = {
  title: "چهارسوق",
  description: "اولین پلترفم جامع کسب و کار",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      {/* این ویژگی را حتماً به بادی اضافه کنید */}
      <body suppressHydrationWarning className="...">
        {children}
        <PageViewTracker />
      </body>
    </html>
  );
}
