#!/usr/bin/env bash
# تست بازیابی: آخرین بکاپ را داخل یک دیتابیس موقت (restore_test) برمی‌گرداند و می‌شمارد؛
# دیتابیس اصلی (در حال استفاده‌ی سایت) را اصلاً لمس نمی‌کند. بعد از شمارش، دیتابیس موقت پاک می‌شود.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/4sogh}"
DB_CONTAINER="${DB_CONTAINER:-4sogh_db}"

latest="$(ls -1t "$BACKUP_DIR"/4sogh_*.dump 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  echo "هیچ بکاپی در $BACKUP_DIR پیدا نشد" >&2
  exit 1
fi
echo "آخرین بکاپ: $latest ($(du -h "$latest" | cut -f1))"

PGU="$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER)"

cleanup() {
  docker exec "$DB_CONTAINER" dropdb -U "$PGU" --if-exists restore_test >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$DB_CONTAINER" dropdb -U "$PGU" --if-exists restore_test
docker exec "$DB_CONTAINER" createdb -U "$PGU" restore_test
docker exec -i "$DB_CONTAINER" pg_restore -U "$PGU" -d restore_test --no-owner < "$latest"

echo "--- نتیجه‌ی بازیابی ---"
tables="$(docker exec "$DB_CONTAINER" psql -U "$PGU" -d restore_test -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
echo "تعداد جدول‌ها: $tables"
users="$(docker exec "$DB_CONTAINER" psql -U "$PGU" -d restore_test -Atc "select count(*) from identity_user" 2>/dev/null || echo "؟ (جدول identity_user پیدا نشد)")"
echo "تعداد کاربران: $users"
echo "بازیابی موفق بود و دیتابیس موقت پاک شد."
