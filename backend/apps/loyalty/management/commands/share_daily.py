"""
کارهای روزانه‌ی اشتراک‌گذاری (روزی یک بار با cron):
    python manage.py share_daily
- منقضی کردن کوپن‌های همکاری گذشته
- محاسبه‌ی سطح همه‌ی فروشگاه‌ها در باشگاه پذیرندگان (برای نشان «دکان برتر»)
"""
from django.core.management.base import BaseCommand

from apps.loyalty.share import expire_vouchers, refresh_all_levels


class Command(BaseCommand):
    help = "منقضی کردن کوپن‌های همکاری و به‌روزرسانی سطح فروشگاه‌ها"

    def handle(self, *args, **options):
        expired = expire_vouchers()
        levels = refresh_all_levels()
        self.stdout.write(self.style.SUCCESS(f"{expired} کوپن منقضی شد؛ سطح {levels} فروشگاه به‌روز شد."))
