#!/usr/bin/env bash
# بکاپ روزانه‌ی دیتابیس چهارسوق (و هفته‌ای یک‌بار عکس‌های media)
# اجرا:  ./ops/backup.sh            (از هر مسیری؛ خودش به پوشه‌ی پروژه می‌رود)
# تنظیمات اختیاری با متغیر محیطی:  BACKUP_DIR  KEEP_DAYS  OFFSITE_TARGET
set -euo pipefail
umask 077

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/4sogh}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-4sogh_db}"
# daily = بکاپ شبانه (۱۴ روز می‌ماند)؛ predeploy = بکاپ قبل از دیپلوی (فقط KEEP_PREDEPLOY نسخه‌ی آخر می‌ماند)
KIND="${BACKUP_KIND:-daily}"
KEEP_PREDEPLOY="${KEEP_PREDEPLOY:-5}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$PROJECT_DIR"

ts="$(date +%Y-%m-%d_%H%M)"
if [ "$KIND" = "predeploy" ]; then
  out="$BACKUP_DIR/predeploy_${ts}.dump"   # عمداً با پیشوند 4sogh_ نیست تا با بکاپ شبانه قاطی نشود
else
  out="$BACKUP_DIR/4sogh_${ts}.dump"
fi
tmp="${out}.partial"
trap 'rm -f "$tmp"' EXIT

echo "[$(date '+%F %T')] شروع بکاپ دیتابیس -> $out"

# pg_dump داخل کانتینر دیتابیس؛ نام کاربر و دیتابیس از خود کانتینر خوانده می‌شود (رمز لازم نیست)
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp"

# سلامت فایل: خالی نباشد و pg_restore بتواند فهرستش را بخواند
if [ ! -s "$tmp" ]; then
  echo "خطا: فایل بکاپ خالی است" >&2
  exit 1
fi
docker exec -i "$DB_CONTAINER" pg_restore --list < "$tmp" > /dev/null

mv "$tmp" "$out"
trap - EXIT
echo "[$(date '+%F %T')] بکاپ دیتابیس سالم است ($(du -h "$out" | cut -f1))"

# عکس‌ها و فایل‌های آپلودی: هفته‌ای یک‌بار (یکشنبه)
if [ "$KIND" = "daily" ] && [ "$(date +%u)" = "7" ] && [ -d "$PROJECT_DIR/backend/media" ]; then
  media_out="$BACKUP_DIR/media_${ts}.tgz"
  tar czf "$media_out" -C "$PROJECT_DIR/backend" media
  echo "[$(date '+%F %T')] بکاپ media: $media_out ($(du -h "$media_out" | cut -f1))"
fi

# پاک‌کردن نسخه‌های قدیمی
find "$BACKUP_DIR" -maxdepth 1 -name '4sogh_*.dump' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'media_*.tgz' -mtime +35 -delete
# بکاپ‌های قبل از دیپلوی: فقط چند نسخه‌ی آخر (هر دیپلوی یک dump می‌سازد و بدون این حد فضا پر می‌شود)
ls -1t "$BACKUP_DIR"/predeploy_*.dump 2>/dev/null | tail -n +"$((KEEP_PREDEPLOY + 1))" | xargs -r rm -f -- || true   # اگر هنوز هیچ predeploy نیست، ls خطا می‌دهد؛ نباید اسکریپت را قطع کند

# کپی اختیاری به بیرون از سرور (مثلاً user@host:/path/)
if [ "$KIND" = "daily" ] && [ -n "${OFFSITE_TARGET:-}" ]; then
  rsync -a "$out" "$OFFSITE_TARGET" && echo "[$(date '+%F %T')] کپی بیرونی انجام شد"
fi

echo "[$(date '+%F %T')] تمام ($KIND). شبانه: $(ls -1 "$BACKUP_DIR"/4sogh_*.dump 2>/dev/null | wc -l) · قبل از دیپلوی: $(ls -1 "$BACKUP_DIR"/predeploy_*.dump 2>/dev/null | wc -l)"
