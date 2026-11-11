"""
موتور طرح‌های تشویقی: اولین خرید، فراموشی (بازگشت مشتری)، تولد و سالگرد ازدواج.

- اولین خرید هنگام ثبت خرید اعمال می‌شود (services.preview_purchase / record_purchase).
- بقیه‌ی طرح‌ها با run_incentives هدیه صادر می‌کنند؛ این تابع روزی یک بار برای هر کسب‌وکار
  خودکار اجرا می‌شود (هنگام باز شدن پنل فروشنده یا پنل مشتری) و دستور run_incentives هم برای cron هست.
- هر هدیه به هر مشتری در هر دوره فقط یک بار داده می‌شود (UniqueConstraint روی period_key).
"""
import datetime
import logging
from decimal import ROUND_DOWN, Decimal

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone

from .jalali import gregorian_to_jalali, jalali_month_length
from .models import CustomerReward, IncentivePlan, StoreCustomer, WalletEntry

logger = logging.getLogger(__name__)

DISCOUNT_TYPES = (IncentivePlan.RewardType.PERCENT, IncentivePlan.RewardType.AMOUNT)
BIRTHDAY_GRACE_DAYS = 2  # اگر روز تولد اجرا نشد، تا ۲ روز بعد هم هدیه صادر می‌شود


def discount_amount_for(reward_type, value, max_discount, amount):
    """مبلغ تخفیف یک طرح/هدیه روی یک فاکتور"""
    if amount <= 0 or not value:
        return 0
    if reward_type == IncentivePlan.RewardType.PERCENT:
        pct = min(int(value), 100)
        d = int((Decimal(amount) * pct / 100).quantize(Decimal('1'), rounding=ROUND_DOWN))
        if max_discount:
            d = min(d, int(max_discount))
        return min(d, amount)
    if reward_type == IncentivePlan.RewardType.AMOUNT:
        return min(int(value), amount)
    return 0


def describe_reward(reward_type, value, max_discount=None, gift_text=''):
    if reward_type == IncentivePlan.RewardType.PERCENT:
        cap = f" (تا سقف {int(max_discount):,} تومان)" if max_discount else ''
        return f"{value}٪ تخفیف{cap}"
    if reward_type == IncentivePlan.RewardType.AMOUNT:
        return f"{int(value):,} تومان تخفیف"
    if reward_type == IncentivePlan.RewardType.CREDIT:
        return f"{int(value):,} تومان اعتبار کیف‌پول"
    return gift_text or "هدیه"


# ------------------------------------------------------------------ اولین خرید
def first_purchase_options(business, customer, amount):
    """
    برای مشتری‌ای که هنوز خریدی ثبت نکرده:
      best: (plan, discount_amount) بهترین تخفیف درصدی/مبلغی
      bonuses: طرح‌های اعتبار/هدیه‌ی کالایی که بعد از خرید داده می‌شوند
    """
    if customer.purchase_count:
        return None, []
    today = timezone.localdate()
    plans = [p for p in IncentivePlan.objects.filter(business=business, kind=IncentivePlan.Kind.FIRST_PURCHASE, is_active=True)
             if p.is_running(today) and amount >= p.min_purchase]
    best, best_amount = None, 0
    bonuses = []
    for p in plans:
        if p.reward_type in DISCOUNT_TYPES:
            d = discount_amount_for(p.reward_type, p.value, p.max_discount, amount)
            if d > best_amount:
                best, best_amount = p, d
        else:
            bonuses.append(p)
    return (best, best_amount) if best else None, bonuses


# ------------------------------------------------------------------ هدیه‌های فعال مشتری
def usable_rewards(customer):
    now = timezone.now()
    return list(
        CustomerReward.objects.filter(customer=customer, status=CustomerReward.Status.ACTIVE)
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .order_by('valid_until')
    )


def best_reward_discount(rewards, amount):
    best, best_amount = None, 0
    for r in rewards:
        if r.reward_type in DISCOUNT_TYPES and amount >= r.min_purchase:
            d = discount_amount_for(r.reward_type, r.value, r.max_discount, amount)
            if d > best_amount:
                best, best_amount = r, d
    return best, best_amount


# ------------------------------------------------------------------ صدور هدیه
def issue_reward(plan, customer, period_key, *, used_purchase=None, notify_user=True):
    """
    هدیه‌ی یک طرح را برای مشتری صادر می‌کند. اگر قبلاً در همین دوره داده شده باشد None برمی‌گرداند.
    اعتبار کیف‌پول همان لحظه به موجودی اضافه می‌شود. باید داخل transaction.atomic صدا زده شود.
    """
    from .services import _credit  # جلوگیری از import چرخه‌ای

    now = timezone.now()
    valid_until = now + datetime.timedelta(days=plan.valid_days) if plan.valid_days else None
    # قفل طرح تا سقف تعداد هدیه در اجرای هم‌زمان رد نشود
    fresh = IncentivePlan.objects.select_for_update().get(pk=plan.pk)
    if fresh.max_grants is not None and fresh.grants_count >= fresh.max_grants:
        return None
    try:
        with transaction.atomic():
            reward = CustomerReward.objects.create(
                customer=customer, plan=plan, kind=plan.kind, title=plan.title, reward_type=plan.reward_type,
                value=plan.value, max_discount=plan.max_discount, min_purchase=plan.min_purchase,
                gift_text=plan.gift_text, period_key=period_key, valid_until=valid_until,
            )
    except IntegrityError:
        return None  # در این دوره قبلاً هدیه گرفته است

    if plan.reward_type == IncentivePlan.RewardType.CREDIT:
        locked = StoreCustomer.objects.select_for_update().get(pk=customer.pk)
        entry = _credit(locked, int(plan.value), WalletEntry.Kind.GIFT, plan.valid_days,
                        purchase=used_purchase, note=plan.title)
        reward.status = CustomerReward.Status.USED
        reward.used_at = now
        reward.wallet_entry = entry
        reward.purchase = used_purchase
        reward.save(update_fields=['status', 'used_at', 'wallet_entry', 'purchase'])
    elif used_purchase is not None:
        reward.status = CustomerReward.Status.USED
        reward.used_at = now
        reward.purchase = used_purchase
        reward.save(update_fields=['status', 'used_at', 'purchase'])

    IncentivePlan.objects.filter(pk=plan.pk).update(grants_count=F('grants_count') + 1)

    if notify_user and customer.user_id and used_purchase is None:
        _notify_customer(customer, plan)
    if notify_user and used_purchase is None and plan.message:
        # پیامک هدیه (سامانه پیامکی) بعد از ثبت نهایی در دیتابیس
        from .sms import send_incentive_sms
        transaction.on_commit(lambda r=reward: send_incentive_sms(r))
    return reward


def _notify_customer(customer, plan):
    try:
        from apps.notifications.models import Notification
        from apps.notifications.services import notify
        business = customer.business
        title = f"🎁 هدیه از «{business.name}»"
        text = plan.message or f"{plan.title}: {describe_reward(plan.reward_type, plan.value, plan.max_discount, plan.gift_text)}"
        if plan.valid_days:
            text += f" — تا {plan.valid_days} روز معتبر است."
        notify(customer.user_id, Notification.Category.CAMPAIGN, title, text, '/dashboard/client')
    except Exception:
        logger.exception("Incentive notification failed")


# ------------------------------------------------------------------ اجرای طرح‌های زمان‌دار
def _jalali_window(today, days_before):
    """تاریخ‌های شمسی (ماه، روز) که امروز برایشان هدیه صادر می‌شود + سال شمسی هر مناسبت"""
    out = []
    for offset in range(-BIRTHDAY_GRACE_DAYS, days_before + 1):
        d = today + datetime.timedelta(days=offset)
        jy, jm, jd = gregorian_to_jalali(d.year, d.month, d.day)
        out.append((jy, jm, jd))
        # متولدین ۳۰ اسفند در سال‌های غیرکبیسه، ۲۹ اسفند هدیه می‌گیرند
        if jm == 12 and jd == 29 and jalali_month_length(jy, 12) == 29:
            out.append((jy, 12, 30))
    return out


def _run_dated(plan, today, month_field, day_field):
    issued = 0
    window = _jalali_window(today, plan.days_before)
    cond = Q()
    for _, jm, jd in window:
        cond |= Q(**{month_field: jm, day_field: jd})
    year_of = {(jm, jd): jy for jy, jm, jd in window}
    customers = StoreCustomer.objects.filter(business=plan.business_id).filter(cond)
    if plan.kind == IncentivePlan.Kind.ANNIVERSARY:
        customers = customers.filter(marital_status=StoreCustomer.Marital.MARRIED)
    for c in customers.iterator():
        if not plan.is_running(today):
            break
        jy = year_of.get((getattr(c, month_field), getattr(c, day_field)))
        if jy is None:
            continue
        with transaction.atomic():
            if issue_reward(plan, c, f"{plan.kind[:4]}-{jy}"):
                issued += 1
                plan.grants_count += 1
    return issued


def _run_winback(plan, today):
    issued = 0
    cutoff = timezone.now() - datetime.timedelta(days=plan.inactive_days or 60)
    # فقط مشتری‌هایی که بعد از راه‌اندازی طرح «غایب» شده‌اند؛ مشتری‌های قدیمیِ واردشده از اکسل/CRM یک‌جا هدیه نمی‌گیرند
    since = plan.created_at - datetime.timedelta(days=plan.inactive_days or 60)
    customers = StoreCustomer.objects.filter(
        business=plan.business_id, purchase_count__gt=0, last_purchase_at__lte=cutoff, last_purchase_at__gte=since,
    )
    for c in customers.iterator():
        if not plan.is_running(today):
            break
        # یک هدیه برای هر دوره‌ی غیبت (بعد از خرید بعدی، دوره‌ی جدید شروع می‌شود)
        key = f"WB-{timezone.localtime(c.last_purchase_at).date().isoformat()}"
        with transaction.atomic():
            if issue_reward(plan, c, key):
                issued += 1
                plan.grants_count += 1
    return issued


def run_incentives(business, today=None):
    """همه‌ی طرح‌های زمان‌دار یک کسب‌وکار را اجرا می‌کند. خروجی: تعداد هدیه‌ی صادرشده برای هر نوع"""
    today = today or timezone.localdate()
    result = {k: 0 for k in ('WINBACK', 'BIRTHDAY', 'ANNIVERSARY')}
    plans = IncentivePlan.objects.filter(business=business, is_active=True).exclude(kind=IncentivePlan.Kind.FIRST_PURCHASE)
    for plan in plans:
        if not plan.is_running(today):
            continue
        try:
            if plan.kind == IncentivePlan.Kind.WINBACK:
                result['WINBACK'] += _run_winback(plan, today)
            elif plan.kind == IncentivePlan.Kind.BIRTHDAY:
                result['BIRTHDAY'] += _run_dated(plan, today, 'birth_month', 'birth_day')
            elif plan.kind == IncentivePlan.Kind.ANNIVERSARY:
                result['ANNIVERSARY'] += _run_dated(plan, today, 'anniversary_month', 'anniversary_day')
        except Exception:
            logger.exception("Running incentive plan %s failed", plan.pk)
    return result


def run_daily_once(business):
    """اجرای خودکار روزانه (فقط اولین بار در هر روز برای هر کسب‌وکار)"""
    if business is None:
        return
    key = f"loyalty_incentives_{business.pk}_{timezone.localdate().isoformat()}"
    if cache.add(key, 1, timeout=60 * 60 * 26):
        try:
            run_incentives(business)
        except Exception:
            cache.delete(key)
            logger.exception("Daily incentives failed for %s", business.pk)
        try:
            from .share import refresh_level
            refresh_level(business)  # سطح باشگاه پذیرندگان
        except Exception:
            logger.exception("Merchant level refresh failed for %s", business.pk)
