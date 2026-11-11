// مسیر داشبورد هر نقش (مشترک بین proxy، صفحه‌ی ورود/ثبت‌نام و layoutها)
export function dashboardPathFor(role?: string | null) {
  if (role === "ADMIN") return "/admin-panel";
  if (role === "BUSINESS_OWNER") return "/dashboard/owner";
  return "/dashboard/client";
}
