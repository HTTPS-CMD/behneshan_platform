"""
ارسال پیامک‌های در صف (پشتیبان ارسال پس‌زمینه). پیشنهاد: هر دقیقه با cron اجرا شود:
    * * * * * cd /path/to/backend && python manage.py process_sms_queue
"""
from django.core.management.base import BaseCommand

from apps.loyalty.sms import process_queue


class Command(BaseCommand):
    help = "ارسال پیامک‌های در صف سامانه پیامکی"

    def handle(self, *args, **options):
        total = 0
        while True:
            n = process_queue()
            total += n
            if not n:
                break
        self.stdout.write(self.style.SUCCESS(f"{total} پیامک پردازش شد."))
