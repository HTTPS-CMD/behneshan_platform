# عملیات چهارسوق: بکاپ، دیپلوی امن، لاگ و مانیتورینگ

## فایل‌ها
| فایل | کجا برود (روی سرور) | کار |
|---|---|---|
| `backup.sh` | `~/4sogh/ops/backup.sh` | بکاپ روزانه‌ی دیتابیس، media هفته‌ای، نگهداری ۱۴ نسخه |
| `restore-test.sh` | `~/4sogh/ops/restore-test.sh` | تست بازیابی در یک دیتابیس موقت (دیتابیس اصلی را لمس نمی‌کند) |
| `deploy.sh` | `~/4sogh/ops/deploy.sh` | دیپلوی با بکاپ، چک سلامت و برگشت خودکار |
| `docker-compose.yml` | `~/4sogh/docker-compose.new.yml` | نسخه‌ی جدید: چرخش لاگ + Uptime Kuma |

## ۱. نصب روی سرور
از مک:
```bash
cd ~/Documents/GitHub/behneshan_platform/deploy/ops
ssh root@194.60.230.33 "mkdir -p ~/4sogh/ops"
scp backup.sh restore-test.sh deploy.sh root@194.60.230.33:~/4sogh/ops/
scp docker-compose.yml root@194.60.230.33:~/4sogh/docker-compose.new.yml
```
روی سرور:
```bash
cd ~/4sogh
chmod +x ops/*.sh
diff docker-compose.yml docker-compose.new.yml      # باید فقط logging و بخش uptime اضافه باشد
```
اگر `diff` چیز دیگری هم نشان داد (مثلاً تغییرات خودت)، همان‌ها را در فایل جدید هم بیاور.

## ۲. بکاپ (مهم‌ترین مورد)
```bash
cd ~/4sogh
./ops/backup.sh                 # اولین بکاپ دستی
ls -lh ~/backups/4sogh/
./ops/restore-test.sh           # تست بازیابی؛ باید «بازیابی موفق بود» را ببینی
```
بکاپ بدون تست بازیابی ارزشی ندارد. تعداد جدول‌ها و کاربران چاپ‌شده را با سایت مقایسه کن.

کرون روزانه (ساعت ۳:۱۵ بامداد):
```bash
crontab -e
```
```cron
CRON_TZ=Asia/Tehran
15 3 * * * /root/4sogh/ops/backup.sh >> /var/log/4sogh-backup.log 2>&1
```

### کپی بیرون از سرور
بکاپی که روی همان سرور بماند، با خراب‌شدن سرور از بین می‌رود. از مک خودت بکش (رمز یا کلیدی روی سرور ذخیره نمی‌شود):
```bash
mkdir -p ~/Backups/4sogh
rsync -av root@194.60.230.33:~/backups/4sogh/ ~/Backups/4sogh/
```
این را هفته‌ای یک‌بار دستی بزن یا با `crontab`/`launchd` مک خودکار کن.

## ۳. دیپلوی با برگشت خودکار
```bash
cd ~/4sogh
./ops/deploy.sh frontend        # فقط فرانت
./ops/deploy.sh backend         # فقط بک‌اند
./ops/deploy.sh all             # هر دو
NO_CACHE=1 ./ops/deploy.sh frontend    # بیلد بدون کش
```
مراحل: بکاپ دیتابیس، برچسب `prev` روی ایمیج فعلی، بیلد، بالا آوردن، چک سلامت (`127.0.0.1:8000` و `:3000`)، و در صورت خرابی برگشت خودکار.
توجه: برگشت فقط کد را به نسخه‌ی قبل برمی‌گرداند. مایگریشن‌هایی که اجرا شده‌اند برگردانده نمی‌شوند. اگر لازم شد، همان بکاپ همین اجرا برای بازیابی دیتابیس هست.

از این به بعد، به‌جای `docker compose build` و `up` دستی، از `deploy.sh` استفاده کن.

## ۴. چرخش لاگ و Uptime Kuma
وقتی compose جدید را جایگزین کردی:
```bash
cd ~/4sogh
cp docker-compose.yml docker-compose.before-ops.yml
mv docker-compose.new.yml docker-compose.yml
docker compose pull uptime                  # ایمیج Uptime Kuma (از میرور داکر)
docker compose up -d                        # کانتینرها با تنظیمات لاگ جدید دوباره ساخته می‌شوند
docker compose ps
```

### ساخت حساب مدیر Uptime Kuma (قبل از بازکردن آن به اینترنت)
اولین کسی که صفحه‌ی Uptime Kuma را باز کند، حساب مدیر را می‌سازد؛ پس اول خودت از طریق تونل SSH:
```bash
# روی مک
ssh -L 3002:127.0.0.1:3002 root@194.60.230.33
# بعد در مرورگر مک: http://localhost:3002  و ساخت نام کاربری و رمز قوی
```
بعد مانیتورهای زیر را اضافه کن (نوع HTTP، فاصله ۶۰ ثانیه):
- `https://4sogh.shop/`
- `https://api.4sogh.shop/api/v1/taxonomy/categories/`
- `https://4sogh.shop/media/cms/banners/48_188.png` (فایل media از مسیر NPM)

### اعلان
- تلگرام کار نمی‌کند چون سرور فقط دسترسی داخل ایران دارد.
- در Settings و Notifications، گزینه‌ی ایمیل (SMTP) را با یک سرویس ایمیل قابل‌دسترس از ایران تنظیم کن، یا یک Webhook به سرویس پیامک ایرانی خودت. بعد از بالا آمدن، اگر خواستی راه‌اندازی دقیقش را با هم انجام می‌دهیم.

### دسترسی از بیرون (اختیاری)
برای دیدن وضعیت بدون تونل: DNS رکورد `status` را به IP سرور بزن و در NPM یک Proxy Host با `status.4sogh.shop` به `http://4sogh_uptime:3001` بساز، Websockets Support روشن، SSL گواهی `4sogh-wildcard`، Force SSL. تا حساب مدیر نساخته‌ای این کار را نکن.

## ۵. بررسی نهایی
- `ls ~/backups/4sogh` بعد از اولین کرون (فردا صبح) یک فایل `.dump` جدید نشان دهد.
- `docker inspect 4sogh_backend --format '{{.HostConfig.LogConfig}}'` مقدار `max-size:10m` را نشان دهد.
- پنل Uptime Kuma هر سه مانیتور را سبز نشان دهد.

## ۶. پنل «سلامت و بکاپ» داخل سایت (`/admin-panel/system`)

سایت هیچ دستوری روی سرور اجرا نمی‌کند. اسکریپت `agent.sh` (بیرون از داکر) وضعیت و لاگ را در `~/4sogh/opsdata` می‌نویسد و بک‌اند فقط آن را می‌خواند. دکمه‌ی «بکاپ همین الان» هم فقط یک فایل خالی در `opsdata/requests` می‌سازد و agent آن را در دقیقه‌ی بعد اجرا می‌کند.

```bash
# روی مک
scp agent.sh root@194.60.230.33:~/4sogh/ops/
scp docker-compose.yml root@194.60.230.33:~/4sogh/docker-compose.new.yml   # فقط اگر قبلاً جایگزین نکرده‌ای؛ دو volume برای backend اضافه شده
# روی سرور
cd ~/4sogh && chmod +x ops/agent.sh
mkdir -p opsdata ~/backups/4sogh
./ops/agent.sh && cat opsdata/status/health.json
crontab -e
```
```cron
* * * * * /root/4sogh/ops/agent.sh >> /var/log/4sogh-agent.log 2>&1
```
بعد کد جدید بک‌اند و فرانت را ببر روی سرور و با `./ops/deploy.sh all` دیپلوی کن. چون volumeهای backend عوض شده، این دیپلوی کانتینر backend را دوباره می‌سازد.

دسترسی‌ها: همه‌ی ادمین‌ها وضعیت، لیست بکاپ و لاگ را می‌بینند؛ «بکاپ دستی» و «دانلود» فقط برای `is_superuser` است. اگر حساب ادمین تو سوپریوزر نیست:
`docker exec -it 4sogh_backend python manage.py shell -c "from apps.identity.models import User; User.objects.filter(phone_number='شماره').update(is_superuser=True, is_staff=True)"`

## نکته‌ی فضای دیسک بعد از دیپلوی

- `deploy.sh` بعد از هر دیپلوی موفق، ایمیج‌های رهاشده و کش بیلدِ قدیمی‌تر از ۲۴ ساعت را پاک می‌کند (به دیتابیس و ایمیج `:prev` دست نمی‌زند).
- بکاپ قبل از دیپلوی با نام `predeploy_*.dump` ذخیره می‌شود و فقط ۵ نسخه‌ی آخر می‌ماند (قابل تغییر با `KEEP_PREDEPLOY`). بکاپ شبانه `4sogh_*.dump` مثل قبل ۱۴ روز می‌ماند.
- `NO_CACHE=1` را فقط وقتی لازم است بزنید (مثلاً مشکل کش یا تغییر وابستگی‌ها)؛ بدون آن بیلد سریع‌تر است و فضای کمتری می‌گیرد.
