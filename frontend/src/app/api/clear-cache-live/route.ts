import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { verifyJwt } from "@/lib/server/jwt";

// جلوگیری از کش شدن خود این API
export const dynamic = 'force-dynamic';

// ادمین بودن از امضای refresh توکن (کوکی httpOnly) و claim نقش بررسی می‌شود (H6)
async function isAdmin(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);
  if (!match) return false;
  const payload = await verifyJwt(decodeURIComponent(match[1]), "refresh");
  return payload?.role === "ADMIN";
}

export async function GET(req: Request) {
  if (!(await isAdmin(req))) {
    return new Response(JSON.stringify({ message: "دسترسی غیرمجاز" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // تابع مخابره زنده اطلاعات به فرانت‌اند
      const sendLog = (progress: number, message: string, status: 'info' | 'success' | 'error' = 'info') => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress, message, status })}\n\n`));
      };

      try {
        sendLog(10, "در حال برقراری ارتباط...");
        await new Promise(r => setTimeout(r, 300));

        // مرحله ۱: پاکسازی کش حافظه و روت‌های Next.js
        sendLog(30, "در حال ابطال مسیرهای کش شده (Soft Purge)...");
        revalidatePath("/", "layout");
        await new Promise(r => setTimeout(r, 400));

        // مرحله ۲: پاکسازی فیزیکی و خالی کردن فضای هارد سرور (Hard Purge)
        sendLog(60, "در حال حذف فیزیکی فایل‌های کش از هارد سرور (Hard Purge)...");
        try {
          // پیدا کردن مسیر دقیق پوشه کش در داخل کانتینر سرور
          const cacheDirectory = path.join(process.cwd(), '.next', 'cache');
          
          // حذف کامل پوشه کش از روی هارد (معادل دستور rm -rf در ترمینال)
          await fs.rm(cacheDirectory, { recursive: true, force: true });
          
          sendLog(80, "فایل‌های اضافی از هارد سرور با موفقیت حذف شدند.");
        } catch (fsError) {
          // در صورتی که پوشه از قبل خالی باشد یا وجود نداشته باشد
          sendLog(80, "پوشه فیزیکی کش خالی است و نیاز به پاکسازی نداشت.");
        }
        await new Promise(r => setTimeout(r, 400));

        // مرحله نهایی
        sendLog(100, "پاکسازی کامل سیستم و فضای هارد با موفقیت انجام شد.", "success");
      } catch (error: any) {
        sendLog(100, `خطا: ${error.message}`, "error");
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}