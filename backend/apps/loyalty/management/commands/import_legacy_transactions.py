"""
انتقال خریدهای ثبت‌شده در «پذیرش مشتری» (CRM قدیمی) به تاریخچه‌ی باشگاه مشتریان.
- هیچ داده‌ای پاک یا تغییر داده نمی‌شود؛ فقط رکورد باشگاه ساخته و به تراکنش قدیمی وصل می‌شود.
- کش‌بک و طرح تشویقی برای این خریدها صادر نمی‌شود.
- چند بار اجرا کردن مشکلی ندارد (تراکنش‌های منتقل‌شده دوباره منتقل نمی‌شوند).
    python manage.py import_legacy_transactions
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.directory.models import TransactionLog
from apps.loyalty.models import Purchase, StoreCustomer
from apps.loyalty.services import get_or_create_customer


class Command(BaseCommand):
    help = "انتقال خریدهای CRM قدیمی به باشگاه مشتریان"

    def handle(self, *args, **options):
        logs = (TransactionLog.objects.filter(loyalty_purchase__isnull=True)
                .select_related('business', 'customer').order_by('created_at'))
        moved = 0
        for log in logs.iterator():
            if not log.customer or not log.customer.phone_number:
                continue
            with transaction.atomic():
                customer, _ = get_or_create_customer(log.business, log.customer.phone_number, '', StoreCustomer.Source.PURCHASE)
                customer = StoreCustomer.objects.select_for_update().get(pk=customer.pk)
                original = int(log.original_amount)
                final = int(log.final_amount)
                Purchase.objects.create(
                    business=log.business, customer=customer, original_amount=original,
                    discount_percent=log.applied_discount_percentage or 0,
                    discount_source=log.discount_source if log.discount_source in Purchase.DiscountSource.values else 'NONE',
                    discount_amount=max(0, original - final), final_amount=final, verified=True,
                    source=Purchase.Source.LEGACY, transaction_log=log, purchased_at=log.created_at,
                    note="منتقل‌شده از پذیرش مشتری (قدیمی)",
                )
                when = log.created_at
                customer.purchase_count += 1
                customer.total_purchase_amount += original
                if not customer.first_purchase_at or when < customer.first_purchase_at:
                    customer.first_purchase_at = when
                if not customer.last_purchase_at or when > customer.last_purchase_at:
                    customer.last_purchase_at = when
                customer.save(update_fields=['purchase_count', 'total_purchase_amount', 'first_purchase_at',
                                             'last_purchase_at', 'updated_at'])
                moved += 1
        self.stdout.write(self.style.SUCCESS(f"{moved} خرید قدیمی به باشگاه مشتریان منتقل شد."))
