"""
اجرای روزانه‌ی طرح‌های تشویقی (تولد، سالگرد، فراموشی) برای همه‌ی کسب‌وکارها.
پیشنهاد: روزی یک بار با cron روی سرور اجرا شود:
    python manage.py run_incentives
(بدون cron هم، با باز شدن پنل فروشنده یا مشتری، روزی یک بار خودکار اجرا می‌شود.)
"""
from django.core.management.base import BaseCommand

from apps.directory.models import Business
from apps.loyalty.incentives import run_incentives
from apps.loyalty.models import IncentivePlan


class Command(BaseCommand):
    help = "صدور هدیه‌های تولد، سالگرد و فراموشی"

    def handle(self, *args, **options):
        ids = (IncentivePlan.objects.filter(is_active=True).exclude(kind=IncentivePlan.Kind.FIRST_PURCHASE)
               .values_list('business_id', flat=True).order_by().distinct())
        total = 0
        for business in Business.objects.filter(pk__in=list(ids)):
            result = run_incentives(business)
            total += sum(result.values())
        self.stdout.write(self.style.SUCCESS(f"{total} هدیه صادر شد."))
