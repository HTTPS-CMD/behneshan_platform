#!/usr/bin/env bash
# عامل سرور چهارسوق: هر دقیقه با کرون اجرا می‌شود (بیرون از داکر).
#  ۱) وضعیت سرویس‌ها را در opsdata/status/health.json می‌نویسد
#  ۲) ۲۰۰ خط آخر لاگ بک‌اند را (بعد از حذف توکن و شماره) در opsdata/logs/backend.log می‌گذارد
#  ۳) اگر از پنل «بکاپ دستی» خواسته شده باشد (opsdata/requests/backup.req)، backup.sh را اجرا می‌کند
# این اسکریپت فقط اسکریپت‌های ثابت خودمان را اجرا می‌کند و از محتوای فایل درخواست چیزی نمی‌خواند.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"
OPS_DATA="${OPS_DATA:-$PROJECT_DIR/opsdata}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/4sogh}"
API_URL="${API_URL:-http://127.0.0.1:8000/api/v1/taxonomy/categories/}"
FRONT_URL="${FRONT_URL:-http://127.0.0.1:3000/}"
DB_CONTAINER="${DB_CONTAINER:-4sogh_db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-4sogh_redis}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-4sogh_backend}"
LOG_LINES="${LOG_LINES:-200}"
export BACKUP_DIR

mkdir -p "$OPS_DATA/status" "$OPS_DATA/logs" "$OPS_DATA/requests"
chmod 755 "$OPS_DATA" "$OPS_DATA/status" "$OPS_DATA/logs"
chmod 777 "$OPS_DATA/requests"   # بک‌اند (داخل کانتینر) فقط اینجا فایل خالی می‌سازد

# جلوگیری از اجرای هم‌زمان دو نسخه
exec 9>"$OPS_DATA/.agent.lock"
flock -n 9 || exit 0

atomic_write() { # atomic_write <مقصد>  (ورودی از stdin)
  local dest="$1" tmp
  tmp="$(mktemp "$dest.XXXXXX")"
  cat > "$tmp" && chmod 644 "$tmp" && mv -f "$tmp" "$dest"
}

http_probe() { # http_probe <url> -> "کد میلی‌ثانیه"
  local out code t
  out="$(curl -s -o /dev/null -m 5 -w '%{http_code} %{time_total}' "$1" 2>/dev/null || echo '000 0')"
  code="${out%% *}"; t="${out##* }"
  printf '%s %s' "$code" "$(awk -v t="$t" 'BEGIN{printf "%d", t*1000}')"
}

# ---------- ۱) سلامت ----------
read -r api_code api_ms < <(http_probe "$API_URL")
read -r front_code front_ms < <(http_probe "$FRONT_URL")

db_ok=0;    docker exec "$DB_CONTAINER" sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 && db_ok=1
redis_ok=0; [ "$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)" = "PONG" ] && redis_ok=1

containers="$(docker ps -a --filter 'name=4sogh_' --format '{{.Names}}|{{.State}}|{{.Status}}' 2>/dev/null || true)"
disk="$(df -Pk "$PROJECT_DIR" | awk 'NR==2{gsub("%","",$5); printf "%s %d", $5, $4/1024/1024}')"   # درصد مصرف، گیگابایت آزاد
last_dump="$(ls -t "$BACKUP_DIR"/4sogh_*.dump 2>/dev/null | head -n1 || true)"

API_CODE="$api_code" API_MS="$api_ms" FRONT_CODE="$front_code" FRONT_MS="$front_ms" \
DB_OK="$db_ok" REDIS_OK="$redis_ok" CONTAINERS="$containers" DISK="$disk" LAST_DUMP="$last_dump" \
python3 - <<'PY' | atomic_write "$OPS_DATA/status/health.json"
import json, os, time

def probe(code, ms):
    code = int(code)
    return {"ok": 200 <= code < 400, "code": code, "ms": int(ms)}

disk = os.environ.get("DISK", "").split()
containers = []
for line in os.environ.get("CONTAINERS", "").splitlines():
    parts = line.split("|", 2)
    if len(parts) == 3:
        containers.append({"name": parts[0], "state": parts[1], "status": parts[2]})

last = None
path = os.environ.get("LAST_DUMP", "")
if path and os.path.isfile(path):
    st = os.stat(path)
    last = {"name": os.path.basename(path), "size": st.st_size, "modified": int(st.st_mtime)}

print(json.dumps({
    "generated_at": time.time(),
    "checks": {
        "api": probe(os.environ["API_CODE"], os.environ["API_MS"]),
        "frontend": probe(os.environ["FRONT_CODE"], os.environ["FRONT_MS"]),
        "database": {"ok": os.environ["DB_OK"] == "1"},
        "redis": {"ok": os.environ["REDIS_OK"] == "1"},
    },
    "disk": {"used_percent": int(disk[0]), "free_gb": int(disk[1])} if len(disk) == 2 else None,
    "containers": containers,
    "last_backup": last,
}, ensure_ascii=False))
PY

# ---------- ۲) لاگ (بدون توکن و شماره) ----------
docker logs --tail "$LOG_LINES" "$BACKEND_CONTAINER" 2>&1 \
  | sed -E \
      -e 's/Bearer[[:space:]]+[A-Za-z0-9._-]+/Bearer ***/g' \
      -e 's/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/***jwt***/g' \
      -e 's/\b(09[0-9]{2})[0-9]{4}([0-9]{3})\b/\1****\2/g' \
      -e 's/((token|secret|password|api[_-]?key)["'"'"'=: ]+)[^ "'"'"',}]+/\1***/Ig' \
  | atomic_write "$OPS_DATA/logs/backend.log"

# ---------- ۳) درخواست بکاپ دستی ----------
REQ="$OPS_DATA/requests/backup.req"
if [ -e "$REQ" ]; then
  rm -f "$REQ"
  (
    exec 8>"$OPS_DATA/.backup.lock"
    flock -n 8 || exit 0
    started="$(date +%s)"
    if "$SCRIPT_DIR/backup.sh" >> "${BACKUP_LOG:-/var/log/4sogh-backup.log}" 2>&1; then
      ok=true; msg="بکاپ با موفقیت انجام شد"
    else
      ok=false; msg="بکاپ ناموفق بود؛ لاگ سرور را ببینید"
    fi
    printf '{"ok": %s, "message": "%s", "started_at": %s, "finished_at": %s}\n' \
      "$ok" "$msg" "$started" "$(date +%s)" | atomic_write "$OPS_DATA/status/last_backup_request.json"
  ) </dev/null >/dev/null 2>&1 &
  disown
fi
