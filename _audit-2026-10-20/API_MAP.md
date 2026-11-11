# نقشه‌ی APIهای استفاده‌شده در فرانت

پایه‌ی همه‌ی مسیرها: `/api/v1` (در `lib/api.ts` → `NEXT_PUBLIC_API_URL`)
راهنمای ستون دسترسی: 🌐 عمومی · 🔑 کاربر لاگین‌شده · 🏪 صاحب کسب‌وکار (role) · 🛡️ ادمین (`is_staff`)

## Identity — احراز هویت و پروفایل
| متد | مسیر | دسترسی | جاهایی که در فرانت استفاده شده | نکته |
|---|---|---|---|---|
| POST | `/identity/request-otp/` | 🌐 | `login/page.tsx`، `register/page.tsx` | ⚠️ آدرس هاردکد شده `127.0.0.1` |
| POST | `/identity/verify-otp/` | 🌐 | `login`، `register` | ⚠️ هاردکد · محدودیت تلاش ندارد (SECURITY H2) |
| POST | `/identity/token/refresh/` | 🌐 | `lib/api.ts` (interceptor) | ⚠️ هاردکد، پس **رفرش توکن در production کار نمی‌کند** |
| GET/PATCH | `/identity/profile/` | 🔑 | `dashboard/owner/account` | |
| GET | `/identity/client/dashboard/` | 🔑 | `dashboard/client` | |
| GET | `/identity/client/referrals/` | 🔑 | `dashboard/client` | شماره‌ی کامل دوستان را برمی‌گرداند |
| GET/PATCH | `/identity/admin/users/` · `/{id}/` | 🛡️ | `admin-panel`، `api/clear-cache-live` (برای چک ادمین بودن) | |

## Directory — کسب‌وکار، کمپین، CRM
| متد | مسیر | دسترسی | جاهایی که در فرانت استفاده شده | نکته |
|---|---|---|---|---|
| GET | `/directory/businesses/` | 🌐 | `page.tsx` (خانه) | صفحه‌بندی ۹تایی · کسب‌وکارهای تأییدنشده هم نمایش داده می‌شوند |
| GET | `/directory/businesses/{slug}/` | 🌐 | `business/[slug]`، `owner/edit/[slug]` | ⚠️ `fields='__all__'`، پس phone_number، owner و followers نشت می‌کنند |
| PATCH | `/directory/businesses/{slug}/update/` | 🔑 + مالک | `owner/edit/[slug]` | |
| GET/POST | `/directory/businesses/{slug}/reviews/` | 🌐 / 🔑 | `business/[slug]`، `owner/reviews` | ⚠️ شماره‌ی کامل نظردهنده‌ها |
| POST | `/directory/businesses/{slug}/toggle-favorite/` | 🔑 | `client/favorites`، `owner/favorites` | |
| GET | `/directory/businesses/me/` | 🏪 | `dashboard/owner`، `owner/reviews` | ⚠️ در `owner/page.tsx` هاردکد شده |
| GET | `/directory/businesses/analytics/me/` | 🔑 | `dashboard/owner` | ❗ **داده‌ی ساختگی و ثابت** برمی‌گرداند |
| POST | `/directory/businesses/create/` | 🔑 | `dashboard/create` | ⚠️ هاردکد |
| POST | `/directory/reviews/{uuid}/reply/` | 🏪 | `owner/reviews` | |
| GET | `/directory/campaigns/validate/?code=` | 🌐 | `register` | |
| CRUD | `/directory/owner/campaigns/` · `/{id}/usages/` | 🔑 | `owner/campaigns` | |
| POST | `/directory/owner/redeem/{id}/` | 🔑 | `owner/campaigns` | |
| GET | `/directory/owner/analytics/` | 🔑 | `owner/analytics` | `views_count` هیچ‌جا افزایش پیدا نمی‌کند، پس همیشه ۰ است |
| POST | `/directory/owner/crm/verify-discount/` | 🏪 | `owner/crm` | ⚠️ اطلاعات هر شماره‌ای را برمی‌گرداند (SECURITY H4) |
| POST | `/directory/owner/crm/record-transaction/` | 🏪 | `owner/crm` | ⚠️ بدون تأیید مشتری |
| GET | `/directory/owner/crm/customers/` | 🏪 | `owner/customers` | صفحه‌بندی ندارد |
| CRUD | `/directory/owner/products/` | 🏪 | `owner/products` | |
| GET/POST | `/directory/owner/requests/` | 🏪 | `owner/requests` | |
| GET/POST/DELETE | `/directory/owner/stories/` · `/{id}/` | 🔑 | `owner/stories` | |
| GET | `/directory/public/stories/active/` | 🌐 | `page.tsx` | |
| GET | `/directory/daily-discounts/` | 🌐 | `daily-discounts`، `owner/daily-discounts` | این دو صفحه تقریباً کپی هم هستند |
| GET | `/directory/client/vip/status/` | 🔑 | `dashboard/client` | |
| GET | `/directory/client/recent-visits/` | 🔑 | `dashboard/client` | |
| GET | `/directory/client/campaigns/` | 🔑 | `dashboard/client` | |
| POST | `/directory/client/campaigns/claim/` | 🔑 | `business/[slug]` | |
| GET | `/directory/client/subscription/plans/` | 🌐 | `client/vip` | |
| POST | `/directory/client/subscription/purchase/` | 🔑 | `client/vip` | فعلاً 503 برمی‌گرداند و منتظر درگاه پرداخت است |
| GET | `/directory/content/{page}/` | 🌐 | `about`، `contact`، `terms/*`، `admin-panel/content` | |
| PUT | `/directory/admin/content/{page}/` | 🛡️ | `admin-panel/content` | |
| GET | `/directory/admin/businesses/` | 🛡️ | `admin-panel` | |
| PATCH | `/directory/admin/businesses/{uuid}/verify/` | 🛡️ | `admin-panel` | |
| DELETE | `/directory/admin/businesses/{uuid}/` | 🛡️ | `admin-panel` | ✅ endpoint اضافه شده |
| GET/POST/PATCH | `/directory/admin/subscription-plans/` · `/{id}/` | 🛡️ | `admin-panel` | |
| GET | `/directory/admin/transactions/` | 🛡️ | `admin-panel` | صفحه‌بندی ندارد |
| GET/POST | `/directory/admin/toggle-demo-data/` | 🛡️ | `admin-panel` | (SECURITY M6) |

## Taxonomy · CMS · Analytics
| متد | مسیر | دسترسی | جاهایی که در فرانت استفاده شده | نکته |
|---|---|---|---|---|
| GET | `/taxonomy/categories/` · `/taxonomy/locations/` | 🌐 | `page.tsx`، `dashboard/create`، `owner/edit` | ⚠️ در `create` هاردکد شده |
| CRUD | `/taxonomy/admin/categories/` · `/admin/locations/` | 🛡️ | `admin-panel` | |
| GET | `/cms/data/` | 🌐 | `page.tsx`، `MobileMenu.tsx` | ⚠️ هاردکد · در هر دو جا جداگانه fetch می‌شود |
| CRUD | `/cms/admin/menus/` · `/settings/` · `/banners/` | 🛡️ | `admin-panel/*` | |
| POST | `/analytics/record-view/` | 🌐 | `PageViewTracker.tsx` | ⚠️ هاردکد · بدون محدودیت (SECURITY M4) |
| GET | `/analytics/dashboard-stats/` | 🛡️ | `admin-panel/analytics` | ⚠️ هاردکد · با `fetch` خام صدا زده می‌شود، نه با `api` |

## Route Handlerهای خود Next.js
| مسیر | کاربرد | نکته |
|---|---|---|
| `GET /api/clear-cache-live` | پاکسازی کش با SSE برای دکمه‌ی ادمین | ✅ ادمین بودن را از بک‌اند چک می‌کند |
| `POST /api/revalidate` | جنگو بعد از تغییرات این را صدا می‌زند | secret ضعیف است (SECURITY H5, L3) |

## Endpointهای بک‌اندی که فرانت از آن‌ها استفاده نمی‌کند
| مسیر | پیشنهاد |
|---|---|
| `GET /directory/rankings/` | برای بخش «برترین کاسبان» در خانه، که در طراحی جدید هم پیش‌بینی شده |
| `GET /directory/owner/sales-summary/` | برای کارت‌های فروش روزانه، ماهانه و سالانه در داشبورد صاحب کسب‌وکار |
| `GET/PATCH /directory/owner/business/` | با `businesses/{slug}/update` تکراری است. یکی را نگه دارید |

## آدرس‌های هاردکد `127.0.0.1:8000` (۲۱ مورد)
```
lib/api.ts:6, 38                       ← رفرش توکن
components/PageViewTracker.tsx:16
components/MobileMenu.tsx:28
app/page.tsx:96, 341, 481, 676         ← cms/data و تصاویر بنر
app/register/page.tsx:129, 165
app/login/page.tsx:45, 67
app/admin-panel/page.tsx:743
app/admin-panel/analytics/page.tsx:46
app/dashboard/owner/page.tsx:55, 58
app/dashboard/owner/stories/page.tsx:136
app/dashboard/create/page.tsx:33, 34, 68
app/api/clear-cache-live/route.ts:9    ← سمت سرور است و fallback آن مشکلی ندارد
```
**راه‌حل:** در این فایل‌ها `http://127.0.0.1:8000/api/v1` حذف شود تا `api` از baseURL استفاده کند. تصاویر با یک helper مثل `mediaUrl(path)` بر پایه‌ی `NEXT_PUBLIC_MEDIA_URL` ساخته شوند. در `api.ts` هم رفرش به این شکل نوشته شود: `axios.post(\`${api.defaults.baseURL}/identity/token/refresh/\`)`.

## الگوهای تکراری در کد فرانت
- در بیشتر صفحه‌ها `headers: { Authorization: \`Bearer ${token}\` }` دستی ست شده، در حالی که interceptor در `api.ts` همین کار را انجام می‌دهد. این خط‌ها را می‌شود حذف کرد.
- در ۱۶ فایل از `alert()` استفاده شده. باید با toast جایگزین شود (نمونه‌اش در پروتوتایپ طراحی هست).
- کش و هماهنگی داده وجود ندارد. با TanStack Query درخواست‌های تکراری (مثلاً `cms/data`) یک بار انجام می‌شوند.
