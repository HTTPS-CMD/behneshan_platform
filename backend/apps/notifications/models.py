from django.conf import settings
from django.db import models


class Notification(models.Model):
    """یک اعلان برای یک کاربر (ادمین، مشتری یا صاحب کسب‌وکار)"""

    class Category(models.TextChoices):
        SYSTEM = 'SYSTEM', 'سیستمی'
        WELCOME = 'WELCOME', 'خوش‌آمدگویی'
        REVIEW = 'REVIEW', 'نظر'
        REPLY = 'REPLY', 'پاسخ به نظر'
        FOLLOW = 'FOLLOW', 'دنبال‌کننده'
        CAMPAIGN = 'CAMPAIGN', 'کد تخفیف'
        TRANSACTION = 'TRANSACTION', 'خرید'
        BUSINESS = 'BUSINESS', 'کسب‌وکار'
        REQUEST = 'REQUEST', 'درخواست ویژه'
        USER = 'USER', 'کاربر جدید'
        BROADCAST = 'BROADCAST', 'اطلاعیه'

    id = models.BigAutoField(primary_key=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications', verbose_name='گیرنده',
    )
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.SYSTEM, verbose_name='نوع')
    title = models.CharField(max_length=150, verbose_name='عنوان')
    message = models.TextField(blank=True, default='', verbose_name='متن')
    # فقط مسیر داخلی سایت (مثل /dashboard/owner) — لینک خارجی پذیرفته نمی‌شود
    link = models.CharField(max_length=255, blank=True, default='', verbose_name='لینک')
    is_read = models.BooleanField(default=False, verbose_name='خوانده شده')
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='زمان')
    broadcast = models.ForeignKey(
        'Broadcast', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications',
    )

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['recipient', 'is_read', '-created_at'], name='notif_recipient_unread_idx')]
        verbose_name = 'اعلان'
        verbose_name_plural = 'اعلان‌ها'

    def __str__(self):
        return f"{self.title} → {self.recipient}"


class Broadcast(models.Model):
    """اعلان همگانی که ادمین از پنل می‌فرستد (برای تاریخچه)"""

    class Audience(models.TextChoices):
        ALL = 'ALL', 'همه‌ی کاربران'
        CLIENTS = 'CLIENTS', 'فقط مشتری‌ها'
        OWNERS = 'OWNERS', 'فقط صاحبان کسب‌وکار'

    id = models.BigAutoField(primary_key=True)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.ALL, verbose_name='مخاطب')
    title = models.CharField(max_length=150, verbose_name='عنوان')
    message = models.TextField(blank=True, default='', verbose_name='متن')
    link = models.CharField(max_length=255, blank=True, default='', verbose_name='لینک')
    recipients_count = models.PositiveIntegerField(default=0, verbose_name='تعداد گیرندگان')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'اعلان همگانی'
        verbose_name_plural = 'اعلان‌های همگانی'

    def __str__(self):
        return f"{self.title} ({self.get_audience_display()})"
