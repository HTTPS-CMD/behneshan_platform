"""
انقضای اعتبارهای سررسیده برای همه‌ی مشتریان.
اختیاری است (انقضا موقع هر خرید/نمایش هم خودکار انجام می‌شود)؛ برای گزارش دقیق می‌توانید روزانه با cron اجرا کنید:
    python manage.py expire_cashback
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.loyalty.models import StoreCustomer, WalletEntry
from apps.loyalty.services import expire_due_credit


class Command(BaseCommand):
    help = "کم کردن اعتبارهای منقضی‌شده‌ی باشگاه مشتریان"

    def handle(self, *args, **options):
        ids = (WalletEntry.objects.filter(remaining__gt=0, expires_at__lte=timezone.now())
               .values_list('customer_id', flat=True).order_by().distinct())
        total = 0
        for cid in ids:
            with transaction.atomic():
                customer = StoreCustomer.objects.select_for_update().get(pk=cid)
                total += expire_due_credit(customer)
        self.stdout.write(self.style.SUCCESS(f"{total:,} تومان اعتبار منقضی شد."))
