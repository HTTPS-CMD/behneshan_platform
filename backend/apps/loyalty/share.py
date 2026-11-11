"""
اشتراک‌گذاری مشتری (ShareClub)، باشگاه پذیرندگان، اشتراک‌گذاری دستی و برداشت درآمد.

جریان ShareClub:
  ۱) مشتری از فروشگاه A خرید می‌کند (A «معرفی» را فعال کرده است).
  ۲) سیستم تا ۳ فروشگاه مکمل B انتخاب می‌کند: دسته‌ی متفاوت (هیچ‌وقت رقیب هم‌صنف)، نزدیک، فعال و با موجودی کافی.
     اگر مشتری از قبل مشتری B باشد یا در B تخفیف/اعتبار فعال داشته باشد، B انتخاب نمی‌شود.
  ۳) مشتری در پنل و اعلان‌ها کوپن تخفیف B را می‌بیند. B تا وقتی مشتری کد خرید ندهد شماره‌اش را نمی‌بیند (فقط آمار).
  ۴) فقط وقتی مشتری واقعاً با کوپن از B خرید کند (با کد خرید تأیید شود) پول جابه‌جا می‌شود:
     از کیف‌پول B «هزینه‌ی مشتری جدید» کم و (منهای کارمزد سایت) به درآمد قابل برداشت A اضافه می‌شود.
"""
import logging
import math
import random
import re
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.directory.models import Business, CampaignUsage

from .models import (
    CoopShare, MerchantStatus, Purchase, ShareProfile, ShareSettings, ShareVoucher, SmsLedger, SmsMessage,
    SmsSettings, StoreCustomer, WithdrawalRequest,
)
from .sms import (
    SmsError, _notify_admins, _notify_owner, fa_num, get_wallet, kick_worker, refund_to, sms_parts, wallet_change,
    with_opt_out,
)

logger = logging.getLogger(__name__)
User = get_user_model()

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LEVEL_ORDER = [MerchantStatus.Level.BRONZE, MerchantStatus.Level.SILVER, MerchantStatus.Level.GOLD, MerchantStatus.Level.DIAMOND]
LEVEL_PRIORITY = {'BRONZE': 0, 'SILVER': 10, 'GOLD': 20, 'DIAMOND': 30}
SHARE_LINK = '/dashboard/owner/club/share'
WALLET_LINK = '/dashboard/owner/club/wallet'
ADMIN_LINK = '/admin-panel/merchant-club'


class ShareError(Exception):
    """خطای قابل نمایش به کاربر"""


# ====================================================================== تنظیمات و سطح
def get_profile(business):
    profile = ShareProfile.objects.filter(business=business).first()
    if profile is None:
        cfg = ShareSettings.get()
        profile, _ = ShareProfile.objects.get_or_create(business=business, defaults={'fee_per_customer': cfg.default_fee})
    return profile


def _level_thresholds(cfg):
    return [
        (MerchantStatus.Level.DIAMOND, cfg.diamond_min_score),
        (MerchantStatus.Level.GOLD, cfg.gold_min_score),
        (MerchantStatus.Level.SILVER, cfg.silver_min_score),
    ]


def compute_score(business):
    since = timezone.now() - timedelta(days=30)
    p = Purchase.objects.filter(business=business, purchased_at__gte=since).exclude(source=Purchase.Source.IMPORT)
    agg = p.aggregate(customers=Count('customer', distinct=True), verified=Count('id', filter=Q(verified=True)))
    conversions = ShareVoucher.objects.filter(
        Q(origin=business) | Q(target=business), status=ShareVoucher.Status.USED, used_at__gte=since).count()
    return (agg['customers'] or 0) + 2 * (agg['verified'] or 0) + 5 * conversions


def refresh_level(business, force=False):
    """سطح فروشگاه (اگر از آخرین محاسبه بیش از یک روز گذشته باشد دوباره حساب می‌شود)"""
    try:
        status, _ = MerchantStatus.objects.get_or_create(business=business)
    except IntegrityError:  # دو درخواست هم‌زمان اول
        status = MerchantStatus.objects.get(business=business)
    if status.manual or (not force and status.computed_at > timezone.now() - timedelta(hours=24) and status.score):
        return status
    cfg = ShareSettings.get()
    score = compute_score(business)
    level = MerchantStatus.Level.BRONZE
    for lv, minimum in _level_thresholds(cfg):
        if score >= minimum:
            level = lv
            break
    status.score, status.level, status.computed_at = score, level, timezone.now()
    status.save(update_fields=['score', 'level', 'computed_at'])
    return status


def commission_for(business, cfg=None):
    """کارمزد سایت برای درآمد این فروشگاه (سطح بالاتر = کارمزد کمتر)"""
    cfg = cfg or ShareSettings.get()
    st = MerchantStatus.objects.filter(business=business).first()
    off = {
        'SILVER': cfg.silver_commission_off, 'GOLD': cfg.gold_commission_off, 'DIAMOND': cfg.diamond_commission_off,
    }.get(st.level if st else 'BRONZE', 0)
    return max(0, min(100, cfg.commission_percent - off))


def level_info(business):
    cfg = ShareSettings.get()
    st = refresh_level(business)
    idx = LEVEL_ORDER.index(st.level)
    thresholds = {'SILVER': cfg.silver_min_score, 'GOLD': cfg.gold_min_score, 'DIAMOND': cfg.diamond_min_score}
    nxt = LEVEL_ORDER[idx + 1] if idx + 1 < len(LEVEL_ORDER) else None
    return {
        "level": st.level, "label": st.get_level_display(), "score": st.score, "is_top": st.is_top,
        "next_level": nxt, "next_label": MerchantStatus.Level(nxt).label if nxt else None,
        "next_score": thresholds.get(nxt) if nxt else None,
        "commission_percent": commission_for(business, cfg),
        "base_commission_percent": cfg.commission_percent,
        "levels": [
            {"level": 'BRONZE', "label": "برنزی", "min_score": 0, "commission": cfg.commission_percent},
            {"level": 'SILVER', "label": "نقره‌ای", "min_score": cfg.silver_min_score,
             "commission": max(0, cfg.commission_percent - cfg.silver_commission_off)},
            {"level": 'GOLD', "label": "طلایی", "min_score": cfg.gold_min_score,
             "commission": max(0, cfg.commission_percent - cfg.gold_commission_off)},
            {"level": 'DIAMOND', "label": "الماس", "min_score": cfg.diamond_min_score,
             "commission": max(0, cfg.commission_percent - cfg.diamond_commission_off)},
        ],
    }


def refresh_all_levels():
    n = 0
    for b in Business.objects.filter(is_verified=True).only('pk').iterator():
        refresh_level(b, force=True)
        n += 1
    return n


# ====================================================================== انتخاب فروشگاه‌های همکار
def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(lambda v: math.radians(float(v)), (lat1, lon1, lat2, lon2))
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _distance(origin, b, max_km):
    """فاصله‌ی تقریبی (کیلومتر) یا None اگر خیلی دور / نامعلوم باشد"""
    if None not in (origin.latitude, origin.longitude, b.latitude, b.longitude):
        d = haversine_km(origin.latitude, origin.longitude, b.latitude, b.longitude)
        return d if d <= max_km else None
    if origin.location_id and origin.location_id == b.location_id:
        return max_km * 0.6  # مختصات ندارند ولی در یک محله/شهرند
    return None


def is_competitor(a, b):
    """هم‌صنف: دسته‌ی اصلی یکسان (خود دسته یا زیردسته‌های یک دسته‌ی مادر)"""
    ca, cb = a.category, b.category
    if not ca or not cb:
        return False
    return (ca.parent_id or ca.pk) == (cb.parent_id or cb.pk)


def _has_relation(target, phone, user):
    """
    مشتری از قبل مشتری این فروشگاه است (اعتبار هم فقط برای مشتریان ثبت‌شده است) یا کد تخفیف فعال همین فروشگاه را دارد.
    (تخفیف عمومی اشتراک VIP سایت مخصوص یک فروشگاه نیست و مانع نمی‌شود.)
    """
    if StoreCustomer.objects.filter(business=target, phone_number=phone).exists():
        return True
    if user is not None and CampaignUsage.objects.filter(
            client=user, campaign__business=target, campaign__is_active=True, is_redeemed=False).exists():
        return True
    return False


def candidate_targets(origin, phone, user=None, cfg=None, limit=None):
    cfg = cfg or ShareSettings.get()
    limit = limit or cfg.vouchers_per_purchase
    since = timezone.now() - timedelta(days=30)
    profiles = (ShareProfile.objects.filter(receive_enabled=True, business__is_verified=True, business__owner__isnull=False)
                .exclude(business=origin)
                .select_related('business', 'business__category', 'business__merchant_status'))
    if origin.latitude is not None and origin.longitude is not None:
        # پیش‌فیلتر جغرافیایی (مستطیل) برای کارایی؛ فروشگاه‌های بدون مختصات با محله سنجیده می‌شوند
        dlat = cfg.max_distance_km / 111.0
        dlon = cfg.max_distance_km / (111.0 * max(0.2, math.cos(math.radians(float(origin.latitude)))))
        lat, lon = float(origin.latitude), float(origin.longitude)
        profiles = profiles.filter(
            Q(business__latitude__range=(lat - dlat, lat + dlat), business__longitude__range=(lon - dlon, lon + dlon))
            | Q(business__latitude__isnull=True, business__location_id=origin.location_id)
        )
    elif origin.location_id:
        profiles = profiles.filter(business__location_id=origin.location_id)
    else:
        return []

    active_ids = set(ShareVoucher.objects.filter(phone=phone, status=ShareVoucher.Status.ISSUED,
                                                 valid_until__gte=timezone.now()).values_list('target_id', flat=True))
    scored = []
    for prof in profiles[:300]:
        b = prof.business
        if b.pk in active_ids or is_competitor(origin, b):
            continue
        dist = _distance(origin, b, cfg.max_distance_km)
        if dist is None:
            continue
        fee = clamp_fee(prof.fee_per_customer, cfg)
        if get_wallet(b).balance < fee:
            continue
        if _has_relation(b, phone, user):
            continue
        activity = Purchase.objects.filter(business=b, purchased_at__gte=since).count()
        level = getattr(getattr(b, 'merchant_status', None), 'level', 'BRONZE')
        score = (1 - dist / max(cfg.max_distance_km, 1)) * 40 + min(30, activity) + LEVEL_PRIORITY.get(level, 0) + random.uniform(0, 10)
        scored.append((score, b, prof, fee, dist))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:limit]


def clamp_fee(fee, cfg):
    return max(cfg.min_fee, min(cfg.max_fee, int(fee or cfg.default_fee)))


def _new_code():
    return ''.join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def expire_vouchers(**filters):
    return ShareVoucher.objects.filter(status=ShareVoucher.Status.ISSUED, valid_until__lt=timezone.now(), **filters).update(
        status=ShareVoucher.Status.EXPIRED)


def issue_vouchers(purchase):
    """بعد از ثبت خرید در فروشگاه A؛ هیچ‌وقت خطا بیرون نمی‌دهد. خروجی: فهرست کوپن‌های صادرشده"""
    try:
        cfg = ShareSettings.get()
        origin = purchase.business
        if not cfg.enabled or purchase.source == Purchase.Source.IMPORT:
            return []
        if not origin.is_verified or not get_profile(origin).send_enabled:
            return []
        phone = purchase.customer.phone_number
        if not phone:
            return []
        expire_vouchers(phone=phone)
        recent = timezone.now() - timedelta(days=cfg.issue_cooldown_days)
        if ShareVoucher.objects.filter(origin=origin, phone=phone, created_at__gte=recent).exists():
            return []
        user = purchase.customer.user or User.objects.filter(phone_number=phone).first()
        vouchers = []
        for _, b, prof, fee, _ in candidate_targets(origin, phone, user, cfg):
            for _attempt in range(3):
                try:
                    with transaction.atomic():
                        v = ShareVoucher.objects.create(
                            code=_new_code(), origin=origin, target=b, origin_purchase=purchase, phone=phone, user=user,
                            discount_percent=prof.discount_percent, max_discount=prof.max_discount,
                            min_purchase=prof.min_purchase, fee=fee,
                            valid_until=timezone.now() + timedelta(days=prof.valid_days),
                        )
                    vouchers.append(v)
                    break
                except IntegrityError:
                    # کد تکراری (بسیار نادر) یا کوپن فعال هم‌زمان برای همین فروشگاه
                    if ShareVoucher.objects.filter(target=b, phone=phone, status=ShareVoucher.Status.ISSUED).exists():
                        break
        if vouchers and user:
            _notify_customer(user, origin, vouchers)
        return vouchers
    except Exception:
        logger.exception("Issuing share vouchers failed")
        return []


def describe_voucher(v):
    text = f"{fa_num(v.discount_percent)}٪ تخفیف"
    if v.max_discount:
        text += f" تا سقف {fa_num(v.max_discount)} تومان"
    if v.min_purchase:
        text += f" برای خرید بالای {fa_num(v.min_purchase)} تومان"
    return text


def _notify_customer(user, origin, vouchers):
    try:
        from apps.notifications.models import Notification
        from apps.notifications.services import notify
        names = '، '.join(v.target.name for v in vouchers)
        notify(user.pk, Notification.Category.CAMPAIGN, "کوپن هدیه از فروشگاه‌های همکار",
               f"به‌خاطر خرید از {origin.name}، از {names} کوپن تخفیف گرفتید. کوپن‌ها در پنل شما هستند.",
               '/dashboard/client')
    except Exception:
        logger.exception("Voucher notification failed")


# ====================================================================== استفاده‌ی کوپن در فروشگاه B
def voucher_discount(v, amount):
    if amount < v.min_purchase:
        return 0
    value = amount * v.discount_percent // 100
    if v.max_discount:
        value = min(value, v.max_discount)
    return int(value)


def share_option(business, customer, amount):
    """
    برای پیش‌نمایش خرید (فقط مشتری تأییدشده با کد خرید و فقط اولین خرید او در این فروشگاه).
    خروجی: (voucher, discount_amount, blocked_reason)
    """
    if not customer.phone_number or customer.purchase_count:
        return None, 0, ''
    v = (ShareVoucher.objects.filter(target=business, phone=customer.phone_number, status=ShareVoucher.Status.ISSUED,
                                     valid_until__gte=timezone.now()).select_related('origin').first())
    if not v:
        return None, 0, ''
    amt = voucher_discount(v, amount)
    if not amt:
        return None, 0, f"کوپن همکاری از حداقل خرید {fa_num(v.min_purchase)} تومان اعمال می‌شود."
    if get_wallet(business).balance < v.fee:
        return None, 0, (f"مشتری کوپن همکاری دارد ولی موجودی کیف‌پول شما برای هزینه‌ی مشتری جدید "
                         f"({fa_num(v.fee)} تومان) کافی نیست. کیف‌پول را شارژ کنید.")
    return v, amt, ''


def cancel_unused_voucher(business, customer, purchase):
    """
    اولین خرید مشتری در این فروشگاه بدون کوپن همکاری ثبت شد (تخفیف بهتر، بدون تأیید کد یا موجودی ناکافی)؛
    کوپن دیگر قابل استفاده نیست و لغو می‌شود تا در پنل مشتری و آمار «فعال» نماند.
    """
    if customer.phone_number:
        ShareVoucher.objects.filter(target=business, phone=customer.phone_number, status=ShareVoucher.Status.ISSUED).update(
            status=ShareVoucher.Status.CANCELLED)


def redeem_voucher(voucher_id, purchase):
    """داخل transaction ثبت خرید صدا زده می‌شود. خطا = ShareError (کل خرید برگشت می‌خورد)."""
    v = ShareVoucher.objects.select_for_update(of=('self',)).filter(
        pk=voucher_id, target=purchase.business, status=ShareVoucher.Status.ISSUED, valid_until__gte=timezone.now(),
    ).select_related('origin').first()
    if not v:
        raise ShareError("کوپن همکاری دیگر معتبر نیست. دوباره پیش‌نمایش بگیرید.")
    # قفل هر دو کیف‌پول به ترتیب ثابت تا دو خرید هم‌زمان در جهت مخالف (A↔B) بن‌بست نسازند
    for biz in sorted([purchase.business, v.origin], key=lambda x: str(x.pk)):
        get_wallet(biz, lock=True)
    cfg = ShareSettings.get()
    commission_pct = commission_for(v.origin, cfg)
    income = v.fee * (100 - commission_pct) // 100
    try:
        wallet_change(purchase.business, -v.fee, SmsLedger.Kind.SHARE_FEE,
                      f"مشتری جدید از «{v.origin.name}» (کوپن {v.code})")
    except SmsError as exc:
        raise ShareError(str(exc))
    if income:
        wallet_change(v.origin, income, SmsLedger.Kind.SHARE_IN,
                      f"معرفی مشتری به «{purchase.business.name}» (کوپن {v.code})", income=True)
    v.status, v.used_purchase, v.used_at = ShareVoucher.Status.USED, purchase, timezone.now()
    v.origin_income, v.commission = income, v.fee - income
    v.save(update_fields=['status', 'used_purchase', 'used_at', 'origin_income', 'commission'])
    origin, target_name = v.origin, purchase.business.name
    transaction.on_commit(lambda: _notify_owner(
        origin, "درآمد معرفی مشتری", f"مشتری معرفی‌شده‌ی شما از «{target_name}» خرید کرد؛ {fa_num(income)} تومان به درآمد شما اضافه شد.",
        link=WALLET_LINK))
    return v


# ====================================================================== اشتراک‌گذاری دستی
COOP_COOLDOWN_DAYS = 7


def coop_audience(partner):
    """مشتریان B که پیامک همکاری می‌گیرند (لغوکرده‌ها و کسانی که ۷ روز اخیر پیامک همکاری گرفته‌اند حذف می‌شوند)"""
    recent = timezone.now() - timedelta(days=COOP_COOLDOWN_DAYS)
    recent_ids = SmsMessage.objects.filter(business=partner, kind=SmsMessage.Kind.COOP, created_at__gte=recent,
                                           customer__isnull=False).values_list('customer_id', flat=True)
    return (StoreCustomer.objects.filter(business=partner, sms_opt_out=False).exclude(pk__in=recent_ids)
            .order_by('-last_purchase_at', '-created_at'))


def coop_partners(requester, q=''):
    qs = (ShareProfile.objects.filter(coop_enabled=True, business__is_verified=True, business__owner__isnull=False)
          .exclude(business=requester).select_related('business', 'business__category', 'business__location',
                                                      'business__merchant_status'))
    if q:
        qs = qs.filter(business__name__icontains=q)
    cfg = ShareSettings.get()
    rows = []
    for prof in qs[:60]:
        b = prof.business
        st = getattr(b, 'merchant_status', None)
        rows.append({
            "id": str(b.pk), "name": b.name, "slug": b.slug,
            "category": b.category.name if b.category else '', "location": b.location.name if b.location else '',
            "audience": coop_audience(b).count(),
            "price": max(cfg.coop_min_price, min(cfg.coop_max_price, prof.coop_price)),
            "level": st.level if st else 'BRONZE', "level_label": st.get_level_display() if st else 'برنزی',
            "competitor": is_competitor(requester, b),
        })
    rows.sort(key=lambda r: (r['competitor'], -LEVEL_PRIORITY.get(r['level'], 0), -r['audience']))
    return rows


def _coop_text(requester, partner, text):
    return with_opt_out(f"{requester.name}: {text.strip()}\n(معرفی از {partner.name})")


def coop_quote(requester, partner, text, max_recipients):
    profile = ShareProfile.objects.filter(business=partner, coop_enabled=True).first()
    if not profile or partner.pk == requester.pk:
        raise ShareError("این فروشگاه درخواست همکاری نمی‌پذیرد.")
    cfg, sms_cfg = ShareSettings.get(), SmsSettings.get()
    full = _coop_text(requester, partner, text or '')
    parts = sms_parts(full)
    price = max(cfg.coop_min_price, min(cfg.coop_max_price, profile.coop_price))
    audience = coop_audience(partner).count()
    try:
        wanted = int(max_recipients or 0)
    except (TypeError, ValueError):
        wanted = 0
    count = min(audience, max(0, wanted)) if wanted else audience
    unit_sms = parts * sms_cfg.price_per_part
    return {
        "audience": audience, "recipients": count, "parts": parts, "chars": len(full), "final_text": full,
        "unit_sms_cost": unit_sms, "partner_price": price, "unit_cost": unit_sms + price,
        "cost": count * (unit_sms + price), "balance": get_wallet(requester).balance,
    }


def create_coop(requester, partner, title, text, max_recipients, user):
    text = (text or '').strip()
    if len(text) < 10:
        raise ShareError("متن پیشنهاد خیلی کوتاه است.")
    if len(text) > 400:
        raise ShareError("متن پیشنهاد حداکثر ۴۰۰ نویسه می‌تواند باشد.")
    if is_competitor(requester, partner):
        raise ShareError("ارسال پیشنهاد به مشتریان فروشگاه هم‌صنف مجاز نیست.")
    if CoopShare.objects.filter(requester=requester, status__in=[CoopShare.Status.PENDING_PARTNER,
                                                                 CoopShare.Status.PENDING_ADMIN]).count() >= 5:
        raise ShareError("حداکثر ۵ درخواست همکاری در انتظار می‌توانید داشته باشید.")
    q = coop_quote(requester, partner, text, max_recipients)
    if q['recipients'] < 10:
        raise ShareError("این فروشگاه در حال حاضر مشتری کافی برای ارسال ندارد (حداقل ۱۰ گیرنده).")
    with transaction.atomic():
        coop = CoopShare.objects.create(
            requester=requester, partner=partner, title=(title or text[:40]).strip()[:120], text=text,
            final_text=q['final_text'], parts=q['parts'], recipients_count=q['recipients'],
            unit_sms_cost=q['unit_sms_cost'], partner_price=q['partner_price'],
            commission_percent=commission_for(partner), cost=q['cost'], created_by=user,
        )
        try:
            w = wallet_change(requester, -coop.cost, SmsLedger.Kind.COOP_SEND, f"رزرو هزینه‌ی همکاری با «{partner.name}»")
        except SmsError as exc:
            raise ShareError(str(exc))
        if w.income_taken:
            coop.income_used = w.income_taken
            coop.save(update_fields=['income_used'])
    _notify_owner(partner, "درخواست همکاری جدید",
                  f"«{requester.name}» می‌خواهد پیشنهادش برای {fa_num(coop.recipients_count)} نفر از مشتریان شما ارسال شود. "
                  f"سهم شما: {fa_num(coop.partner_price)} تومان برای هر پیامک موفق.", link=SHARE_LINK)
    return coop


def _refund_coop(coop, note):
    if coop.cost:
        refund_to(coop.requester, coop.cost, SmsLedger.Kind.REFUND, note, source=coop)


def partner_respond(coop, partner, accept, note=''):
    with transaction.atomic():
        coop = CoopShare.objects.select_for_update().select_related('requester', 'partner').get(pk=coop.pk)
        if coop.partner_id != partner.pk or coop.status != CoopShare.Status.PENDING_PARTNER:
            raise ShareError("این درخواست قابل پاسخ نیست.")
        coop.partner_note, coop.partner_responded_at = (note or '')[:300], timezone.now()
        if accept:
            coop.status = CoopShare.Status.PENDING_ADMIN
        else:
            coop.status = CoopShare.Status.PARTNER_REJECTED
            _refund_coop(coop, f"برگشت هزینه‌ی همکاری رد‌شده توسط «{partner.name}»")
        coop.save(update_fields=['status', 'partner_note', 'partner_responded_at'])
    if accept:
        _notify_admins("اشتراک‌گذاری دستی در انتظار تأیید", f"{coop.requester.name} ← {coop.partner.name}: «{coop.title}»", link=ADMIN_LINK)
        _notify_owner(coop.requester, "درخواست همکاری پذیرفته شد", f"«{partner.name}» پذیرفت؛ پس از تأیید مدیریت ارسال می‌شود.", link=SHARE_LINK)
    else:
        _notify_owner(coop.requester, "درخواست همکاری رد شد", note or f"«{partner.name}» درخواست را نپذیرفت و هزینه برگشت.", link=SHARE_LINK)
    return coop


def cancel_coop(coop, requester):
    with transaction.atomic():
        coop = CoopShare.objects.select_for_update().select_related('requester').get(pk=coop.pk)
        if coop.requester_id != requester.pk or coop.status not in (CoopShare.Status.PENDING_PARTNER, CoopShare.Status.PENDING_ADMIN):
            raise ShareError("فقط درخواست در انتظار قابل لغو است.")
        coop.status = CoopShare.Status.CANCELLED
        coop.save(update_fields=['status'])
        _refund_coop(coop, f"برگشت هزینه‌ی همکاری لغوشده «{coop.title}»")
    return coop


def admin_review_coop(coop, admin_user, approve, note=''):
    with transaction.atomic():
        coop = CoopShare.objects.select_for_update().select_related('requester', 'partner').get(pk=coop.pk)
        if coop.status != CoopShare.Status.PENDING_ADMIN:
            raise ShareError("این درخواست قبلاً بررسی شده است.")
        coop.reviewed_by, coop.reviewed_at, coop.admin_note = admin_user, timezone.now(), (note or '')[:300]
        if not approve:
            coop.status = CoopShare.Status.REJECTED
            coop.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_note'])
            _refund_coop(coop, f"برگشت هزینه‌ی همکاری رد‌شده توسط مدیریت «{coop.title}»")
        else:
            customers = list(coop_audience(coop.partner)[:coop.recipients_count])
            unit = coop.unit_cost
            SmsMessage.objects.bulk_create([
                SmsMessage(business=coop.partner, coop=coop, customer=c, phone=c.phone_number, text=coop.final_text,
                           kind=SmsMessage.Kind.COOP, parts=coop.parts, cost=unit)
                for c in customers
            ], batch_size=500)
            missing = coop.recipients_count - len(customers)
            if missing > 0:
                refund_to(coop.requester, missing * unit, SmsLedger.Kind.REFUND,
                          f"برگشت هزینه‌ی {missing} گیرنده‌ی کمتر (همکاری «{coop.title}»)", source=coop)
                coop.recipients_count = len(customers)
                coop.cost = len(customers) * unit
            coop.status = CoopShare.Status.SENDING if customers else CoopShare.Status.DONE
            if not customers:
                coop.finished_at = timezone.now()
            coop.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_note', 'finished_at',
                                     'recipients_count', 'cost'])
            transaction.on_commit(kick_worker)
    if approve:
        _notify_owner(coop.requester, "همکاری تأیید شد", f"پیشنهاد شما برای مشتریان «{coop.partner.name}» در حال ارسال است.", link=SHARE_LINK)
    else:
        _notify_owner(coop.requester, "همکاری رد شد", note or "درخواست تأیید نشد و هزینه‌اش برگشت.", link=SHARE_LINK)
        _notify_owner(coop.partner, "همکاری رد شد", f"ارسال پیشنهاد «{coop.requester.name}» توسط مدیریت تأیید نشد.", link=SHARE_LINK)
    return coop


# ====================================================================== برداشت درآمد
SHEBA_RE = re.compile(r'^IR\d{24}$')


def normalize_sheba(raw):
    s = str(raw or '').upper().replace(' ', '').replace('-', '')
    s = s.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    if s.isdigit() and len(s) == 24:
        s = 'IR' + s
    if not SHEBA_RE.match(s):
        return None
    # کنترل رقم IBAN (mod 97)
    rearranged = s[4:] + '1827' + s[2:4]  # I=18, R=27
    if int(rearranged) % 97 != 1:
        return None
    return s


def create_withdrawal(business, amount, sheba, holder, note, user):
    cfg = ShareSettings.get()
    sheba_n = normalize_sheba(sheba)
    if not sheba_n:
        raise ShareError("شماره شبا معتبر نیست (IR و ۲۴ رقم).")
    holder = (holder or '').strip()
    if len(holder) < 3:
        raise ShareError("نام صاحب حساب را وارد کنید.")
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        raise ShareError("مبلغ نامعتبر است.")
    if amount < cfg.min_withdraw:
        raise ShareError(f"حداقل مبلغ برداشت {cfg.min_withdraw:,} تومان است.")
    with transaction.atomic():
        get_wallet(business, lock=True)  # قفل کیف‌پول: دو درخواست هم‌زمان پشت هم بررسی می‌شوند
        if WithdrawalRequest.objects.filter(business=business, status=WithdrawalRequest.Status.PENDING).exists():
            raise ShareError("یک درخواست برداشت در انتظار بررسی دارید.")
        try:
            wallet_change(business, -amount, SmsLedger.Kind.WITHDRAW, "درخواست برداشت درآمد", from_income=True)
        except SmsError as exc:
            raise ShareError(str(exc))
        req = WithdrawalRequest.objects.create(business=business, amount=amount, sheba=sheba_n, account_holder=holder[:120],
                                               note=(note or '')[:300], created_by=user)
    _notify_admins("درخواست برداشت درآمد", f"{business.name}: {fa_num(amount)} تومان", link=ADMIN_LINK)
    return req


def review_withdrawal(req, admin_user, paid, bank_ref='', note=''):
    with transaction.atomic():
        req = WithdrawalRequest.objects.select_for_update().select_related('business').get(pk=req.pk)
        if req.status != WithdrawalRequest.Status.PENDING:
            raise ShareError("این درخواست قبلاً بررسی شده است.")
        if paid and not (bank_ref or '').strip():
            raise ShareError("کد پیگیری واریز را وارد کنید.")
        req.reviewed_by, req.reviewed_at, req.admin_note = admin_user, timezone.now(), (note or '')[:300]
        req.bank_ref = (bank_ref or '').strip()[:60]
        req.status = WithdrawalRequest.Status.PAID if paid else WithdrawalRequest.Status.REJECTED
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_note', 'bank_ref'])
        if not paid:
            wallet_change(req.business, req.amount, SmsLedger.Kind.WD_REFUND, f"برگشت برداشت رد‌شده #{req.pk}", income=True)
    if paid:
        _notify_owner(req.business, "درآمد شما واریز شد", f"{fa_num(req.amount)} تومان به حساب شما واریز شد. کد پیگیری: {req.bank_ref}", link=WALLET_LINK)
    else:
        _notify_owner(req.business, "درخواست برداشت رد شد", note or "مبلغ به درآمد قابل برداشت شما برگشت.", link=WALLET_LINK)
    return req
