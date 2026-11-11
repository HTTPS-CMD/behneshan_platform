#!/usr/bin/env bash
# دیپلوی امن چهارسوق با برگشت خودکار
#   ./ops/deploy.sh frontend      فقط فرانت
#   ./ops/deploy.sh backend       فقط بک‌اند
#   ./ops/deploy.sh all           هر دو (پیش‌فرض)
# NO_CACHE=1 ./ops/deploy.sh frontend   بیلد بدون کش
#
# مراحل: بکاپ دیتابیس -> برچسب prev روی ایمیج فعلی -> بیلد -> بالا آوردن -> چک سلامت -> (در صورت خرابی) برگشت.
# توجه: برگشت، فقط کد را به نسخه‌ی قبل برمی‌گرداند. مایگریشن‌هایی که روی دیتابیس اجرا شده‌اند
# برگردانده نمی‌شوند؛ اگر لازم شد، بکاپ همین اجرا برای بازیابی دیتابیس هست.
set -euo pipefail

cd "$(dirname "$0")/.."
TARGET="${1:-all}"

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi

case "$TARGET" in
  frontend) SERVICES=(frontend) ;;
  backend)  SERVICES=(backend) ;;
  all)      SERVICES=(backend frontend) ;;
  *) echo "استفاده: $0 [frontend|backend|all]" >&2; exit 2 ;;
esac

health_url() {
  case "$1" in
    backend)  echo "http://127.0.0.1:8000/api/v1/taxonomy/categories/" ;;
    frontend) echo "http://127.0.0.1:3000/" ;;
  esac
}

wait_healthy() {
  local svc="$1" url tries=60
  url="$(health_url "$svc")"
  while [ "$tries" -gt 0 ]; do
    if curl -fsS -m 5 -o /dev/null "$url"; then return 0; fi
    tries=$((tries - 1)); sleep 2
  done
  return 1
}

echo "==> ۱) بکاپ دیتابیس قبل از دیپلوی"
BACKUP_KIND=predeploy ./ops/backup.sh

echo "==> ۲) ذخیره‌ی نسخه‌ی فعلی (برچسب prev)"
for s in "${SERVICES[@]}"; do
  img="$(docker inspect -f '{{.Image}}' "4sogh_${s}" 2>/dev/null || true)"
  if [ -n "$img" ]; then
    docker tag "$img" "4sogh-${s}:prev"
    echo "    4sogh-${s}:prev <- ${img:0:19}"
  else
    echo "    هشدار: کانتینر 4sogh_${s} در حال اجرا نیست؛ برای $s برگشتی وجود نخواهد داشت"
  fi
done

BUILD_FLAGS=()
[ "${NO_CACHE:-0}" = "1" ] && BUILD_FLAGS+=(--no-cache)

failed=0
for s in "${SERVICES[@]}"; do
  echo "==> ۳) بیلد و اجرای $s"
  if ! $COMPOSE build ${BUILD_FLAGS[@]+"${BUILD_FLAGS[@]}"} "$s"; then
    echo "!! بیلد $s شکست خورد؛ نسخه‌ی در حال اجرا دست‌نخورده است."
    failed=1; break
  fi
  $COMPOSE up -d --no-deps "$s"

  echo "==> ۴) چک سلامت $s"
  if wait_healthy "$s"; then
    echo "    $s سالم است"
  else
    echo "!! $s بعد از دیپلوی جواب نمی‌دهد"
    failed=1
    echo "==> برگشت $s به نسخه‌ی قبل"
    if docker image inspect "4sogh-${s}:prev" >/dev/null 2>&1; then
      docker tag "4sogh-${s}:prev" "4sogh-${s}:latest"
      $COMPOSE up -d --no-deps --force-recreate "$s"
      if wait_healthy "$s"; then echo "    برگشت موفق بود؛ نسخه‌ی قبلی دوباره بالاست."
      else echo "!! بعد از برگشت هم $s جواب نمی‌دهد؛ لاگ: $COMPOSE logs --tail 50 $s"; fi
    else
      echo "!! نسخه‌ی prev وجود ندارد؛ لاگ: $COMPOSE logs --tail 50 $s"
    fi
    break
  fi
done

if [ "$failed" = "1" ]; then
  echo "دیپلوی ناموفق بود."
  exit 1
fi

# پاک‌سازی بعد از دیپلوی موفق: ایمیج‌های رهاشده (بدون برچسب) و کش بیلدِ قدیمی‌تر از ۲۴ ساعت.
# ایمیج‌های برچسب‌دار (از جمله :prev برای برگشت)، کانتینرها و حجم‌های داده (دیتابیس) دست‌نخورده می‌مانند.
echo "==> ۵) پاک‌سازی ایمیج‌های رهاشده و کش بیلد قدیمی"
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter "until=24h" >/dev/null 2>&1 || true
echo "    فضای آزاد دیسک: $(df -h / | awk 'NR==2{print $4}')"

echo "دیپلوی با موفقیت انجام شد."
