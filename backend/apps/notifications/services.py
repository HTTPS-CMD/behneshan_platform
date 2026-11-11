"""
توابع کمکی ساخت اعلان.
همه‌ی اعلان‌ها بعد از commit شدن تراکنش دیتابیس ساخته می‌شوند و خطای آن‌ها
هیچ‌وقت عملیات اصلی (ثبت نظر، تراکنش، ثبت‌نام و ...) را خراب نمی‌کند.
"""
import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, QuerySet

from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def safe_link(link):
    """فقط مسیرهای داخلی سایت مجازند (جلوگیری از لینک javascript: یا سایت فیشینگ)"""
    link = (link or '').strip()
    if link.startswith('/') and not link.startswith('//'):
        return link[:255]
    return ''


def _create(recipient_ids, category, title, message='', link=''):
    rows = [
        Notification(
            recipient_id=uid, category=category,
            title=title[:150], message=message or '', link=safe_link(link),
        )
        for uid in recipient_ids
    ]
    if rows:
        Notification.objects.bulk_create(rows, batch_size=1000)


def notify(recipients, category, title, message='', link=''):
    """
    ساخت اعلان برای یک یا چند کاربر.
    recipients: یک کاربر، یا لیستی از کاربر/شناسه‌ی کاربر
    """
    if recipients is None:
        return
    if not isinstance(recipients, (list, tuple, set, QuerySet)):
        recipients = [recipients]
    # تبدیل کاربر یا شناسه به شناسه، حذف تکراری‌ها و خالی‌ها
    ids = {getattr(r, 'pk', r) for r in recipients if r is not None}
    ids.discard(None)
    if not ids:
        return

    def _run():
        try:
            _create(ids, category, title, message, link)
        except Exception:
            logger.exception("Failed to create notification: %s", title)

    transaction.on_commit(_run)


def admin_users():
    return User.objects.filter(Q(is_staff=True) | Q(role='ADMIN'), is_active=True).values_list('pk', flat=True)


def notify_admins(category, title, message='', link=''):
    notify(list(admin_users()), category, title, message, link)


def mask_phone(phone):
    phone = str(phone or '')
    return f"{phone[:4]}***{phone[-4:]}" if len(phone) >= 8 else phone


def to_fa_digits(value):
    return str(value).translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))


def fa_money(amount):
    try:
        return to_fa_digits(f"{int(amount):,}").replace(',', '٬')
    except (TypeError, ValueError):
        return to_fa_digits(amount)
