# گزارش امنیتی چهارسوق (behneshan_platform)

تاریخ بررسی: ۲۸ مهر ۱۴۰۵ (20 Oct 2026) — نسخه‌ی کد: همان نسخه‌ی موجود در فولدر لوکال

> این فایل جزئیات آسیب‌پذیری‌ها را دارد. **آن را در مخزن عمومی push نکنید.**

## روش بررسی

| ابزار / روش | محدوده | نتیجه |
|---|---|---|
| `ruff --select S` (قوانین Bandit برای پایتون) | کل `backend/` | هیچ مورد خودکاری پیدا نشد (الگوهایی مثل `eval`، `pickle`، `shell=True`، SQL خام در کد نیست) |
| اسکن regex برای کلید و رمز (به سبک gitleaks) | کل پروژه به‌جز `node_modules` | ۳ مورد (بخش H5) |
| بررسی نسخه‌ی پکیج‌ها از `package-lock.json` در دیتابیس‌های CVE | ۷۴۲ پکیج npm | Next.js آسیب‌پذیر است (H1). axios 1.18.1 سالم است |
| بازبینی دستی کد | تمام viewها، serializerها، permissionها، settings، proxy، API routeهای Next | بیشتر یافته‌ها از اینجا آمده |

خود Bandit، Semgrep و `npm audit` در محیط اسکن نصب نشدند، چون شبکه اجازه‌ی دسترسی به PyPI و npm را نداد. برای همین Bandit با قوانین معادلش در ruff اجرا شد و CVEهای npm هم دستی بررسی شدند. پیشنهاد می‌شود روی سیستم خودتان این‌ها را هم اجرا کنید:
```bash
cd backend && pip install bandit pip-audit && bandit -r . -x ./venv && pip-audit
cd frontend && npm audit --omit=dev
```

## خلاصه

| شدت | تعداد |
|---|---|
| 🔴 بحرانی / بالا | ۶ |
| 🟠 متوسط | ۸ |
| 🟡 پایین | ۷ |

### ✅ مواردی که نسبت به بررسی قبلی درست شده‌اند
کلیدها به `.env` منتقل شده‌اند. `DEBUG` به‌طور پیش‌فرض False است و `ALLOWED_HOSTS` از env خوانده می‌شود. نقش هنگام ثبت‌نام به CLIENT و BUSINESS_OWNER محدود شده است. OTP با `secrets` ساخته می‌شود و cooldown و محدودیت IP دارد. خرید VIP بدون پرداخت بسته شده است. مشکل mass-assignment در `owner/business` با `BusinessUpdateSerializer` حل شده. فایل‌های آپلودی اعتبارسنجی می‌شوند. ClaimCampaign قفل `select_for_update` دارد و مبالغ با Decimal حساب می‌شوند. `proxy.ts` حالا داخل `src/` است، `clear-cache-live` احراز هویت دارد، اعتبار توکن دسترسی ۶۰ دقیقه شده و تنظیمات کش Redis درست شده است.

---

## 🔴 بحرانی / بالا

### H1. نسخه‌ی Next.js (16.2.10) نُه آسیب‌پذیری شناخته‌شده دارد
- **فایل:** `frontend/package.json` → `"next": "16.2.10"`
- **مهم‌ترین مورد، CVE-2026-64642:** در پروژه‌هایی که App Router و **Turbopack** دارند، می‌شود Middleware/Proxy را دور زد. پروژه‌ی شما دقیقاً همین ترکیب را دارد (`turbopack` در `next.config.ts`)، پس محافظت `/admin-panel` و `/dashboard` در `proxy.ts` قابل دور زدن است.
- موارد دیگر: SSRF و open redirect در rewriteها (CVE-2026-64645)، DoS از طریق Server Actions (CVE-2026-64641)، cache confusion (CVE-2026-64647 و 64648) و چند مورد دیگر.
- **راه‌حل:** `npm i next@^16.2.11 eslint-config-next@^16.2.11`، بعد build و تست. محافظت اصلی باید همیشه در بک‌اند باشد (که فعلاً هست). proxy فقط لایه‌ی UX است.

### H2. می‌شود کد OTP را حدس زد و وارد حساب هر کسی شد
- **فایل:** `backend/apps/identity/views.py` → کلاس `VerifyOTPView`
- ثابت `OTP_MAX_VERIFY_ATTEMPTS = 5` تعریف شده اما **هیچ‌جا استفاده نمی‌شود**، پس تعداد تلاش برای وارد کردن کد نامحدود است.
- محدودیت نرخ هم قابل دور زدن است. چون `NUM_PROXIES` در DRF تنظیم نشده، `AnonRateThrottle` IP را مستقیم از هدر `X-Forwarded-For` می‌خواند، و `ipware` هم همین کار را می‌کند. مهاجم در هر درخواست یک IP جعلی در این هدر می‌گذارد و throttle و `OTP_IP_LIMIT_PER_HOUR` بی‌اثر می‌شوند.
- **نتیجه:** با حدود ۹۰۰ هزار حالت ممکن و درخواست‌های موازی، کد ۶ رقمی در همان ۲ دقیقه‌ی اعتبارش قابل حدس است، و مهاجم با داشتن فقط شماره‌ی موبایل قربانی وارد حساب او می‌شود.
- **راه‌حل:**
```python
# VerifyOTPView.post — قبل از مقایسه
attempts_key = f"otp_attempts_{phone_number}"
if _hit_limit(attempts_key, OTP_MAX_VERIFY_ATTEMPTS, OTP_TTL_SECONDS):
    cache.delete(f"otp_data_{phone_number}")   # کد را باطل کن
    return Response({"error": "تلاش بیش از حد. کد جدید بگیرید."}, status=429)
if not cached_data or not secrets.compare_digest(str(cached_data['otp']), str(user_otp)):
    ...
```
```python
# settings.py
REST_FRAMEWORK['NUM_PROXIES'] = 1        # اگر دقیقاً یک Nginx جلوی جنگو است
# و در nginx:  proxy_set_header X-Forwarded-For $remote_addr;  (نه $proxy_add_x_forwarded_for)
```
یک throttle جدا با scope مخصوص OTP هم اضافه کنید، مثلاً `ScopedRateThrottle` با نرخ `5/min`.

### H3. شماره‌ی موبایل کاربران و اطلاعات خصوصی به‌صورت عمومی نشت می‌کند
- `GET /api/v1/directory/businesses/<slug>/reviews/` بدون نیاز به لاگین در دسترس است و فیلد **`user_phone`** یعنی شماره‌ی کامل هر کسی را که نظر داده برمی‌گرداند (`ReviewSerializer`).
- `GET /api/v1/directory/businesses/<slug>/` از `BusinessSerializer` با `fields='__all__'` استفاده می‌کند. در نتیجه **`phone_number`** (شماره‌ی خصوصی، جدا از `public_phone`)، **`owner`** (شناسه‌ی کاربر صاحب کسب‌وکار) و **`followers`** (لیست شناسه‌ی همه‌ی دنبال‌کنندگان) عمومی هستند.
- **راه‌حل:** یک `BusinessPublicSerializer` با لیست صریح فیلدها بسازید و برای بخش‌های ادمین و صاحب کسب‌وکار serializer جدا داشته باشید. در `ReviewSerializer` به‌جای `user_phone` نام کاربر یا شماره‌ی ماسک‌شده را برگردانید (`0912***4567`).

### H4. هر صاحب کسب‌وکاری می‌تواند اطلاعات همه‌ی کاربران را استخراج کند و برایشان تراکنش جعلی ثبت کند
- ثبت‌نام به‌عنوان BUSINESS_OWNER آزاد است و هر کسی می‌تواند. حساب BUSINESS_OWNER بعد از آن:
  - با `POST /owner/crm/verify-discount/` و ارسال **هر شماره‌ای** نام کامل صاحب شماره، وضعیت VIP و تخفیف‌هایش را می‌گیرد. این یعنی شمارش کاربران سایت و نشت اطلاعات شخصی.
  - با `POST /owner/crm/record-transaction/` برای **هر شماره‌ای** بدون رضایت صاحبش تراکنش ثبت می‌کند و کد کمپین او را «می‌سوزاند».
- **راه‌حل:** تأیید از سمت مشتری اضافه شود: مشتری یک کد یک‌بارمصرف یا QR از پنل خودش نشان می‌دهد، یا یک OTP کوتاه به او پیامک می‌شود. این endpointها فقط برای کسب‌وکارهای `is_verified=True` فعال شوند و rate-limit بگیرند. نام مشتری هم ماسک شود.

### H5. کلید و رمز در فایل‌هایی که commit می‌شوند
| فایل | مشکل |
|---|---|
| `backend/.env.example` | یک `SECRET_KEY` واقعی (۶۷ کاراکتری) در آن هست. اگر همین مقدار روی سرور استفاده شده باشد، **باید عوض شود**. در فایل example فقط placeholder بگذارید |
| `frontend/.env.local` | `REVALIDATION_SECRET` یک عبارت قابل‌حدس است (نام سایت + سال). مقدار تصادفی ۳۲ بایتی بگذارید: `python -c "import secrets;print(secrets.token_urlsafe(32))"` |
| `backend/docker-compose.yml` | رمز دیتابیس `securepassword123` مستقیم در فایل نوشته شده. پورت‌های **5432 و 6379 روی همه‌ی اینترفیس‌ها باز هستند** و Redis رمز ندارد. اگر روی سرور از این فایل استفاده شود، دیتابیس و Redis (که کدهای OTP را نگه می‌دارد) از بیرون قابل دسترسی‌اند |

**راه‌حل compose:** `ports: ["127.0.0.1:5432:5432"]`، رمز را از `env_file` بخوانید و `command: redis-server --requirepass ${REDIS_PASSWORD}` اضافه کنید.

### H6. توکن‌ها در کوکی‌هایی ذخیره می‌شوند که جاوااسکریپت می‌تواند بخواند
- `useAuthStore.ts` و `api.ts`: `access_token` و `refresh_token` با `js-cookie` ست می‌شوند و httpOnly نیستند. یک XSS در هر جای سایت (یا یک پکیج npm آلوده) کافی است تا refresh توکن ۷ روزه دزدیده شود.
- هنگام رفرش (`api.ts` خط ۴۷) کوکی جدید **بدون `secure` و `sameSite`** ست می‌شود.
- `ROTATE_REFRESH_TOKENS` و blacklist فعال نیستند، پس خروج از حساب در سرور هیچ توکنی را باطل نمی‌کند.
- **راه‌حل (مرحله‌ای):**
  1. فوری: `SIMPLE_JWT['ROTATE_REFRESH_TOKENS']=True` و `BLACKLIST_AFTER_ROTATION=True` و اپ `rest_framework_simplejwt.token_blacklist`، به‌همراه endpoint خروج که refresh را blacklist کند.
  2. میان‌مدت: لاگین و رفرش از طریق یک Route Handler در Next (BFF) انجام شود تا refresh در کوکی `httpOnly; Secure; SameSite=Lax` بماند و فقط access کوتاه‌عمر در حافظه نگه داشته شود.

---

## 🟠 متوسط

### M1. SSL و تنظیمات امنیتی production وجود ندارد
- هنوز SSL ندارید، پس کد OTP، کد ملی و توکن‌ها **به‌صورت متن ساده** روی شبکه منتقل می‌شوند.
- این تنظیمات در `settings.py` نیستند: `SECURE_PROXY_SSL_HEADER`، `SECURE_SSL_REDIRECT`، `SESSION_COOKIE_SECURE`، `CSRF_COOKIE_SECURE`، `SECURE_HSTS_SECONDS`، `SECURE_CONTENT_TYPE_NOSNIFF`.
- `next.config.ts` هیچ هدر امنیتی ندارد (CSP، `X-Frame-Options`، `Referrer-Policy`، `Permissions-Policy`).
- **راه‌حل:** گواهی Let's Encrypt از داخل ایران ممکن است کار نکند، چون سرور فقط به اینترنت داخلی دسترسی دارد. می‌توانید گواهی را روی سیستم خودتان با DNS-challenge بگیرید و روی سرور کپی کنید، یا از گواهی‌دهنده‌ی داخلی استفاده کنید. بعد از آن:
```ts
// next.config.ts
async headers() { return [{ source: "/(.*)", headers: [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
]}]; }
```

### M2. آدرس `127.0.0.1:8000` در ۲۱ جای فرانت هاردکد شده است
روی سایت واقعی، مرورگر کاربر به **کامپیوتر خود کاربر** درخواست می‌دهد. مهم‌ترین اثرش این است که **رفرش توکن در production کار نمی‌کند** (`api.ts` خط ۳۸): هر بار که access توکن ۶۰ دقیقه‌ای منقضی شود، کاربر از حساب خارج می‌شود. بعد از فعال شدن SSL هم خطای mixed-content پیش می‌آید.
فهرست کامل این موارد در فایل `API_MAP.md` آمده است. همه باید از `NEXT_PUBLIC_API_URL` و `NEXT_PUBLIC_MEDIA_URL` خوانده شوند.

### M3. نشت جزئیات خطای سرور
در `VerifyOTPView` و `AdminToggleDemoDataView` متن خطا با `str(e)` به کاربر برگردانده می‌شود و `traceback.print_exc()` هم اجرا می‌شود. باید `logger.exception(...)` به‌کار برود و پیام عمومی نشان داده شود.

### M4. ثبت بازدید (`/analytics/record-view/`) بدون محدودیت است
هر کسی بدون لاگین می‌تواند بی‌نهایت رکورد در دیتابیس بنویسد و IP را هم جعل کند (همان مشکل H2). اگر URL بلندتر از ۲۵۵ کاراکتر باشد، سرور خطای ۵۰۰ می‌دهد. این مسیر throttle جدا لازم دارد، URL باید به ۲۵۵ کاراکتر بریده شود، و بهتر است بازدیدها در Redis شمرده شوند و دوره‌ای در دیتابیس ذخیره شوند.

### M5. ساخت کسب‌وکار بدون محدودیت
`BusinessCreateView`: هر کاربری می‌تواند بی‌نهایت کسب‌وکار بسازد و نقشش خودکار به BUSINESS_OWNER ارتقا پیدا می‌کند. `slug` را هم خود کاربر انتخاب می‌کند. در `BusinessUpdateSerializer` صاحب کسب‌وکار می‌تواند **دسته‌ی پولی** (`Category.price`) را بدون پرداخت انتخاب کند. سقف تعداد کسب‌وکار برای هر کاربر، ساخت slug در سرور و قفل کردن تغییر دسته تا زمان پرداخت پیشنهاد می‌شود.

### M6. دکمه‌ی «حذف دیتای دمو» ممکن است کاربر واقعی را پاک کند
`User.objects.filter(phone_number__startswith='0999000').delete()`: پیش‌شماره‌ی 0999 در ایران واقعی است. فقط کاربرانی را پاک کنید که شماره‌شان دقیقاً در لیست `demo_items` آمده، یا یک فیلد `is_demo` اضافه کنید.

### M7. اعتبارسنجی کد معرف عمومی است
`GET /campaigns/validate/?code=` بدون لاگین کار می‌کند و نام و شناسه‌ی کسب‌وکار را برمی‌گرداند. برای جلوگیری از حدس زدن کدها throttle جدا اضافه کنید.

### M8. تعریف ادمین در فرانت و بک‌اند یکی نیست
بک‌اند ادمین را با `is_staff` (`IsAdminUser`) تشخیص می‌دهد و فرانت با `role === 'ADMIN'` از کوکی‌ای که کاربر می‌تواند دستکاری‌اش کند. permission `IsSuperAdminRole` هم تعریف شده اما هیچ‌جا استفاده نمی‌شود. یک منبع واحد انتخاب کنید (مثلاً `is_staff`) و نقش را از endpoint `/identity/profile/` بخوانید، نه از کوکی.

---

## 🟡 پایین

| # | مورد | فایل |
|---|---|---|
| L1 | فایل `frontend/middleware.ts` قدیمی هنوز کنار `src/proxy.ts` هست و باید حذف شود | `frontend/middleware.ts` |
| L2 | Server Action به اسم `clearSiteCache` بدون احراز هویت export شده است. فعلاً استفاده نمی‌شود، اما اگر جایی import شود همه می‌توانند صدایش بزنند. حذفش کنید | `app/actions/cache.ts` |
| L3 | در `/api/revalidate` مقایسه‌ی secret با `!==` انجام می‌شود (باید `timingSafeEqual` باشد) و `path` دلخواه پذیرفته می‌شود | `app/api/revalidate/route.ts` |
| L4 | لینک‌های `target="_blank"` بدون `rel="noopener noreferrer"` (وب‌سایت و اینستاگرام کسب‌وکار) | `business/[slug]/page.tsx:402,416` |
| L5 | لیست دعوت‌شدگان شماره‌ی کامل دوستان را برمی‌گرداند و باید ماسک شود | `identity/views.py → ClientReferralsView` |
| L6 | ویدئوی استوری فقط بر اساس پسوند فایل بررسی می‌شود. Nginx باید `/media` را با `nosniff` و `Content-Disposition` مناسب سرو کند | `directory/serializers.py` |
| L7 | پوشه‌ی `backend/media/` در `.gitignore` نیست و فایل‌های آپلودی کاربران ممکن است commit شوند | `.gitignore` |

---

## ترتیب پیشنهادی رفع
1. **امروز:** ارتقای Next به 16.2.11 (H1). محدودیت تلاش OTP و `NUM_PROXIES` (H2). عوض کردن `SECRET_KEY` و `REVALIDATION_SECRET` و بستن پورت‌های DB و Redis (H5).
2. **این هفته:** serializer عمومی و ماسک شماره‌ها (H3). تأیید مشتری در CRM (H4). rotation و blacklist توکن (H6). حذف `127.0.0.1` از فرانت (M2).
3. **قبل از تبلیغات سایت:** SSL و هدرهای امنیتی (M1)، و بقیه‌ی موارد متوسط.
4. اضافه کردن تست برای OTP، CRM و ClaimCampaign، و اجرای `bandit`، `pip-audit` و `npm audit` در CI.
