# PROJECT_BACKUP_HANDOFF — چهارسوق (Chaharsogh / 4sogh.shop)

> **برای Claude (یا هر دستیار/توسعه‌دهنده‌ی جدید):** این فایل را کامل بخوان. هدفش این است که بدون هیچ توضیح اضافه‌ای از طرف صاحب پروژه، کل پروژه، وضعیت فعلی، قوانین کاری و کارهای باقی‌مانده را بفهمی.
> آخرین به‌روزرسانی: ۱۴ نوامبر ۲۰۲۶ (۲۳ آبان ۱۴۰۵) — شامل POS و همگام‌سازی لوکال/سرور/GitHub. این سند از روی گفتگوهای کاری، حافظه‌ی پروژه و فایل‌های مخزن ساخته شده. اگر با کد واقعی فرق داشت، **کد حرف آخر را می‌زند** (فایل `PROJECT_BIBLE.md` قدیمی و نادرست است؛ به آن تکیه نکن).
> ⚠️ در این فایل هیچ کلید/رمز واقعی نیست و نباید بیاید.

---

## ۰. خلاصه‌ی ۳۰ ثانیه‌ای

- **چهارسوق** یک پلتفرم فارسی (RTL) «دایرکتوری کسب‌وکار محلی + تخفیف + باشگاه مشتریان (وفاداری/کش‌بک) + پیامک» است. سایت: `https://4sogh.shop` ، API: `https://api.4sogh.shop/api/v1/`.
- بک‌اند: **Django 6 + DRF + SimpleJWT + PostgreSQL + Redis** (پوشه‌ی `backend/`). فرانت: **Next.js 16 + React 19 + Tailwind 4** (پوشه‌ی `frontend/`). اپ iPhone بومی (**SwiftUI با Xtool**) در `ios/FourSogh` در دست ساخت است.
- روی سرور شخصی ایران (`~/4sogh`) با Docker Compose اجرا می‌شود؛ جلوی آن Nginx Proxy Manager و CDN آروان (ArvanCloud).
- مخزن گیت‌هاب (عمومی!): https://github.com/HTTPS-CMD/behneshan_platform ، شاخه‌ی `main` (شاخه‌ی `new-update` با PR #2 در main ادغام شد).
- زبان گفتگو با صاحب پروژه: **فارسی**. اصطلاحات فنی انگلیسی بماند.

---

## ۱. قوانین و ترجیحات صاحب پروژه (حتماً رعایت شود)

1. **قدم‌به‌قدم کار کن.** برای هر تغییر: چه چیزی، چرا و نتیجه‌اش را توضیح بده، و **قبل از ویرایش هر فایل با AskUserQuestion (یا سؤال صریح) و فهرست فایل‌ها بپرس** («ازم سوال بپرس حتما که هر فایلی رو میخوای تغییر بدی»).
2. **قبل از افزودن هر ویژگی، تکراری بودنش را چک کن** و اگر چیز مشابهی هست، همان را کامل‌تر کن، نه کپی جدید.
3. **API‌ها جایی عوض نشوند و دیتا پاک نشود.** نام‌ها/مسیرها را بدون درخواست تغییر نده («اسم و اینارو هیچی رو نمیخوام عوض کنی»).
4. **commit/push را خود کاربر انجام می‌دهد** (قبلاً «commit نمی‌خوام»؛ فقط یک‌بار صریحاً خواست مخزن به‌روز شود و خودش push کرد). بدون درخواست commit نکن.
5. **هرگز `.env` / `.env.local` را نخوان، stage نکن، چاپ نکن.** هیچ کلید/توکن واقعی را در چت یا فایل تکرار نکن. وارد کردن رمز/کلید در فیلدها کار تو نیست.
6. دور زدن بلاک‌ها ممنوع: اگر WebFetch/سایتی بلاک بود با curl دور نزن. سرور ایران: Docker Hub و PyPI بلاک است؛ دور نزن، از mirror آروان (`docker.arvancloud.ir/...`) استفاده کن.
7. **هرگز** `docker system prune -a --volumes` یا `docker volume prune` اجرا نکن. `docker image prune -a` هم خطرناک است (Docker Hub بلاک است و ایمیج‌ها دیگر قابل pull نیستند).
8. حذف فایل با ابزار device_bash بدون اجازه‌ی صریح ممکن نیست؛ از `_to_delete/` استفاده کن یا اجازه بخواه.
9. پاسخ‌ها به فارسی، گرم و خلاصه. کاربر معمولاً دستورها را در iTerm روی Mac/سرور خودش اجرا می‌کند و خروجی را برمی‌گرداند.

---

## ۲. زیرساخت و محیط

### ۲.۱ سرور
- `root@194.60.230.33` ، مسیر پروژه `~/4sogh` ، دسترسی با iTerm / VS Code Remote SSH.
- **سرور فقط اینترنت ایران دارد** (Docker Hub و PyPI بلاک؛ تلگرام کار نمی‌کند → اعلان‌ها با ربات **بله (Bale)**).
- سرویس‌های Docker Compose: `db` (Postgres 16)، `redis` (7)، `backend` (gunicorn، پورت 8000 فقط روی 127.0.0.1)، `frontend` (Next، 3000)، `static` (nginx برای media/static)، `uptime` (Uptime Kuma v2؛ کانتینر `4sogh_uptime`).
- نام کانتینرها: `4sogh_backend`, `4sogh_frontend`, `4sogh_static`, `4sogh_db`, `4sogh_uptime`, و `npm-app-1` (Nginx Proxy Manager).
- محتوای `~/4sogh`: `backend/ frontend/ ops/ opsdata/ _incoming/ docker-compose.yml nginx-static.conf README-fa.md google8d7110bbd068edca.html`.
- compose را همیشه از **همان پوشه** اجرا کن (نام شبکه عوض نشود وگرنه NPM ارتباطش را از دست می‌دهد).
- backend entrypoint خودش `migrate` می‌زند.

### ۲.۲ NPM + DNS/CDN
- `4sogh.shop → 4sogh_frontend:3000` ، `api.4sogh.shop → 4sogh_backend:8000`.
- Custom Location `/media/` (روی 4sogh.shop) و `/static/` (روی api) → `http://4sogh_static:80`.
- گواهی wildcard (`4sogh.shop` + `*.4sogh.shop`) با certbot/DNS-01 روی Mac صادر و در NPM آپلود شده؛ **انقضا: ۳۰ ژانویه ۲۰۲۷ (۱۴۰۵/۱۱/۱۰)** — تمدید دستی (همان دستور certbot دوباره).
- **آروان (DNS + CDN):** ابر (cloud/proxy) باید **روشن** باشد وگرنه از خارج از ایران (Googlebot، کاربران VPN) سایت باز نمی‌شود. آروان **گواهی HTTPS خودش** لازم دارد (برای هر دو `4sogh.shop` و `api.4sogh.shop`) و **SSL mode = Full** (نه Flexible؛ Flexible با Force-SSL در NPM حلقه می‌سازد). این مشکل حل شده؛ سایت از سراسر دنیا 200 می‌دهد (تست: check-host.net).
- نکته‌ی عیب‌یابی: اگر `dig` آی‌پی `198.18.x.x` داد یعنی روی Mac پراکسی/VPN فعال است. `ipinfo.io` از ایران 403 می‌دهد. sandbox ابری Claude نمی‌تواند `4sogh.shop` را باز کند (پروکسی بلاک می‌کند) — برای تست از مرورگر داخلی/Mac کاربر استفاده کن.

### ۲.۳ جریان کار (Workflow)
1. تغییر در Mac: `/Users/macbookpro/Documents/GitHub/behneshan_platform`. لوکال: `npm run dev` و `python manage.py runserver` (فایل‌های Docker فقط برای سرور).
2. انتقال به سرور با **rsync** (rsync اجازه‌ی اجرای اسکریپت‌ها را می‌برد → بعدش `chmod +x ~/4sogh/ops/*.sh`).
3. روی سرور: `cd ~/4sogh && ./ops/deploy.sh [frontend|backend|all]`:
   - بکاپ پیش از deploy (نوع `predeploy`، ۵ تای آخر نگه داشته می‌شود) → build → up → health check → **rollback خودکار** در صورت شکست → پاکسازی (`docker image prune -f`, `builder prune --filter until=24h`).
4. تست: `curl -I https://api.4sogh.shop/api/v1/` و `curl -I https://4sogh.shop` و بررسی در مرورگر.
5. گیت: کاربر خودش commit/push می‌کند. push بزرگ گاهی `HTTP 400 RPC failed` می‌دهد → `git config http.version HTTP/1.1` ، بزرگ‌کردن `http.postBuffer` ، یا عوض‌کردن مسیر VPN/استفاده از SSH.

### ۲.۴ ابزارهای Claude در این محیط
- مرورگر داخلی اپ دسکتاپ (روی Mac کاربر، IP ایران) می‌تواند سایت و پنل ادمین لاگین‌شده را بخواند/کار کند. به آروان لاگین نیست.
- `device_bash` ممکن است «Workspace unavailable» بدهد؛ در آن صورت فقط `device_list_dir / device_stage_files / device_commit_files` کار می‌کنند.
- `gh` ابری به مخزن دسترسی ندارد؛ مخزن عمومی را با مرورگر می‌شود خواند.

---

## ۳. معماری کد

### ۳.۱ بک‌اند (`backend/`, Django 6)
اپ‌ها در `backend/apps/` (namespace package؛ تست‌ها: `python manage.py test apps.seo.tests`). مایگریشن‌ها **دستی با BigAutoField صریح** نوشته می‌شوند.

| اپ | کار |
|---|---|
| `identity` | کاربر، OTP (ورود/ثبت‌نام)، JWT، پروفایل، پنل ادمین کاربران. نقش‌ها: ادمین/صاحب کسب‌وکار/مشتری (نقش از کلاینت قبول نمی‌شود) |
| `directory` | کسب‌وکار، دسته/موقعیت، نظرات، کمپین/تخفیف، استوری، محصول، VIP، CRM فروشنده (`crm.py`) |
| `taxonomy` | دسته‌ها و موقعیت‌ها |
| `cms` | منو، بنر، تنظیمات سایت (`SiteSetting` key/value). endpoint عمومی `/cms/data/`؛ کلیدهای با پیشوند `private_` حذف می‌شوند؛ تنظیمات سئو با پیشوند `seo_` |
| `loyalty` | باشگاه مشتریان: ولت/کش‌بک، تراکنش، ShareClub، انگیزه‌ها (`incentives.py`)، سگمنت (`segments.py`)، سیستم پیامک (`sms.py`, `sms_views.py`)، اکسل (`excel.py`)، تاریخ جلالی (`jalali.py`) |
| `notifications` | اعلان‌ها (signals/services) |
| `ops` | سلامت و بکاپ سیستم برای پنل ادمین |
| `seo` | افزونه‌ی سئو داخلی (بخش ۶) |
| `analytics` | ثبت بازدید و آمار ادمین |

Management commandهای loyalty: `expire_cashback`, `import_legacy_transactions`, `process_sms_queue`, `run_incentives`, `share_daily`.

**جزئیات مهم:**
- Throttle ناشناس DRF: ۱۲۰ در دقیقه به ازای IP. SSR فرانت از یک IP می‌زند، پس endpointهای عمومی سئو و view سایت‌مپ `throttle_classes = []` دارند.
- پیامک (`loyalty/sms.py`): `get_provider()` بر اساس `SMS_PROVIDER` (`console | kavenegar | smsir | ippanel`)، `SMS_API_KEY`، `SMS_LINE_NUMBER`. فعلی: **ippanel** (`IppanelProvider` به `https://edge.ippanel.com/v1/api/send` می‌فرستد، `sending_type=webservice`، گیرنده‌ها E.164؛ اول توکن خام و بعد با پیشوند `API ` امتحان می‌شود).
- OTP ورود/ثبت‌نام در `identity/views.py` (`GenerateOTPView`, `VerifyOTPView`). قالب پیامک `OTP_SMS_TEXT = "کد ورود به چهارسوق: {otp}\nYour code is {otp}"` از طریق provider پروژه (`_send_otp_text`)؛ اگر ConsoleProvider بود یا شکست خورد → fallback به api.ir (`https://s.api.ir/api/sw1/SmsOTP` با `settings.API_IR_KEY`؛ template 1 = ثبت‌نام، 0 = ورود). ثبت‌نام با api.ir شاهکار هم چک می‌شود.
- مسیر API: `/api/v1/identity|directory|taxonomy|cms|loyalty|analytics|seo/...`. نقشه‌ی کامل در `API_MAP.md` (قدیمی‌تر؛ برای مسیرهای جدید loyalty/seo/ops کد را ببین).

### ۳.۲ فرانت (`frontend/`, Next.js 16)
- مسیرهای اصلی (`src/app`): `/` خانه، `business/[slug]`، `daily-discounts`، `landing` (**باید بماند و از پنل ادمین قابل ویرایش باشد**)، `about`، `contact`، `terms/*`، `login`، `register`.
- پنل‌ها: `dashboard/client` (مشتری: علاقه‌مندی، VIP، باشگاه)، `dashboard/owner` (صاحب کسب‌وکار: analytics, campaigns, club, crm, customers, edit, products, requests, reviews, stories, account)، `dashboard/account`, `dashboard/notifications`، `admin-panel` (content, analytics, notifications, sms, **system (سلامت و بکاپ)**, **seo**).
- `proxy.ts` (نام جدید middleware در Next 16) فقط `/dashboard`, `/admin-panel`, `/login`, `/register` را می‌پوشاند.
- صفحاتی که داده‌ی زنده می‌خوانند `export const dynamic = 'force-dynamic'`. صفحات سئو: `generateMetadata`, `metadataBase`, `alternates.canonical`, JSON-LD با کامپوننت `JsonLd`, `sitemap.ts`, `robots.ts`.
- خواندن override سئو و تنظیمات با `fetch(..., {next:{revalidate:60}})`. فراخوانی سمت سرور از `BACKEND_INTERNAL_URL || NEXT_PUBLIC_API_URL`.
- طراحی: RTL، پالت لوگو (سرمه‌ای `#1E3A5F`، نارنجی `#E08A3C`، پس‌زمینه‌ی کِرِم)، framer-motion.

### ۳.۳ اپ iPhone (`ios/FourSogh`)
SwiftUI + Xtool، با API همین سایت. ظاهر باید **دقیقاً شبیه سایت** و آیکن اپ = لوگوی سایت باشد. مراحل: (۱) صفحات سایت + پنل مشتری (۲) پنل کسب‌وکار (۳) پنل ادمین؛ شامل صفحات محتوایی (about/contact/terms). ورود با OTP.

---

## ۴. آنچه ساخته شده (به ترتیب فازها)

1. **فاز ۰ — امنیت:** انتقال secretها به env، رفع موارد بحرانی ممیزی (بخش ۸)، رفع endpointهای خراب (پاسخ کامنت UUID، slug فارسی، حذف کسب‌وکار در ادمین، آمار ادمین).
2. **فاز ۱ — زیرساخت:** جداسازی settings، `requirements.txt`، Dockerfile/entrypoint (gunicorn)، compose با Postgres+Redis، یکپارچه‌سازی git، تست OTP/تخفیف/تراکنش. نسخه‌ی جدید جایگزین نسخه‌ی اول روی سرور شد (داده‌ی واقعی قدیمی نبود؛ از صفر شروع شد).
3. **فاز ۲ — فرانت:** env برای API، proxy.ts درست، SSR صفحات عمومی، فونت فارسی، toast، حذف تکرارها.
4. **باشگاه مشتریان به سبک Sanjab (loyalty):** ولت/کش‌بک، داده‌ی هوشمند و سگمنت‌ها، ShareClub، سیستم پیامک (ارائه‌دهنده‌ی قابل تعویض)، ولت باشگاه صاحب‌کسب‌وکار، گزارش‌ها. درگاه پرداخت **هنوز نیست**: شارژ ولت و اعتبار پیامک را ادمین دستی انجام می‌دهد. سگمنت‌ها فقط از مشتریان خود سایت. صفحات قدیمی CRM («پذیرش مشتری» و «مشتریان من») در باشگاه ادغام شدند.
5. **ops/تولیدی‌سازی:** بکاپ روزانه‌ی DB با تست restore، `deploy.sh` با rollback، لاگ‌چرخانی Docker، **Uptime Kuma** (۳ مانیتور؛ اعلان از طریق ربات بله؛ قرار است در `status.4sogh.shop` از NPM در دسترس شود)، اسکریپت `agent.sh`.
6. **پنل ادمین «سلامت و بکاپ»** (`/admin-panel/system`): سلامت، لیست/ساخت/دانلود بکاپ، لاگ‌ها. همه‌ی ادمین‌ها می‌بینند؛ فقط superuser بکاپ می‌گیرد/دانلود می‌کند؛ دکمه‌ی deploy و مانیتورینگ ندارد.
7. **پیامک IPPanel** برای کمپین/باشگاه (OTP ورود هنوز api.ir + fallback ippanel).
8. **تماس با ما (Contact-us)** با ذخیره‌ی پیام‌ها و پنل ادمین.
9. **سئو فاز ۱:** sitemap، robots، metadata/SSR صفحات کسب‌وکار، schema (JSON-LD).
10. **سئو فاز ۲ گام ۱:** افزونه‌ی ادمین (`/admin-panel/seo`) — بخش ۶.
11. **رفع دسترسی خارج ایران:** گواهی HTTPS آروان + SSL Full → سایت و API از سراسر دنیا باز می‌شوند؛ خطای «Robots.txt unreachable» سرچ‌کنسول ریشه‌اش خاموش‌بودن ابر بود.
12. **نمره‌ی سئوی ۲۲ صفحه** از طریق پنل ادمین بالای ۸۰ رسید (میانگین ۹۷).
13. **مخزن GitHub** به‌روز شد (`new-update` → `main`، PR #2).
14. **قالب پیامک OTP** (`OTP_SMS_TEXT` در `identity/views.py`) روی سرور deploy و در مقایسه‌ی ۲۰۲۶-۱۱-۱۴ با لوکال یکسان تأیید شد.
15. **پشتیبانی POS (کارت‌خوان) در باشگاه (loyalty):** مدل `Purchase` فیلدهای `client_ref` (UUID یکتا برای تکرار امن درخواست دستگاه) و `pos_reference` (کد پیگیری کارت‌خوان) و `Source.POS` گرفت؛ constraint یکتایی `uniq_purchase_client_ref` روی (`business`, `client_ref`)؛ در `views.py` تکرار درخواست با همان `client_ref` همان خرید قبلی را با 200 برمی‌گرداند و درخواست هم‌زمان با `IntegrityError` مدیریت می‌شود؛ `services.record_purchase` پارامترهای جدید را می‌گیرد؛ مایگریشن `0005_purchase_client_ref_pos_reference.py`. روی سرور rsync و `./ops/deploy.sh backend` شد و روی GitHub commit/push شد (طبق گزارش کاربر، ۲۰۲۶-۱۱-۱۴).
16. **همگام‌سازی لوکال ↔ سرور ↔ GitHub (۲۰۲۶-۱۱-۱۴):** با `rsync -rcni` مقایسه شد؛ نتیجه: لوکال جلوتر از سرور بود (فقط POS)، چیزی از سرور به لوکال نیامد. فایل‌های `Dockerfile`, `entrypoint.sh`, `requirements.txt`, `.dockerignore` (backend و frontend) فقط روی سرور هستند و نسخه‌ی لوکالشان در `deploy/` است. اختلاف‌های «فقط زمان» (مثل `docker-compose.yml`, `apps/ops/*`, `api.ts`) بی‌اهمیت‌اند.
   - **روش مقایسه** (بدون تغییر دادن چیزی): `rsync -rcni --itemize-changes --exclude='.env*' --exclude=venv --exclude=node_modules --exclude=.next --exclude=__pycache__ --exclude=media root@194.60.230.33:~/4sogh/<backend|frontend>/ <backend|frontend>/` و برای فایل‌های مشکوک `ssh ... cat | diff -u`.

---

## ۵. باشگاه/پیامک — نکات کار
- پیامک webservice معمولی IPPanel است، نه «الگو/Pattern» ثبت‌شده. اگر خواستند الگو: کد pattern و نام متغیرها لازم است.
- کرون‌های سرور (`crontab -e`, `CRON_TZ=Asia/Tehran`):
  ```
  * * * * *  docker exec 4sogh_backend python manage.py process_sms_queue >> /var/log/4sogh-sms.log 2>&1
  10 3 * * * docker exec 4sogh_backend python manage.py run_incentives    >> /var/log/4sogh-cron.log 2>&1
  20 3 * * * docker exec 4sogh_backend python manage.py share_daily       >> /var/log/4sogh-cron.log 2>&1
  ```
  (و `expire_cashback`؛ وضعیت فعال‌بودنشان روی سرور را چک کن.)
- ممکن است بعداً قالب Web OTP (`@4sogh.shop #123456`) لازم شود.

---

## ۶. افزونه‌ی سئو (`apps/seo` + `/admin-panel/seo`)
- مدل `SeoPage` با `page_type` ∈ static / business / category / location؛ فیلدهای قابل ویرایش per-page؛ تنظیمات کلی با کلیدهای `seo_*` در SiteSetting.
- **امتیازدهی (`analysis.py`)**، نرمال‌شده به ۱۰۰: عنوان ۳۰–۶۰ کاراکتر (وزن ۲۰)، توضیح ۷۰–۱۶۰ (۲۰)، وجود کلمه‌ی کلیدی (۱۰)، کلیدی در عنوان (۱۰)، کلیدی در توضیح (۱۰)، تصویر (۱۰)؛ فقط کسب‌وکار: محتوا ≥۱۲۰ کاراکتر (۱۰)، آدرس+تلفن (۱۰)، نظرات (۵). صفحات `noindex` امتیاز ندارند.
- قوانین auto-meta باید بین بک‌اند و فرانت **یکسان نگه داشته شود**.
- Endpointها — ادمین: `seo/admin/pages/`, `admin/pages/detail/`, `admin/analyze/`, `admin/settings/`؛ عمومی: `seo/sitemap/`, `seo/public/settings/`, `seo/public/page/`.
- پیش‌نمایش گوگل/شبکه‌های اجتماعی، sitemap/robots/schema.
- **گام ۲ (شروع نشده):** جدول دستی رتبه‌ی کلمات کلیدی (`RankKeyword`/`RankEntry`, مایگریشن 0002، API، تب). بدون Search Console (فعلاً نمی‌خواهند)؛ قبل از شروع فهرست فایل‌ها را تأیید بگیر.
- بعد از باز شدن سایت: در Search Console سایت‌مپ را دوباره submit و «تست آدرس زنده» بزن.

---

## ۷. وضعیت فعلی و کارهای در جریان
- **OTP قالب جدید:** روی سرور هست (مقایسه‌ی ۱۱-۱۴ یکسان بود). اگر پیامک هنوز قالب قدیمی دارد: (۱) `docker compose logs backend` را چک کن (۲) مطمئن شو کانتینر بعد از deploy ری‌استارت شده. provider=ippanel، کلید و خط ست هستند. پیامک فعلی webservice است نه Pattern.
- **POS/کارت‌خوان:** deploy و commit/push شده (بخش ۴ مورد ۱۵). اگر Claude جدید endpoint POS را تست کرد، `client_ref` را UUID بدهد و `source=POS`.
- **تأیید‌شده (۱۴ نوامبر ۲۰۲۶):** `showmigrations loyalty` روی سرور نشان داد مایگریشن‌های ۰۰۰۱ تا ۰۰۰۵ همگی اعمال شده‌اند (`[X]`)، پس POS روی سرور فعال است.
- Search Console: سایت‌مپ + live URL test.

## ۸. ممیزی (Oct 2026) و ریسک‌های باز
**بحرانی (اغلب رفع شده، ولی بررسی مجدد کن):** کلیدهای هاردکد (api.ir/SECRET_KEY/DB/revalidate)، DEBUG و ALLOWED_HOSTS، خرید VIP بدون پرداخت، mass assignment در PATCH کسب‌وکار، نقش از کلاینت، OTP بدون rate-limit، `/api/clear-cache-live` بدون auth، توکن در کوکی غیر httpOnly با عمر ۷ روزه، آپلود استوری بدون اعتبارسنجی.
**باز/بدهی فنی مهم:**
- 🔴 **نشت راز در مخزن عمومی:** `SECRET_KEY` واقعی در `backend/.env.example` و رمز هاردکد در `backend/docker-compose.yml` روی GitHub عمومی است → **بچرخان (rotate) و حذف کن** (مقدارها را هرگز نقل نکن). توکن‌های api.ir و Bale هم که افشا شده‌اند باید عوض شوند.
- پورت 5432 Postgres روی هاست محدود شود؛ HSTS در NPM روشن شود.
- فایل‌های `_tmp_backend.tgz` و `4sogh-release.tgz` از ریشه‌ی پروژه حذف شوند؛ `.gitignore` پوشه‌ی `Claude outputs/`، `_audit-2026-10-20/` و `*.tgz` را نادیده نمی‌گیرد (اضافه شود).
- تمدید گواهی قبل از ۳۰ ژانویه ۲۰۲۷ (گواهی آروان شاید خودکار تمدید شود).
- بکاپ off-site (rsync از Mac)؛ DNS+NPM برای `status.4sogh.shop` و تست اعلان بله در Kuma.
- داده‌ی دمو (slugهای `demo-*`) ایندکس شده؛ محتوای `/terms/client` هنوز «در حال بروزرسانی».
- فاز ۶ گزارش‌ها؛ درگاه پرداخت (VIP، ولت، اعتبار پیامک)؛ آمار واقعی صاحب کسب‌وکار (قبلاً ساختگی/views_count افزایش نمی‌یافت)؛ چند کسب‌وکار برای هر کاربر.
- ایمیج‌های بلااستفاده‌ی Docker قابل حذف‌اند (webano-app ≈۵GB، n8n، PHP، postgres:15، node:18) — فقط با `docker rmi` هدفمند و با اجازه.
- `PROJECT_BIBLE.md` قدیمی است؛ باید بازنویسی یا با همین فایل جایگزین شود.

---

## ۹. راهنمای شروع برای Claude جدید
1. این فایل + `CLAUDE.md` + `deploy/README-fa.md` + `SECURITY_AUDIT.md` + `API_MAP.md` را بخوان.
2. ساختار واقعی را از کد بگیر (`backend/apps/*`, `frontend/src/app/*`)؛ به `PROJECT_BIBLE.md` اعتماد نکن.
3. هر تغییر: اول سؤال با لیست فایل‌ها → بعد ویرایش → توضیح نتیجه. تکراری‌بودن را چک کن.
4. `.env*` را نخوان. کلید نساز/نقل نکن. commit نکن مگر خواسته شود.
5. برای deploy از `./ops/deploy.sh` استفاده کن؛ دستی `docker compose down` با volume حذف نزن.
6. تست‌ها: `cd backend && python manage.py test apps.seo.tests` (و بقیه‌ی اپ‌ها)؛ فرانت: `cd frontend && npm run build`.
7. پس از هر تغییر مهم این فایل را به‌روز کن (بخش ۴ و ۷).
