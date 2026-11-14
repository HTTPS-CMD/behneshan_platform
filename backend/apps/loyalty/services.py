"""
منطق اصلی باشگاه مشتریان. همه‌ی تغییرات موجودی فقط از این فایل انجام می‌شوند.
"""
import secrets
from datetime import timedelta
from decimal import ROUND_DOWN, Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import F, Max
from django.utils import timezone

from apps.directory.models import CampaignUsage, DiscountService, TransactionLog

from .models import LoyaltySettings, Purchase, StoreCustomer, WalletEntry

User = get_user_model()

VERIFICATION_TTL = 600  # فرصت ثبت خرید بعد از تأیید کد مشتری: ۱۰ دقیقه


class LoyaltyError(Exception):
    """خطای قابل نمایش به کاربر"""


# ---------------------------------------------------------------- تنظیمات و مشتری
def get_settings(business):
    obj, _ = LoyaltySettings.objects.get_or_create(business=business)
    return obj


def _next_membership_no(business):
    last = StoreCustomer.objects.filter(business=business).aggregate(m=Max('membership_no'))['m'] or 1000
    return last + 1


def get_or_create_customer(business, phone, full_name='', source=StoreCustomer.Source.PURCHASE):
    """مشتری فروشگاه را با شماره پیدا یا ایجاد می‌کند و اگر حساب سایت داشته باشد وصلش می‌کند."""
    customer = StoreCustomer.objects.filter(business=business, phone_number=phone).first()
    if customer:
        changed = []
        if not customer.user_id:
            user = User.objects.filter(phone_number=phone).first()
            if user:
                customer.user = user
                changed.append('user')
        if full_name and not customer.full_name:
            customer.full_name = full_name[:150]
            changed.append('full_name')
        if changed:
            customer.save(update_fields=changed + ['updated_at'])
        return customer, False

    user = User.objects.filter(phone_number=phone).first()
    # اسم حساب سایت عمداً کپی نمی‌شود (حریم خصوصی)؛ فروشنده خودش اسم را ثبت می‌کند
    name = (full_name or '')[:150]
    for _ in range(5):  # در صورت هم‌زمانی، شماره اشتراک تکراری را دوباره امتحان کن
        try:
            with transaction.atomic():
                return StoreCustomer.objects.create(
                    business=business, phone_number=phone, user=user, full_name=name,
                    membership_no=_next_membership_no(business), source=source,
                ), True
        except IntegrityError:
            existing = StoreCustomer.objects.filter(business=business, phone_number=phone).first()
            if existing:
                return existing, False
    raise LoyaltyError("ثبت مشتری ناموفق بود. دوباره تلاش کنید.")


def link_user_memberships(user):
    """وقتی مشتری بعداً در سایت ثبت‌نام می‌کند، عضویت‌های قبلی‌اش در فروشگاه‌ها را به حسابش وصل کن."""
    StoreCustomer.objects.filter(phone_number=user.phone_number, user__isnull=True).update(user=user)


# ---------------------------------------------------------------- کیف‌پول
def _lock(customer):
    return StoreCustomer.objects.select_for_update().get(pk=customer.pk)


def expire_due_credit(customer):
    """
    اعتبارهای منقضی‌شده را کم می‌کند. باید داخل transaction.atomic و روی مشتریِ قفل‌شده صدا زده شود.
    """
    now = timezone.now()
    due = list(
        WalletEntry.objects.select_for_update()
        .filter(customer=customer, remaining__gt=0, expires_at__isnull=False, expires_at__lte=now)
    )
    total = sum(e.remaining for e in due)
    if not total:
        return 0
    total = min(total, customer.credit_balance)
    WalletEntry.objects.filter(pk__in=[e.pk for e in due]).update(remaining=0)
    customer.credit_balance -= total
    customer.save(update_fields=['credit_balance', 'updated_at'])
    WalletEntry.objects.create(
        customer=customer, kind=WalletEntry.Kind.EXPIRE, amount=-total,
        balance_after=customer.credit_balance, note="انقضای اعتبار",
    )
    return total


def _credit(customer, amount, kind, expiry_days, purchase=None, note='', created_by=None):
    if amount <= 0:
        return None
    customer.credit_balance += amount
    customer.save(update_fields=['credit_balance', 'updated_at'])
    expires_at = timezone.now() + timedelta(days=expiry_days) if expiry_days else None
    return WalletEntry.objects.create(
        customer=customer, kind=kind, amount=amount, balance_after=customer.credit_balance,
        remaining=amount, expires_at=expires_at, purchase=purchase, note=note, created_by=created_by,
    )


def _debit(customer, amount, purchase=None, note='', created_by=None):
    """مصرف اعتبار؛ از قدیمی‌ترین واریزها (زودتر منقضی‌شونده‌ها) کم می‌شود."""
    if amount <= 0:
        return None
    if amount > customer.credit_balance:
        raise LoyaltyError("موجودی اعتبار مشتری کافی نیست.")
    left = amount
    sources = (
        WalletEntry.objects.select_for_update()
        .filter(customer=customer, remaining__gt=0)
        .order_by(F('expires_at').asc(nulls_last=True), 'created_at')
    )
    for entry in sources:
        if left <= 0:
            break
        take = min(entry.remaining, left)
        entry.remaining -= take
        entry.save(update_fields=['remaining'])
        left -= take
    customer.credit_balance -= amount
    customer.save(update_fields=['credit_balance', 'updated_at'])
    return WalletEntry.objects.create(
        customer=customer, kind=WalletEntry.Kind.SPEND, amount=-amount,
        balance_after=customer.credit_balance, purchase=purchase, note=note, created_by=created_by,
    )


def gift_credit(customer, amount, note='', created_by=None):
    """اعتبار هدیه‌ی دستی از طرف فروشنده"""
    if amount <= 0:
        raise LoyaltyError("مبلغ باید بیشتر از صفر باشد.")
    with transaction.atomic():
        locked = _lock(customer)
        expire_due_credit(locked)
        settings_obj = get_settings(locked.business)
        _credit(locked, amount, WalletEntry.Kind.GIFT, settings_obj.cashback_expiry_days,
                note=note or "اعتبار هدیه از فروشگاه", created_by=created_by)
        return locked


def current_balance(customer):
    """موجودی بعد از اعمال انقضا"""
    with transaction.atomic():
        locked = _lock(customer)
        expire_due_credit(locked)
        return locked.credit_balance


# ---------------------------------------------------------------- محاسبه
def compute_cashback(settings_obj, line, paid_amount):
    if paid_amount <= 0:
        return 0
    if line is not None:
        percent = Decimal(line.cashback_percent)
        base = min(paid_amount, line.max_amount) if line.max_amount else paid_amount
    else:
        percent = Decimal(settings_obj.default_cashback_percent)
        base = paid_amount
    value = (Decimal(base) * percent / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_DOWN)
    return int(value)


def _reward_brief(r):
    from .incentives import describe_reward
    return {
        "id": r.pk, "title": r.title, "kind": r.kind, "reward_type": r.reward_type,
        "description": describe_reward(r.reward_type, r.value, r.max_discount, r.gift_text),
        "min_purchase": r.min_purchase,
        "valid_until": r.valid_until.isoformat() if r.valid_until else None,
    }


def preview_purchase(business, customer, amount, line=None, use_credit=0, verified=False, apply_incentives=True):
    """
    بدون ذخیره، نتیجه‌ی خرید را حساب می‌کند (برای پیش‌نمایش در فرم).
    تخفیف‌ها جمع نمی‌شوند؛ بهترین گزینه بین VIP، کد تخفیف، طرح اولین خرید و هدیه‌ی مشتری انتخاب می‌شود.
    VIP/کد تخفیف/هدیه‌ها فقط با تأیید کد خرید مشتری؛ اولین خرید بدون تأیید هم اعمال می‌شود.
    """
    from .incentives import best_reward_discount, describe_reward, first_purchase_options, usable_rewards

    settings_obj = get_settings(business)
    candidates = []  # (amount, source, percent, extra)

    if verified and customer.user_id:
        d = DiscountService.get_best_discount(customer.user, business)
        pct = int(d['final_discount'] or 0)
        if pct:
            amt = int((Decimal(amount) * pct / 100).quantize(Decimal('1'), rounding=ROUND_DOWN))
            candidates.append((amt, d['source'], pct, {"campaign_id": d.get('campaign_id')}))

    first_bonuses, rewards, gift_rewards = [], [], []
    if apply_incentives:
        best_first, first_bonuses = first_purchase_options(business, customer, amount)
        if best_first:
            plan, amt = best_first
            pct = int(plan.value) if plan.reward_type == 'PERCENT' else 0
            candidates.append((amt, 'FIRST_PURCHASE', pct, {"plan_id": plan.pk, "label": plan.title}))
        if verified and customer.pk and not customer._state.adding:
            rewards = usable_rewards(customer)
            best_r, amt = best_reward_discount(rewards, amount)
            if best_r:
                pct = int(best_r.value) if best_r.reward_type == 'PERCENT' else 0
                candidates.append((amt, 'REWARD', pct, {"reward_id": best_r.pk, "label": best_r.title}))
            gift_rewards = [r for r in rewards if r.reward_type == 'GIFT']

    # کوپن همکاری (ShareClub): فقط برای مشتری تأییدشده و اولین خریدش در این فروشگاه
    share_notice = ''
    if verified and apply_incentives:
        from .share import share_option
        voucher, amt, share_notice = share_option(business, customer, amount)
        if voucher:
            candidates.append((amt, 'SHARE', int(voucher.discount_percent),
                               {"voucher_id": str(voucher.pk), "label": f"معرفی از {voucher.origin.name}"}))

    best = max(candidates, key=lambda c: c[0]) if candidates else (0, 'NONE', 0, {})
    discount_amount, source, pct, extra = best
    after_discount = amount - discount_amount
    max_by_percent = int(Decimal(after_discount) * settings_obj.max_credit_use_percent / 100)
    credit_cap = min(customer.credit_balance, max_by_percent) if verified else 0
    credit_used = max(0, min(int(use_credit or 0), credit_cap))
    final_amount = after_discount - credit_used
    return {
        "discount_percent": pct,
        "discount_source": source,
        "discount_label": extra.get("label", ""),
        "campaign_id": extra.get("campaign_id"),
        "first_plan_id": extra.get("plan_id"),
        "reward_id": extra.get("reward_id"),
        "share_voucher_id": extra.get("voucher_id"),
        "share_notice": share_notice if source != 'SHARE' else '',
        "discount_amount": discount_amount,
        "credit_cap": credit_cap,
        "credit_used": credit_used,
        "final_amount": final_amount,
        "cashback_amount": compute_cashback(settings_obj, line, final_amount),
        # هدیه‌هایی که بعد از ثبت این خرید (اولین خرید) داده می‌شوند
        "first_purchase_bonuses": [
            {"plan_id": p.pk, "title": p.title,
             "description": describe_reward(p.reward_type, p.value, p.max_discount, p.gift_text)}
            for p in first_bonuses
        ],
        # هدیه‌های کالایی فعال مشتری (فروشنده تحویلشان را تیک می‌زند)
        "gift_rewards": [_reward_brief(r) for r in gift_rewards],
        "available_rewards": [_reward_brief(r) for r in rewards],
    }


# ---------------------------------------------------------------- ثبت خرید
def record_purchase(
    *, business, customer, amount, branch=None, line=None, payment_method=Purchase.PaymentMethod.CASH,
    use_credit=0, verified=False, created_by=None, source=Purchase.Source.PANEL, note='', purchased_at=None,
    gift_reward_ids=None, apply_incentives=True, client_ref=None, pos_reference='',
):
    """
    ثبت خرید + کم کردن اعتبار مصرف‌شده + واریز کش‌بک + طرح‌های تشویقی، همه در یک تراکنش دیتابیس.
    verified=False: فقط کش‌بک و طرح اولین خرید (نه VIP/کد تخفیف/هدیه‌ها و نه خرج اعتبار).
    """
    from .incentives import issue_reward
    from .models import CustomerReward, IncentivePlan

    amount = int(amount)
    if amount <= 0:
        raise LoyaltyError("مبلغ باید بیشتر از صفر باشد.")
    if use_credit and not verified:
        raise LoyaltyError("برای خرج کردن اعتبار، ابتدا مشتری را با کد خرید تأیید کنید.")
    if gift_reward_ids and not verified:
        raise LoyaltyError("برای تحویل هدیه، ابتدا مشتری را با کد خرید تأیید کنید.")
    if line is not None and branch is None:
        branch = line.branch
    if line is not None and line.branch_id != branch.pk:
        raise LoyaltyError("این بخش متعلق به شعبه‌ی انتخاب‌شده نیست.")

    with transaction.atomic():
        locked = _lock(customer)
        expire_due_credit(locked)
        calc = preview_purchase(business, locked, amount, line, use_credit, verified, apply_incentives)
        if use_credit and calc['credit_used'] < int(use_credit):
            raise LoyaltyError(f"حداکثر اعتبار قابل استفاده در این خرید {calc['credit_cap']:,} تومان است.")

        purchase = Purchase.objects.create(
            business=business, customer=locked, branch=branch, line=line, payment_method=payment_method,
            original_amount=amount, discount_percent=calc['discount_percent'],
            discount_source=calc['discount_source'], discount_amount=calc['discount_amount'],
            credit_used=calc['credit_used'], final_amount=calc['final_amount'],
            cashback_amount=calc['cashback_amount'], verified=verified, source=source,
            note=(note or '')[:500], created_by=created_by, purchased_at=purchased_at or timezone.now(),
            client_ref=client_ref, pos_reference=(pos_reference or '')[:64],
        )

        if calc['credit_used']:
            _debit(locked, calc['credit_used'], purchase=purchase, note="خرج اعتبار در خرید", created_by=created_by)
        settings_obj = get_settings(business)
        if calc['cashback_amount']:
            _credit(locked, calc['cashback_amount'], WalletEntry.Kind.EARN, settings_obj.cashback_expiry_days,
                    purchase=purchase, note="کش‌بک خرید", created_by=created_by)

        # ---- کوپن همکاری: هزینه‌ی مشتری جدید از کیف‌پول این فروشگاه کم و به فروشگاه معرف داده می‌شود
        if calc['discount_source'] == 'SHARE' and calc.get('share_voucher_id'):
            from .share import ShareError, redeem_voucher
            try:
                redeem_voucher(calc['share_voucher_id'], purchase)
            except ShareError as exc:
                raise LoyaltyError(str(exc))
        elif locked.purchase_count == 0 and source != Purchase.Source.IMPORT:
            from .share import cancel_unused_voucher
            cancel_unused_voucher(business, locked, purchase)

        # ---- طرح‌های تشویقی
        now = timezone.now()
        if calc.get('reward_id'):
            used = CustomerReward.objects.select_for_update().filter(
                pk=calc['reward_id'], customer=locked, status=CustomerReward.Status.ACTIVE,
            ).update(status=CustomerReward.Status.USED, used_at=now, purchase=purchase)
            if not used:
                raise LoyaltyError("این هدیه قبلاً استفاده شده است. دوباره تلاش کنید.")
        if gift_reward_ids:
            ids = [int(i) for i in gift_reward_ids if str(i).isdigit()]
            CustomerReward.objects.filter(
                pk__in=ids, customer=locked, status=CustomerReward.Status.ACTIVE, reward_type='GIFT',
            ).update(status=CustomerReward.Status.USED, used_at=now, purchase=purchase)
        if apply_incentives and locked.purchase_count == 0:
            if calc.get('first_plan_id'):
                plan = IncentivePlan.objects.filter(pk=calc['first_plan_id']).first()
                if plan:
                    issue_reward(plan, locked, 'FIRST', used_purchase=purchase, notify_user=False)
            for bonus in calc.get('first_purchase_bonuses') or []:
                plan = IncentivePlan.objects.filter(pk=bonus['plan_id']).first()
                if plan:
                    # اعتبار: همین الان به کیف‌پول؛ هدیه‌ی کالایی: همین خرید تحویل شده ثبت می‌شود
                    issue_reward(plan, locked, 'FIRST', used_purchase=purchase, notify_user=False)
            locked.refresh_from_db(fields=['credit_balance'])

        when = purchase.purchased_at
        locked.purchase_count += 1
        locked.total_purchase_amount += amount
        if not locked.first_purchase_at or when < locked.first_purchase_at:
            locked.first_purchase_at = when
        if not locked.last_purchase_at or when > locked.last_purchase_at:
            locked.last_purchase_at = when
        locked.save(update_fields=['purchase_count', 'total_purchase_amount', 'first_purchase_at',
                                   'last_purchase_at', 'updated_at'])

        # برای مشتری‌های دارای حساب که با کد تأیید شده‌اند، تراکنش در سیستم قبلی هم ثبت می‌شود
        # (آمار قبلی، اعلان خرید و سوزاندن کد کمپین)
        if verified and locked.user_id:
            log = TransactionLog.objects.create(
                business=business, customer=locked.user, original_amount=amount,
                applied_discount_percentage=calc['discount_percent'],
                discount_source=calc['discount_source'] if calc['discount_source'] in ('SUBSCRIPTION', 'CAMPAIGN') else 'NONE',
                final_amount=calc['final_amount'],
            )
            purchase.transaction_log = log
            purchase.save(update_fields=['transaction_log'])
            if calc['discount_source'] == 'CAMPAIGN' and calc.get('campaign_id'):
                CampaignUsage.objects.filter(
                    campaign_id=calc['campaign_id'], client=locked.user, is_redeemed=False,
                ).update(is_redeemed=True)

        return purchase


# ---------------------------------------------------------------- تأیید مشتری با کد خرید
def create_verification(customer, token=None):
    token = token or secrets.token_urlsafe(24)
    cache.set(f"loyalty_verified_{token}", {"customer_id": str(customer.pk), "business_id": str(customer.business_id)},
              timeout=VERIFICATION_TTL)
    return token


def peek_verification(token, business):
    if not token:
        return None
    data = cache.get(f"loyalty_verified_{token}")
    if not data or data.get("business_id") != str(business.pk):
        return None
    return StoreCustomer.objects.filter(pk=data["customer_id"], business=business).first()


def claim_verification(token):
    """توکن را اتمی حذف می‌کند؛ True فقط برای اولین درخواست (Redis delete تعداد حذف‌شده را برمی‌گرداند)."""
    return bool(cache.delete(f"loyalty_verified_{token}"))
