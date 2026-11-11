/**
 * انتقال نرم بین صفحه‌ها (با هر تغییر مسیر دوباره اجرا می‌شود).
 * با انیمیشن CSS و fill-mode: backwards؛ بعد از پایان انیمیشن هیچ transform‌ای روی این div نمی‌ماند.
 * (transform روی والد باعث می‌شد عناصر position: fixed مثل منوی پایین موبایل و سایدبار پنل
 *  به‌جای صفحه‌ی نمایش، نسبت به این div جای‌گیری شوند و از دید خارج شوند.)
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
