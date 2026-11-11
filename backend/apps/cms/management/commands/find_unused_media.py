"""
پیدا کردن فایل‌های آپلودی بی‌استفاده و تکراری در پوشه‌ی media.

    python manage.py find_unused_media            # فقط گزارش (هیچ فایلی تغییر نمی‌کند)
    python manage.py find_unused_media --move     # انتقال فایل‌های بی‌استفاده به media/_unused/

فایلی «بی‌استفاده» است که هیچ رکوردی در دیتابیس (هیچ ImageField/FileField در هیچ مدلی) به آن اشاره نکند.
به‌جای حذف، فایل‌ها به media/_unused/ منتقل می‌شوند تا اگر اشتباهی شد قابل برگشت باشد.
"""
import hashlib
import os
import shutil
from collections import defaultdict

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import models

UNUSED_DIR = '_unused'


def _referenced_files():
    used = set()
    for model in apps.get_models():
        file_fields = [f.name for f in model._meta.get_fields() if isinstance(f, models.FileField)]
        if not file_fields:
            continue
        for row in model.objects.values_list(*file_fields):
            for value in row:
                if value:
                    used.add(os.path.normpath(str(value)))
    return used


def _md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


class Command(BaseCommand):
    help = 'گزارش فایل‌های بی‌استفاده و تکراری media؛ با --move فایل‌های بی‌استفاده به media/_unused منتقل می‌شوند'

    def add_arguments(self, parser):
        parser.add_argument('--move', action='store_true', help='انتقال فایل‌های بی‌استفاده به media/_unused/')

    def handle(self, *args, **opts):
        root = str(settings.MEDIA_ROOT)
        used = _referenced_files()
        unused, by_hash = [], defaultdict(list)
        total_unused = 0

        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != UNUSED_DIR]
            for name in filenames:
                if name.startswith('.'):
                    continue
                full = os.path.join(dirpath, name)
                rel = os.path.normpath(os.path.relpath(full, root))
                by_hash[_md5(full)].append(rel)
                if rel not in used:
                    unused.append(rel)
                    total_unused += os.path.getsize(full)

        self.stdout.write(self.style.MIGRATE_HEADING(f"فایل‌های بی‌استفاده: {len(unused)} عدد ({total_unused / 1_048_576:.1f} MB)"))
        for rel in sorted(unused):
            self.stdout.write(f"  - {rel}")

        dups = [paths for paths in by_hash.values() if len(paths) > 1]
        self.stdout.write(self.style.MIGRATE_HEADING(f"\nگروه‌های فایل تکراری (محتوای یکسان): {len(dups)}"))
        for paths in dups:
            marks = ', '.join(f"{p}{'' if p in used else ' (بی‌استفاده)'}" for p in sorted(paths))
            self.stdout.write(f"  • {marks}")

        if not opts['move']:
            self.stdout.write(self.style.WARNING('\nچیزی منتقل نشد. برای انتقال فایل‌های بی‌استفاده: --move'))
            return

        for rel in unused:
            src = os.path.join(root, rel)
            dst = os.path.join(root, UNUSED_DIR, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
        self.stdout.write(self.style.SUCCESS(f"\n{len(unused)} فایل به media/{UNUSED_DIR}/ منتقل شد. بعد از اطمینان، آن پوشه را پاک کنید."))
