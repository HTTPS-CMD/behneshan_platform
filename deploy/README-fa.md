# بالا آوردن نسخه‌ی جدید چهارسوق روی سرور

محتوای این پوشه (`deploy/`) را روی سرور در **همان پوشه‌ای که docker-compose قبلی هست** (کنار `backend/` و `frontend/`) کپی کن:

| فایل | کجا برود | کار |
|---|---|---|
| `docker-compose.yml` | ریشه‌ی پروژه | جایگزین فایل قبلی (اول از قبلی کپی بگیر) |
| `nginx-static.conf` | ریشه‌ی پروژه | تنظیم سرو media و static |
| `.env.example` | ریشه‌ی پروژه، با نام `.env` | همه‌ی متغیرها |
| `backend/Dockerfile`, `entrypoint.sh`, `requirements.txt`, `.dockerignore` | داخل `backend/` | جایگزین Dockerfile قبلی (runserver → gunicorn) |
| `frontend/Dockerfile`, `.dockerignore` | داخل `frontend/` | جایگزین Dockerfile قبلی |

> این‌ها فقط روی سرور لازم‌اند. در مخزن لوکال خودت لازم نیست.

## ۰. بررسی‌های اولیه (روی سرور)

```bash
cd /مسیر/پروژه
docker compose ps
docker network ls
docker inspect 4sogh_frontend --format '{{json .NetworkSettings.Networks}}'
docker pull postgres:16-alpine && docker pull redis:7-alpine && docker pull nginx:alpine
df -h /
```

- اسم شبکه‌ای که `4sogh_frontend` در آن است را بنویس (احتمالاً `<نام‌پوشه>_default`). compose جدید باید از **همین پوشه** اجرا شود تا اسم شبکه عوض نشود و NPM ارتباطش را از دست ندهد.
- اگر `docker pull` خطای 403 یا timeout داد، به‌جای `postgres:16-alpine` بنویس `docker.arvancloud.ir/postgres:16-alpine` (همین پیشوند را برای redis و nginx هم در docker-compose بگذار). خروجی‌اش را برایم بفرست.

## ۱. بکاپ

```bash
cp docker-compose.yml docker-compose.old.yml
cp backend/db.sqlite3 ~/db.sqlite3.bak          # اگر وجود دارد
tar czf ~/media-backup.tgz backend/media
```

## ۲. خروجی گرفتن از دیتای نسخه‌ی قدیمی (قبل از پاک‌شدن هر چیزی)

وقتی هنوز کانتینر قدیمی بالاست:

```bash
docker exec 4sogh_backend python manage.py dumpdata \
  --natural-foreign --natural-primary \
  -e contenttypes -e auth.permission -e sessions -e admin.logentry \
  --indent 1 > ~/old-data.json
ls -lh ~/old-data.json
```

اگر این دستور خطا داد یا فایل خالی بود، خطا را بفرست. **تا این مرحله جواب نداد، سراغ قدم بعد نرو.**

## ۳. ساختن `.env`

```bash
cp .env.example .env
nano .env     # یا در VS Code
```

- `DB_PASSWORD`، `SECRET_KEY`، `JWT_SIGNING_KEY` و `REVALIDATION_SECRET` را با این دستور بساز و مقدار جدا برای هرکدام بگذار:
  `python3 -c "import secrets;print(secrets.token_urlsafe(48))"`
- مقدار `SECRET_KEY` و کلید api.ir که قبلاً در کد بوده را **دوباره استفاده نکن**. کلید api.ir را از پنلش عوض کن و کلید جدید را در `API_IR_KEY` بگذار.
- فایل `.env` را در git نگذار.

## ۴. build و بالا آوردن

```bash
docker compose down            # نسخه‌ی قدیمی را می‌خواباند (دیتا و فایل‌ها پاک نمی‌شوند)
docker compose build
docker compose up -d
docker compose logs -f backend  # باید migrate و بعد gunicorn را ببینی؛ با Ctrl+C خارج شو
docker compose ps               # همه باید Up باشند
```

اگر build فرانت بگوید به بک‌اند وصل نمی‌شود (چون بعضی صفحه‌ها موقع build داده می‌خواهند)، اول فقط بک‌اند را بالا بیاور: `docker compose up -d db redis backend` و بعد `docker compose build frontend` و `docker compose up -d`. اگر باز هم نشد، لاگ را بفرست.

## ۵. ساخت مدیر و انتقال دیتای قدیمی

```bash
docker exec -it 4sogh_backend python manage.py createsuperuser
docker cp ~/old-data.json 4sogh_backend:/tmp/old-data.json
docker exec 4sogh_backend python manage.py loaddata /tmp/old-data.json
```

نسخه‌ی قدیمی با جدید فرق ساختاری دارد، پس ممکن است `loaddata` روی بعضی جدول‌ها خطا بدهد. اگر داد، متن خطا را بفرست؛ جدول‌ها را یکی‌یکی تطبیق می‌دهیم. چیزی که آماده می‌شود فقط در دیتابیس جدید نوشته می‌شود و فایل قدیمی `db.sqlite3` دست‌نخورده می‌ماند.

## ۶. تنظیمات NPM (بعد از بالا آمدن کانتینرها)

۱. Proxy Host `4sogh.shop` → تب **Custom Locations** → مسیر `/media/`:
   - Scheme: `http`
   - Forward Hostname: `4sogh_static`
   - Port: `80`

   (قبلاً `https` و `194.60.230.33:8000` بود، که کار نمی‌کند.)

۲. Proxy Host `api.4sogh.shop` → یک Custom Location جدید برای `/static/` (برای ظاهر پنل admin جنگو): همان `http` و `4sogh_static` و `80`.

۳. هر دو Proxy Host: تب SSL → `4sogh-wildcard` و Force SSL (قبلاً انجام شده).

۴. آدرس `api.4sogh.shop` به `4sogh_backend:8000` و `4sogh.shop` به `4sogh_frontend:3000` همان‌ها که بودند.

## ۷. تست

```bash
curl -I https://api.4sogh.shop/api/v1/        # هر پاسخ جنگو (حتی 401/404 با JSON) یعنی بک‌اند زنده است
curl -I https://4sogh.shop
```

در مرورگر:
- صفحه‌ی اصلی باز شود و لاگین با کد پیامک کار کند (اگر `SMS_PROVIDER=console` است، کد در `docker compose logs backend` چاپ می‌شود).
- بعد از لاگین F5 بزنی همچنان لاگین بمانی.
- عکس‌های آپلودشده نمایش داده شوند.
- `/admin-panel` با کاربر عادی ۴۰۴ دهد.
- `https://api.4sogh.shop/admin/` با ظاهر درست باز شود.

## ۸. کرون‌ها (روی خود سرور، با `crontab -e`)

```cron
CRON_TZ=Asia/Tehran
* * * * *  docker exec 4sogh_backend python manage.py process_sms_queue >> /var/log/4sogh-sms.log 2>&1
10 3 * * * docker exec 4sogh_backend python manage.py run_incentives    >> /var/log/4sogh-cron.log 2>&1
20 3 * * * docker exec 4sogh_backend python manage.py share_daily       >> /var/log/4sogh-cron.log 2>&1
```

(اگر اسم یکی از این commandها در کد وجود نداشت، همان یکی را بگو تا چک کنم.)

## ۹. برگشت به نسخه‌ی قبل (اگر لازم شد)

```bash
docker compose down
cp docker-compose.old.yml docker-compose.yml
# Dockerfileهای قدیمی را برگردان
docker compose up -d --build
```

دیتابیس جدید (volume به نام `pgdata`) و SQLite قدیمی با هم قاطی نمی‌شوند.

## ۱۰. بعد از اینکه همه‌چیز کار کرد

- HSTS را در NPM روشن کن.
- پورت‌های 8000 و 3000 فقط روی `127.0.0.1` باز هستند؛ مستقیم از بیرون به آن‌ها نمی‌شود وصل شد.
- یک بکاپ دوره‌ای از دیتابیس بگذار:
  `docker exec 4sogh_db pg_dump -U behneshan_user behneshan_db | gzip > ~/backup-$(date +%F).sql.gz`
- گواهی SSL حدود ۳۰ دی (۲۰ ژانویه) باید دوباره صادر و در NPM جایگزین شود.
