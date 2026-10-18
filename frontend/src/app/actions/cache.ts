"use server";

import { revalidatePath } from "next/cache";

export async function clearSiteCache() {
  try {
    // پاک کردن کش کل سایت (همه صفحات)
    revalidatePath("/", "layout");
    return { success: true, message: "کش سایت با موفقیت پاک شد و تغییرات اعمال شد." };
  } catch (error) {
    return { success: false, message: "خطا در پاکسازی کش." };
  }
}