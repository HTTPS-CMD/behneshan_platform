import { api } from "@/lib/api";

/**
 * داده‌ی عمومی CMS (منوها، بنرها، تنظیمات).
 * صفحه‌ی اصلی و منوی موبایل هر دو به آن نیاز دارند؛ با این تابع فقط یک درخواست زده می‌شود.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cmsPromise: Promise<any> | null = null;

export function getCmsData() {
  if (!cmsPromise) {
    cmsPromise = api
      .get("/cms/data/")
      .then((res) => res.data)
      .catch((err) => {
        cmsPromise = null; // در صورت خطا، دفعه‌ی بعد دوباره تلاش می‌شود
        throw err;
      });
  }
  return cmsPromise;
}
