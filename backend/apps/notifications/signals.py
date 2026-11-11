"""
ساخت خودکار اعلان‌ها با سیگنال‌های جنگو.
به این ترتیب نیازی به تغییر viewهای موجود نیست: هر جا رکوردی ذخیره شود
(از API، پنل ادمین جنگو یا اسکریپت)، اعلانش ساخته می‌شود.
"""
from django.contrib.auth import get_user_model
from django.db.models.signals import m2m_changed, post_save, pre_save
from django.dispatch import receiver

from apps.directory.models import (
    Business, BusinessRequest, CampaignUsage, DiscountCampaign, Review, TransactionLog,
)

from .models import Notification
from .services import fa_money, mask_phone, notify, notify_admins, to_fa_digits

User = get_user_model()
C = Notification.Category

# کاربران و کسب‌وکارهای دکمه‌ی «دیتای دمو» اعلان نمی‌سازند
DEMO_PHONE_PREFIX = '0999000'


def _is_demo_user(user):
    return str(getattr(user, 'phone_number', '') or '').startswith(DEMO_PHONE_PREFIX)


def _is_demo_business(business):
    return str(getattr(business, 'slug', '') or '').startswith('demo-')


def _remember_old(sender, instance, fields):
    """مقدار قبلی چند فیلد را روی instance نگه می‌دارد تا در post_save تغییرشان را تشخیص دهیم"""
    if not instance.pk:
        instance._old = {}
        return
    old = sender.objects.filter(pk=instance.pk).values(*fields).first()
    instance._old = old or {}


# ------------------------------------------------------------------
# کاربر جدید → خوش‌آمدگویی برای کاربر + اطلاع به ادمین
# ------------------------------------------------------------------
@receiver(post_save, sender=User)
def on_user_created(sender, instance, created, **kwargs):
    if not created or kwargs.get('raw') or _is_demo_user(instance):
        return
    if instance.is_staff or getattr(instance, 'role', '') == 'ADMIN':
        return
    notify(
        instance, C.WELCOME, 'به چهارسوق خوش آمدید 🎉',
        'تخفیف‌های امروز کسب‌وکارهای شهرتان را ببینید و کد اختصاصی بگیرید.',
        '/daily-discounts',
    )
    notify_admins(C.USER, 'کاربر جدید ثبت‌نام کرد', f"شماره: {mask_phone(instance.phone_number)}", '/admin-panel')


# ------------------------------------------------------------------
# کسب‌وکار: ثبت جدید (به ادمین) و تغییر وضعیت تأیید (به صاحب کسب‌وکار)
# ------------------------------------------------------------------
@receiver(pre_save, sender=Business)
def business_pre_save(sender, instance, **kwargs):
    _remember_old(sender, instance, ['is_verified'])


@receiver(post_save, sender=Business)
def on_business_saved(sender, instance, created, **kwargs):
    if kwargs.get('raw') or _is_demo_business(instance):
        return
    if created:
        if not instance.is_verified:
            notify_admins(
                C.BUSINESS, 'کسب‌وکار جدید منتظر تأیید',
                f"«{instance.name}» ثبت شد و منتظر بررسی است.", '/admin-panel',
            )
        return
    old = getattr(instance, '_old', {})
    if 'is_verified' in old and old['is_verified'] != instance.is_verified and instance.owner_id:
        if instance.is_verified:
            notify(instance.owner_id, C.BUSINESS, 'کسب‌وکار شما تأیید شد ✅',
                   f"«{instance.name}» حالا با نشان تأیید در چهارسوق نمایش داده می‌شود.", '/dashboard/owner')
        else:
            notify(instance.owner_id, C.BUSINESS, 'تأیید کسب‌وکار شما لغو شد',
                   f"تأیید «{instance.name}» توسط مدیریت لغو شد. برای پیگیری با پشتیبانی تماس بگیرید.", '/dashboard/owner')


# ------------------------------------------------------------------
# نظر: نظر جدید (به صاحب کسب‌وکار، و امتیاز ۱ به ادمین) — پاسخ صاحب کسب‌وکار (به نویسنده‌ی نظر)
# ------------------------------------------------------------------
@receiver(pre_save, sender=Review)
def review_pre_save(sender, instance, **kwargs):
    _remember_old(sender, instance, ['owner_reply'])


@receiver(post_save, sender=Review)
def on_review_saved(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    business = instance.business
    if created:
        stars = to_fa_digits(instance.rating)
        if business.owner_id and business.owner_id != instance.user_id:
            notify(business.owner_id, C.REVIEW, f"نظر جدید ({stars} ستاره)",
                   f"یک مشتری برای «{business.name}» نظر ثبت کرد.", '/dashboard/owner/reviews')
        if instance.rating == 1:
            notify_admins(C.REVIEW, 'نظر با امتیاز ۱ ثبت شد',
                          f"برای «{business.name}» — بررسی کنید.", f"/business/{business.slug}")
        return
    old_reply = (getattr(instance, '_old', {}) or {}).get('owner_reply')
    if instance.owner_reply and instance.owner_reply != old_reply and instance.user_id:
        notify(instance.user_id, C.REPLY, 'به نظر شما پاسخ داده شد',
               f"«{business.name}» به نظر شما جواب داد.", f"/business/{business.slug}")


# ------------------------------------------------------------------
# دنبال‌کننده‌ی جدید (فروشگاه‌های منتخب)
# ------------------------------------------------------------------
@receiver(m2m_changed, sender=Business.followers.through)
def on_follow(sender, instance, action, reverse, pk_set, **kwargs):
    if action != 'post_add' or not pk_set:
        return
    if not reverse:
        # business.followers.add(user, ...)
        if instance.owner_id and not _is_demo_business(instance):
            count = len(pk_set - {instance.owner_id})
            if count:
                notify(instance.owner_id, C.FOLLOW, 'دنبال‌کننده‌ی جدید',
                       f"{to_fa_digits(count)} نفر «{instance.name}» را به فروشگاه‌های منتخب اضافه کردند.",
                       '/dashboard/owner')
    else:
        # user.favorite_businesses.add(business, ...)
        for biz in Business.objects.filter(pk__in=pk_set).exclude(owner=instance).only('name', 'owner_id', 'slug'):
            if biz.owner_id and not _is_demo_business(biz):
                notify(biz.owner_id, C.FOLLOW, 'دنبال‌کننده‌ی جدید',
                       f"یک نفر «{biz.name}» را به فروشگاه‌های منتخب اضافه کرد.", '/dashboard/owner')


# ------------------------------------------------------------------
# کد تخفیف: دریافت (به مشتری و صاحب کسب‌وکار)، استفاده شدن (به مشتری)
# ------------------------------------------------------------------
@receiver(pre_save, sender=CampaignUsage)
def usage_pre_save(sender, instance, **kwargs):
    _remember_old(sender, instance, ['is_redeemed'])


@receiver(post_save, sender=CampaignUsage)
def on_usage_saved(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    campaign = instance.campaign
    business = campaign.business
    if created:
        notify(instance.client_id, C.CAMPAIGN, 'کد تخفیف دریافت شد 🎟️',
               f"کد {campaign.code} برای «{business.name}» به پنل شما اضافه شد.", '/dashboard/client')
        if business.owner_id and not _is_demo_business(business):
            notify(business.owner_id, C.CAMPAIGN, 'کد تخفیف شما دریافت شد',
                   f"یک مشتری کد {campaign.code} را دریافت کرد.", '/dashboard/owner/campaigns')
        return
    old = getattr(instance, '_old', {}) or {}
    if instance.is_redeemed and old.get('is_redeemed') is False:
        notify(instance.client_id, C.CAMPAIGN, 'کد تخفیف شما استفاده شد',
               f"کد {campaign.code} در «{business.name}» اعمال شد.", '/dashboard/client')


@receiver(pre_save, sender=DiscountCampaign)
def campaign_pre_save(sender, instance, **kwargs):
    _remember_old(sender, instance, ['current_usage'])


@receiver(post_save, sender=DiscountCampaign)
def on_campaign_saved(sender, instance, created, **kwargs):
    if created or kwargs.get('raw'):
        return
    old_usage = (getattr(instance, '_old', {}) or {}).get('current_usage')
    business = instance.business
    if (old_usage is not None and old_usage < instance.max_usage <= instance.current_usage
            and business.owner_id and not _is_demo_business(business)):
        notify(business.owner_id, C.CAMPAIGN, 'ظرفیت کمپین تکمیل شد',
               f"همه‌ی {to_fa_digits(instance.max_usage)} کد «{instance.code}» دریافت شدند. برای ادامه کمپین جدید بسازید.",
               '/dashboard/owner/campaigns')


# ------------------------------------------------------------------
# ثبت خرید توسط فروشنده → اطلاع به مشتری
# (اگر کسی با شماره‌ی مشتری تراکنش جعلی ثبت کند، مشتری متوجه می‌شود)
# ------------------------------------------------------------------
@receiver(post_save, sender=TransactionLog)
def on_transaction_created(sender, instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return
    pct = instance.applied_discount_percentage
    discount_txt = f" با {to_fa_digits(pct)}٪ تخفیف" if pct else ''
    msg = f"مبلغ پرداختی: {fa_money(instance.final_amount)} تومان{discount_txt}."
    if instance.discount_source == 'CAMPAIGN':
        msg += ' کد تخفیف شما در این خرید استفاده شد.'
    msg += ' اگر این خرید را انجام نداده‌اید به پشتیبانی اطلاع دهید.'
    notify(instance.customer_id, C.TRANSACTION, f"خرید شما در «{instance.business.name}» ثبت شد", msg, '/dashboard/client')


# ------------------------------------------------------------------
# درخواست امکانات ویژه: جدید (به ادمین)، تأیید (به صاحب کسب‌وکار)
# ------------------------------------------------------------------
@receiver(pre_save, sender=BusinessRequest)
def request_pre_save(sender, instance, **kwargs):
    _remember_old(sender, instance, ['is_approved'])


@receiver(post_save, sender=BusinessRequest)
def on_request_saved(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    business = instance.business
    if created:
        notify_admins(C.REQUEST, f"درخواست جدید: {instance.get_request_type_display()}",
                      f"از طرف «{business.name}»", '/admin-panel')
        return
    old = getattr(instance, '_old', {}) or {}
    if instance.is_approved and old.get('is_approved') is False and business.owner_id:
        notify(business.owner_id, C.REQUEST, 'درخواست شما تأیید شد 🚀',
               f"«{instance.get_request_type_display()}» برای «{business.name}» تأیید شد.", '/dashboard/owner/requests')
