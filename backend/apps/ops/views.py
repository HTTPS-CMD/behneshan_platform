"""سلامت سیستم و بکاپ (پنل مدیریت)

این اپ هیچ دستوری اجرا نمی‌کند و به docker دسترسی ندارد:
- وضعیت و لاگ را از فایل‌هایی می‌خواند که اسکریپت agent.sh روی سرور (بیرون از داکر) می‌نویسد.
- «بکاپ دستی» فقط یک فایل خالی با نام ثابت می‌سازد؛ agent.sh آن را می‌بیند و backup.sh را اجرا می‌کند.
"""
import json
import logging
import os
import re
import time

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger("apps.ops")

# فقط همین الگوها قابل لیست و دانلودند (جلوگیری از خواندن فایل دلخواه)
BACKUP_NAME_RE = re.compile(r"^(4sogh_\d{4}-\d{2}-\d{2}_\d{4}\.dump|media_\d{4}-\d{2}-\d{2}_\d{4}\.tgz)$")
STALE_AFTER = 180  # ثانیه؛ بیشتر از این یعنی agent.sh کار نمی‌کند

# حذف داده‌ی حساس از لاگ (لایه‌ی دوم؛ لایه‌ی اول داخل agent.sh است)
_REDACT = [
    (re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.I), "Bearer ***"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*"), "***jwt***"),
    (re.compile(r"\b(09\d{2})\d{4}(\d{3})\b"), r"\1****\2"),
    (re.compile(r"((?:token|secret|password|api[_-]?key)[\"'=:\s]+)[^\s\"',}]+", re.I), r"\1***"),
]


def _redact(text: str) -> str:
    for pattern, repl in _REDACT:
        text = pattern.sub(repl, text)
    return text


def _data_dir() -> str:
    return getattr(settings, "OPS_DATA_DIR", "/opsdata")


def _backup_dir() -> str:
    return getattr(settings, "OPS_BACKUP_DIR", "/backups")


def _read_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


class IsAdminReader(permissions.BasePermission):
    message = "این بخش فقط برای مدیر سایت است."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or getattr(u, "role", None) == "ADMIN"))


class IsSuperuser(permissions.BasePermission):
    message = "این عملیات فقط برای مدیر کل (سوپریوزر) مجاز است."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class BackupRunThrottle(UserRateThrottle):
    scope = "ops_backup"
    rate = "5/hour"


class BackupDownloadThrottle(UserRateThrottle):
    scope = "ops_download"
    rate = "10/hour"


def _who(request) -> str:
    return f"user={request.user.pk}"


def _pending_request_path() -> str:
    return os.path.join(_data_dir(), "requests", "backup.req")


class HealthView(APIView):
    """وضعیت سرویس‌ها؛ نوشته‌ی agent.sh (حداکثر ۱ دقیقه قدیمی)"""
    permission_classes = [IsAdminReader]

    def get(self, request):
        data = _read_json(os.path.join(_data_dir(), "status", "health.json"))
        if not data:
            return Response({"available": False, "stale": True, "pending_backup": False})
        age = max(0, int(time.time() - float(data.get("generated_at", 0))))
        data.update({
            "available": True,
            "age_seconds": age,
            "stale": age > STALE_AFTER,
            "pending_backup": os.path.exists(_pending_request_path()),
            "last_backup_request": _read_json(os.path.join(_data_dir(), "status", "last_backup_request.json")),
        })
        return Response(data)


class BackupListView(APIView):
    permission_classes = [IsAdminReader]

    def get(self, request):
        items = []
        try:
            names = os.listdir(_backup_dir())
        except OSError:
            names = []
        for name in names:
            if not BACKUP_NAME_RE.match(name):
                continue
            try:
                st = os.stat(os.path.join(_backup_dir(), name))
            except OSError:
                continue
            items.append({
                "name": name,
                "kind": "media" if name.startswith("media_") else "database",
                "size": st.st_size,
                "modified": int(st.st_mtime),
            })
        items.sort(key=lambda i: i["modified"], reverse=True)
        return Response({
            "results": items,
            "can_manage": bool(request.user.is_superuser),
            "pending_backup": os.path.exists(_pending_request_path()),
        })


class BackupRunView(APIView):
    """درخواست بکاپ دستی؛ فقط یک فایل خالی با نام ثابت می‌سازد"""
    permission_classes = [IsSuperuser]
    throttle_classes = [BackupRunThrottle]

    def post(self, request):
        path = _pending_request_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
        except FileExistsError:
            return Response({"error": "یک درخواست بکاپ در صف است؛ کمی صبر کنید."}, status=status.HTTP_409_CONFLICT)
        except OSError:
            logger.exception("ops: cannot create backup request")
            return Response({"error": "ثبت درخواست ممکن نشد. پوشه‌ی opsdata را بررسی کنید."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        logger.warning("ops: manual backup requested %s", _who(request))
        return Response({"queued": True}, status=status.HTTP_202_ACCEPTED)


class BackupDownloadView(APIView):
    permission_classes = [IsSuperuser]
    throttle_classes = [BackupDownloadThrottle]

    def get(self, request, name):
        if not BACKUP_NAME_RE.match(name):
            raise Http404
        base = os.path.realpath(_backup_dir())
        full = os.path.realpath(os.path.join(base, name))
        if os.path.dirname(full) != base or not os.path.isfile(full):
            raise Http404
        logger.warning("ops: backup download %s file=%s", _who(request), name)
        resp = FileResponse(open(full, "rb"), as_attachment=True, filename=name)
        resp["Cache-Control"] = "no-store"
        return resp


class LogsView(APIView):
    permission_classes = [IsAdminReader]

    def get(self, request):
        try:
            lines = max(10, min(200, int(request.query_params.get("lines", 100))))
        except ValueError:
            lines = 100
        path = os.path.join(_data_dir(), "logs", "backend.log")
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                tail = fh.readlines()[-lines:]
            updated = int(os.path.getmtime(path))
        except OSError:
            return Response({"available": False, "lines": [], "updated_at": None})
        return Response({
            "available": True,
            "lines": [_redact(line.rstrip("\n")) for line in tail],
            "updated_at": updated,
        })
