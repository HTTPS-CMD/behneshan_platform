"""
سامانه پیامکی: لایه‌ی ارسال (provider)، کیف‌پول، صف ارسال و پیامک‌های خودکار.

انتخاب سرویس با env (فایل backend/.env):
    SMS_PROVIDER=console   # یا kavenegar یا smsir
    SMS_API_KEY=...
    SMS_LINE_NUMBER=...
در حالت console پیامک ارسال نمی‌شود و فقط در ترمینال/لاگ چاپ می‌شود (برای توسعه).

ارسال در پس‌زمینه انجام می‌شود. برای اطمینان (مثلاً بعد از ری‌استارت سرور) دستور زیر را هر دقیقه با cron اجرا کنید:
    python manage.py process_sms_queue
"""
import datetime
import logging
import math
import re
import threading
import time

import requests
from django.conf import settings
from django.db import close_old_connections, transaction
from django.db.models import F, Q
from django.utils import timezone

from .models import (
    CoopShare, SmsCampaign, SmsChargeRequest, SmsLedger, SmsMessage, SmsSettings, SmsWallet, StoreCustomer,
)

logger = logging.getLogger(__name__)


class SmsError(Exception):
    """خطای قابل نمایش به کاربر"""


# ---------------------------------------------------------------- محاسبه‌ی بخش‌ها و هزینه
GSM_RE = re.compile(r"^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!\"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[~\]|€]*$")


def sms_parts(text):
    """تعداد بخش‌های پیامک (فارسی: ۷۰ نویسه، چندبخشی ۶۷؛ انگلیسی: ۱۶۰ و ۱۵۳)"""
    n = len(text or '')
    if n == 0:
        return 0
    if GSM_RE.match(text):
        return 1 if n <= 160 else math.ceil(n / 153)
    return 1 if n <= 70 else math.ceil(n / 67)


def with_opt_out(text, cfg=None):
    cfg = cfg or SmsSettings.get()
    footer = (cfg.opt_out_text or '').strip()
    text = (text or '').strip()
    if footer and not text.endswith(footer):
        text = f"{text}\n{footer}"
    return text


TEMPLATE_VARS = ('نام', 'فروشگاه', 'مبلغ', 'کش_بک', 'موجودی', 'هدیه', 'اعتبار_تا')


def render(template, **values):
    """جایگزینی {نام}، {فروشگاه} و ... در قالب"""
    def repl(m):
        key = m.group(1)
        return str(values.get(key, m.group(0)))
    return re.sub(r"\{([^{}]+)\}", repl, template or '').strip()


def fa_num(value):
    try:
        return f"{int(value):,}".translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')).replace(',', '٬')
    except (TypeError, ValueError):
        return str(value)


# ---------------------------------------------------------------- سرویس‌دهنده
class BaseProvider:
    name = 'base'

    def send(self, phone, text):
        """خروجی: (ok, provider_message_id, error)"""
        raise NotImplementedError


class ConsoleProvider(BaseProvider):
    name = 'console'

    def send(self, phone, text):
        logger.warning("[SMS console] %s <- %s", phone, text)
        print(f"\n >>> [SMS] {phone}: {text} <<< \n")
        return True, f"console-{int(time.time() * 1000)}", ''


class KavenegarProvider(BaseProvider):
    name = 'kavenegar'

    def __init__(self, api_key, line):
        self.api_key, self.line = api_key, line

    def send(self, phone, text):
        try:
            r = requests.post(
                f"https://api.kavenegar.com/v1/{self.api_key}/sms/send.json",
                data={"receptor": phone, "sender": self.line, "message": text}, timeout=20,
            )
            data = r.json()
            if data.get('return', {}).get('status') == 200:
                entry = (data.get('entries') or [{}])[0]
                return True, str(entry.get('messageid', '')), ''
            return False, '', str(data.get('return', {}).get('message', 'خطای سرویس پیامک'))[:300]
        except Exception as exc:
            # کلید API در آدرس کاوه‌نگار است؛ نباید در لاگ یا پیام خطا دیده شود
            safe = str(exc).replace(self.api_key, '***')
            logger.error("Kavenegar send failed: %s", safe)
            return False, '', safe[:300]


class SmsIrProvider(BaseProvider):
    name = 'smsir'

    def __init__(self, api_key, line):
        self.api_key, self.line = api_key, line

    def send(self, phone, text):
        try:
            r = requests.post(
                "https://api.sms.ir/v1/send/bulk",
                headers={"x-api-key": self.api_key, "Content-Type": "application/json", "Accept": "text/plain"},
                json={"lineNumber": int(self.line), "messageText": text, "mobiles": [phone]}, timeout=20,
            )
            data = r.json()
            if data.get('status') == 1:
                ids = (data.get('data') or {}).get('messageIds') or ['']
                return True, str(ids[0]), ''
            return False, '', str(data.get('message', 'خطای سرویس پیامک'))[:300]
        except Exception as exc:
            logger.exception("sms.ir send failed")
            return False, '', str(exc)[:300]


def get_provider():
    name = (getattr(settings, 'SMS_PROVIDER', 'console') or 'console').lower()
    key = getattr(settings, 'SMS_API_KEY', '')
    line = getattr(settings, 'SMS_LINE_NUMBER', '')
    if name == 'kavenegar' and key:
        return KavenegarProvider(key, line)
    if name == 'smsir' and key:
        return SmsIrProvider(key, line)
    if name == 'ippanel' and key and line:
        return IppanelProvider(key, line)
    if name not in ('console', '') and not key:
        logger.error("SMS_PROVIDER=%s اما SMS_API_KEY تنظیم نشده؛ از حالت console استفاده می‌شود.", name)
    if name == 'ippanel' and key and not line:
        logger.error("SMS_PROVIDER=ippanel اما SMS_LINE_NUMBER تنظیم نشده؛ از حالت console استفاده می‌شود.")
    return ConsoleProvider()


class IppanelProvider(BaseProvider):
    """IPPanel (edge.ippanel.com)، ارسال وب‌سرویس. SMS_LINE_NUMBER مثل +983000505 یا 3000505"""
    name = 'ippanel'
    URL = "https://edge.ippanel.com/v1/api/send"
    _prefixed = None  # True یعنی هدر با پیشوند «API » جواب داده؛ پیش‌فرض: توکن خام (تست‌شده روی پنل واقعی)

    def __init__(self, api_key, line):
        self.api_key, self.line = (api_key or '').strip(), self._e164(line)

    @staticmethod
    def _e164(number):
        n = re.sub(r"[\s\-]", "", str(number or ''))
        if n.startswith('+'):
            return n
        if n.startswith('00'):
            return '+' + n[2:]
        if n.startswith('98'):
            return '+' + n
        if n.startswith('0'):
            return '+98' + n[1:]
        return '+98' + n

    def _post(self, auth, payload):
        r = requests.post(
            self.URL, json=payload, timeout=20,
            headers={"Authorization": auth, "Content-Type": "application/json"},
        )
        try:
            data = r.json()
        except ValueError:
            data = {}
        return r, data

    def send(self, phone, text):
        payload = {
            "sending_type": "webservice", "from_number": self.line, "message": text,
            "params": {"recipients": [self._e164(phone)]},
        }
        try:
            order = [self.api_key, f"API {self.api_key}"]
            if IppanelProvider._prefixed is True:
                order.reverse()
            r, data, meta = None, {}, {}
            for i, auth in enumerate(order):
                r, data = self._post(auth, payload)
                meta = data.get('meta') or {}
                if r.status_code == 200 and meta.get('status'):
                    IppanelProvider._prefixed = auth.startswith('API ')
                    ids = (data.get('data') or {}).get('message_outbox_ids') or ['']
                    return True, str(ids[0]), ''
                if i == 0 and (r.status_code in (401, 403) or meta.get('message_code') == '400-1'
                               or 'token' in str(meta.get('message', '')).lower()):
                    continue  # توکن با این قالب هدر پذیرفته نشد؛ قالب دیگر را امتحان کن
                break
            msg = str(meta.get('message') or f"HTTP {r.status_code}")
            if meta.get('errors'):
                msg += ' ' + str(meta['errors'])
            return False, '', msg.replace(self.api_key, '***')[:300]
        except Exception as exc:
            safe = str(exc).replace(self.api_key, '***')
            logger.error("IPPanel send failed: %s", safe)
            return False, '', safe[:300]


# ---------------------------------------------------------------- کیف‌پول
def get_wallet(business, lock=False):
    wallet, _ = SmsWallet.objects.get_or_create(business=business)
    if lock:
        wallet = SmsWallet.objects.select_for_update().get(pk=wallet.pk)
    return wallet


def wallet_change(business, amount, kind, note='', campaign=None, charge_request=None, income=False, from_income=False,
                  income_amount=0):
    """
    تغییر موجودی کیف‌پول فروشنده (مثبت/منفی) + ثبت در دفتر. باید داخل transaction.atomic باشد.
    income=True: کل مبلغ مثبت «درآمد» است و به بخش قابل برداشت هم اضافه می‌شود.
    income_amount: فقط این مقدار از مبلغ مثبت به درآمد برمی‌گردد (برگشت هزینه‌ای که از درآمد پرداخت شده بود).
    from_income=True: برداشت فقط از بخش درآمد (برای تسویه به حساب بانکی).
    هزینه‌های عادی اول از موجودی شارژی کم می‌شوند؛ درآمد قابل برداشت هیچ‌وقت از موجودی بیشتر نمی‌شود.
    خروجی: wallet؛ wallet.income_taken = مقداری از این برداشت که از درآمد کم شد.
    """
    wallet = get_wallet(business, lock=True)
    if amount < 0 and wallet.balance < -amount:
        raise SmsError(f"موجودی کیف‌پول فروشنده کافی نیست. موجودی: {wallet.balance:,} تومان، هزینه: {-amount:,} تومان.")
    if from_income and amount < 0 and wallet.withdrawable < -amount:
        raise SmsError(f"درآمد قابل برداشت کافی نیست. قابل برداشت: {wallet.withdrawable:,} تومان.")
    before = wallet.withdrawable
    wallet.balance += amount
    if amount > 0:
        wallet.withdrawable += amount if income else min(amount, max(0, int(income_amount or 0)))
    elif amount < 0 and from_income:
        wallet.withdrawable += amount
    wallet.withdrawable = max(0, min(wallet.withdrawable, wallet.balance))
    wallet.save(update_fields=['balance', 'withdrawable', 'updated_at'])
    SmsLedger.objects.create(business=business, kind=kind, amount=amount, balance_after=wallet.balance,
                             note=note[:300], campaign=campaign, charge_request=charge_request)
    wallet.income_taken = max(0, before - wallet.withdrawable) if amount < 0 else 0
    return wallet


def refund_to(business, amount, kind, note, source=None, campaign=None):
    """
    برگشت هزینه. اگر بخشی از هزینه‌ی source (کمپین/پیامک/همکاری) از درآمد قابل برداشت پرداخت شده بود،
    همان بخش دوباره قابل برداشت می‌شود. باید داخل transaction.atomic باشد.
    """
    if amount <= 0:
        return None
    get_wallet(business, lock=True)  # قفل کیف‌پول تا محاسبه‌ی income_used هم‌زمان تکرار نشود
    inc = 0
    if source is not None and getattr(source, 'pk', None):
        model = type(source)
        current = model.objects.filter(pk=source.pk).values_list('income_used', flat=True).first() or 0
        inc = min(amount, current)
        if inc:
            model.objects.filter(pk=source.pk).update(income_used=F('income_used') - inc)
    return wallet_change(business, amount, kind, note, campaign=campaign, income_amount=inc)


def approve_charge(req, admin_user, note=''):
    with transaction.atomic():
        req = SmsChargeRequest.objects.select_for_update().get(pk=req.pk)
        if req.status != SmsChargeRequest.Status.PENDING:
            raise SmsError("این درخواست قبلاً بررسی شده است.")
        wallet_change(req.business, int(req.amount), SmsLedger.Kind.CHARGE, f"شارژ (درخواست #{req.pk})", charge_request=req)
        req.status = SmsChargeRequest.Status.APPROVED
        req.reviewed_by, req.reviewed_at, req.admin_note = admin_user, timezone.now(), note[:300]
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_note'])
    _notify_owner(req.business, "کیف‌پول فروشنده شارژ شد", f"{fa_num(req.amount)} تومان به موجودی کیف‌پول شما اضافه شد.")
    return req


def reject_charge(req, admin_user, note=''):
    updated = SmsChargeRequest.objects.filter(pk=req.pk, status=SmsChargeRequest.Status.PENDING).update(
        status=SmsChargeRequest.Status.REJECTED, reviewed_by=admin_user, reviewed_at=timezone.now(), admin_note=note[:300])
    if not updated:
        raise SmsError("این درخواست قبلاً بررسی شده است.")
    _notify_owner(req.business, "درخواست شارژ کیف‌پول رد شد", note or "برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.")


# ---------------------------------------------------------------- مخاطبان
def audience_queryset(business, filters):
    """مشتریان فروشگاه بر اساس فیلترها؛ مشتریانی که «لغو» کرده‌اند همیشه حذف می‌شوند."""
    f = filters or {}
    qs = StoreCustomer.objects.filter(business=business, sms_opt_out=False)
    if str(f.get('label') or '').isdigit():
        qs = qs.filter(labels__id=int(f['label']))
    if str(f.get('birth_month') or '').isdigit():
        qs = qs.filter(birth_month=int(f['birth_month']))
    if f.get('marital_status') in ('SINGLE', 'MARRIED'):
        qs = qs.filter(marital_status=f['marital_status'])
    if f.get('has_credit') in (True, '1', 1, 'true'):
        qs = qs.filter(credit_balance__gt=0)
    if f.get('has_account') in ('0', '1'):
        qs = qs.filter(user__isnull=f['has_account'] == '0')
    if str(f.get('inactive_days') or '').isdigit() and int(f['inactive_days']) > 0:
        cutoff = timezone.now() - datetime.timedelta(days=int(f['inactive_days']))
        qs = qs.filter(purchase_count__gt=0, last_purchase_at__lte=cutoff)
    if str(f.get('min_purchases') or '').isdigit() and int(f['min_purchases']) > 0:
        qs = qs.filter(purchase_count__gte=int(f['min_purchases']))
    if str(f.get('segment') or ''):
        # بخش‌بندی هوشمند (مرحله‌ی ۴) از این کلید استفاده می‌کند
        try:
            from .segments import apply_segment
            qs = apply_segment(qs, f['segment'], business)
        except ImportError:
            pass
    return qs.distinct()


def campaign_quote(business, text, filters):
    cfg = SmsSettings.get()
    full = with_opt_out(text, cfg)
    parts = sms_parts(full)
    count = audience_queryset(business, filters).count()
    return {
        "recipients": count, "parts": parts, "chars": len(full), "price_per_part": cfg.price_per_part,
        "cost": count * parts * cfg.price_per_part, "balance": get_wallet(business).balance,
        "final_text": full, "require_approval": cfg.require_approval,
    }


# ---------------------------------------------------------------- کمپین انبوه
def create_campaign(business, title, text, filters, user):
    text = (text or '').strip()
    if len(text) < 5:
        raise SmsError("متن پیامک خیلی کوتاه است.")
    if len(text) > 600:
        raise SmsError("متن پیامک حداکثر ۶۰۰ نویسه می‌تواند باشد.")
    cfg = SmsSettings.get()
    full = with_opt_out(text, cfg)
    parts = sms_parts(full)
    ids = [str(pk) for pk in audience_queryset(business, filters).values_list('pk', flat=True)]
    if not ids:
        raise SmsError("هیچ مشتری‌ای با این فیلترها پیدا نشد.")
    cost = len(ids) * parts * cfg.price_per_part
    with transaction.atomic():
        campaign = SmsCampaign.objects.create(
            business=business, title=(title or text[:40])[:120], text=full, filters=filters or {},
            recipient_ids=ids, recipients_count=len(ids), parts=parts, cost=cost, created_by=user,
        )
        # هزینه همین حالا رزرو می‌شود؛ در صورت رد/لغو برمی‌گردد
        w = wallet_change(business, -cost, SmsLedger.Kind.SEND, f"کمپین «{campaign.title}»", campaign=campaign)
        if w.income_taken:
            campaign.income_used = w.income_taken
            campaign.save(update_fields=['income_used'])
        if not cfg.require_approval:
            _start_campaign(campaign)
    if cfg.require_approval:
        _notify_admins("کمپین پیامکی در انتظار تأیید", f"{business.name}: «{campaign.title}» برای {fa_num(len(ids))} مشتری.")
    return campaign


def _start_campaign(campaign):
    """ساخت پیام‌های صف برای کمپین (هزینه قبلاً رزرو شده است)"""
    unit = campaign.cost // campaign.recipients_count if campaign.recipients_count else 0
    customers = StoreCustomer.objects.filter(pk__in=campaign.recipient_ids, business=campaign.business_id)
    rows, skipped = [], 0
    for c in customers.iterator():
        if c.sms_opt_out:
            skipped += 1
            continue
        rows.append(SmsMessage(business_id=campaign.business_id, campaign=campaign, customer=c, phone=c.phone_number,
                               text=campaign.text, kind=SmsMessage.Kind.BULK, parts=campaign.parts, cost=unit))
    SmsMessage.objects.bulk_create(rows, batch_size=500)
    missing = campaign.recipients_count - len(rows)
    if missing > 0:  # مشتری حذف‌شده یا لغوکرده: هزینه‌اش برمی‌گردد
        refund_to(campaign.business, missing * unit, SmsLedger.Kind.REFUND,
                  f"برگشت هزینه‌ی {missing} گیرنده‌ی حذف‌شده (کمپین «{campaign.title}»)", source=campaign, campaign=campaign)
    campaign.status = SmsCampaign.Status.SENDING if rows else SmsCampaign.Status.DONE
    campaign.save(update_fields=['status'])
    transaction.on_commit(kick_worker)


def approve_campaign(campaign, admin_user, note=''):
    with transaction.atomic():
        campaign = SmsCampaign.objects.select_for_update().get(pk=campaign.pk)
        if campaign.status != SmsCampaign.Status.PENDING:
            raise SmsError("این کمپین قبلاً بررسی شده است.")
        campaign.reviewed_by, campaign.reviewed_at, campaign.admin_note = admin_user, timezone.now(), note[:300]
        campaign.save(update_fields=['reviewed_by', 'reviewed_at', 'admin_note'])
        _start_campaign(campaign)
    _notify_owner(campaign.business, "کمپین پیامکی تأیید شد", f"«{campaign.title}» در حال ارسال است.")


def cancel_campaign(campaign, by_admin=None, note=''):
    """رد (ادمین) یا لغو (فروشنده) کمپین در انتظار؛ کل هزینه برمی‌گردد"""
    with transaction.atomic():
        campaign = SmsCampaign.objects.select_for_update().get(pk=campaign.pk)
        if campaign.status != SmsCampaign.Status.PENDING:
            raise SmsError("فقط کمپین در انتظار تأیید قابل لغو است.")
        campaign.status = SmsCampaign.Status.REJECTED if by_admin else SmsCampaign.Status.CANCELLED
        campaign.reviewed_by = by_admin
        campaign.reviewed_at = timezone.now() if by_admin else None
        campaign.admin_note = note[:300]
        campaign.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_note'])
        if campaign.cost:
            refund_to(campaign.business, campaign.cost, SmsLedger.Kind.REFUND,
                      f"برگشت هزینه‌ی کمپین «{campaign.title}»", source=campaign, campaign=campaign)
    if by_admin:
        _notify_owner(campaign.business, "کمپین پیامکی رد شد", note or f"«{campaign.title}» تأیید نشد و هزینه‌اش برگشت.")


# ---------------------------------------------------------------- پیامک تکی (خرید / طرح تشویقی)
def queue_single(business, customer, text, kind):
    """یک پیامک تکی؛ اگر موجودی کافی نباشد بی‌صدا ارسال نمی‌شود. خروجی: SmsMessage یا None"""
    if not customer or not customer.phone_number or not text:
        return None
    cfg = SmsSettings.get()
    parts = sms_parts(text)
    cost = parts * cfg.price_per_part
    try:
        with transaction.atomic():
            w = wallet_change(business, -cost, SmsLedger.Kind.SEND, f"پیامک {SmsMessage.Kind(kind).label}")
            msg = SmsMessage.objects.create(business=business, customer=customer, phone=customer.phone_number,
                                            text=text, kind=kind, parts=parts, cost=cost, income_used=w.income_taken)
    except SmsError:
        logger.info("SMS skipped (insufficient balance) for business %s", business.pk)
        return None
    transaction.on_commit(kick_worker)
    return msg


def send_purchase_sms(purchase):
    """پیامک بعد از خرید (هر مشتری حداکثر روزی یک پیامک خرید)"""
    from .services import get_settings
    try:
        business, customer = purchase.business, purchase.customer
        st = get_settings(business)
        if not st.purchase_sms_enabled:
            return None
        today = timezone.localdate()
        if SmsMessage.objects.filter(customer=customer, kind=SmsMessage.Kind.PURCHASE, created_at__date=today).exists():
            return None
        template = (purchase.line.sms_template if purchase.line and purchase.line.sms_template else st.purchase_sms_template)
        customer.refresh_from_db(fields=['credit_balance'])
        text = render(template, **{
            'نام': customer.full_name or 'مشتری', 'فروشگاه': business.name, 'مبلغ': fa_num(purchase.final_amount),
            'کش_بک': fa_num(purchase.cashback_amount), 'موجودی': fa_num(customer.credit_balance),
        })
        return queue_single(business, customer, text, SmsMessage.Kind.PURCHASE)
    except Exception:
        logger.exception("Purchase SMS failed")
        return None


def send_incentive_sms(reward):
    """پیامک هدیه‌ی طرح تشویقی (متن طرح)؛ مشتری لغوکرده پیامک نمی‌گیرد"""
    from .incentives import describe_reward
    from .services import get_settings
    try:
        plan, customer = reward.plan, reward.customer
        if not plan or not plan.message or customer.sms_opt_out:
            return None
        business = customer.business
        if not get_settings(business).incentive_sms_enabled:
            return None
        from .jalali import to_jalali_str
        customer.refresh_from_db(fields=['credit_balance'])
        text = render(plan.message, **{
            'نام': customer.full_name or 'مشتری', 'فروشگاه': business.name,
            'هدیه': describe_reward(reward.reward_type, reward.value, reward.max_discount, reward.gift_text),
            'اعتبار_تا': to_jalali_str(reward.valid_until), 'موجودی': fa_num(customer.credit_balance),
        })
        return queue_single(business, customer, with_opt_out(text), SmsMessage.Kind.INCENTIVE)
    except Exception:
        logger.exception("Incentive SMS failed")
        return None


# ---------------------------------------------------------------- صف ارسال
_worker_lock = threading.Lock()
_worker_running = False


def process_queue(limit=200):
    """ارسال پیام‌های در صف. خروجی: تعداد پردازش‌شده"""
    provider = get_provider()
    _fail_stale_sending()
    with transaction.atomic():
        batch = list(SmsMessage.objects.select_for_update(skip_locked=True)
                     .filter(status=SmsMessage.Status.QUEUED).order_by('created_at')[:limit])
        # برای جلوگیری از ارسال دوباره (cron و پس‌زمینه هم‌زمان)، قبل از ارسال «در حال ارسال» می‌شوند
        SmsMessage.objects.filter(pk__in=[m.pk for m in batch], status=SmsMessage.Status.QUEUED).update(
            status=SmsMessage.Status.SENDING, attempts=F('attempts') + 1, claimed_at=timezone.now())
    done = 0
    for msg in batch:
        ok, provider_id, error = provider.send(msg.phone, msg.text)
        with transaction.atomic():
            # فقط اگر هنوز «در حال ارسال» است (بازیابی پیام‌های گیرکرده آن را تغییر نداده باشد)
            pending = SmsMessage.objects.filter(pk=msg.pk, status=SmsMessage.Status.SENDING)
            if ok:
                if pending.update(status=SmsMessage.Status.SENT, provider_id=provider_id, sent_at=timezone.now()):
                    if msg.campaign_id:
                        SmsCampaign.objects.filter(pk=msg.campaign_id).update(sent_count=F('sent_count') + 1)
                    if msg.coop_id:
                        CoopShare.objects.filter(pk=msg.coop_id).update(sent_count=F('sent_count') + 1)
            elif pending.update(status=SmsMessage.Status.FAILED, error=error):
                _refund_failed(msg)
        done += 1
    # کمپین‌هایی که پیام در صف ندارند تمام‌شده‌اند
    SmsCampaign.objects.filter(status=SmsCampaign.Status.SENDING).exclude(
        messages__status__in=[SmsMessage.Status.QUEUED, SmsMessage.Status.SENDING]).update(status=SmsCampaign.Status.DONE, finished_at=timezone.now())
    _finish_coops()
    return done


def _refund_failed(msg):
    """برگشت هزینه‌ی پیامک ناموفق (داخل transaction). پیامک همکاری به کیف‌پول درخواست‌دهنده برمی‌گردد."""
    if msg.coop_id:
        coop = CoopShare.objects.filter(pk=msg.coop_id).select_related('requester').first()
        if coop and msg.cost:
            refund_to(coop.requester, msg.cost, SmsLedger.Kind.REFUND,
                      f"برگشت هزینه‌ی پیامک ناموفق همکاری «{coop.title}»", source=coop)
        CoopShare.objects.filter(pk=msg.coop_id).update(failed_count=F('failed_count') + 1)
        return
    if msg.cost:
        refund_to(msg.business, msg.cost, SmsLedger.Kind.REFUND, f"برگشت هزینه‌ی پیامک ناموفق به {msg.phone}",
                  source=msg.campaign if msg.campaign_id else msg, campaign=msg.campaign)
    if msg.campaign_id:
        SmsCampaign.objects.filter(pk=msg.campaign_id).update(failed_count=F('failed_count') + 1)


def _finish_coops():
    """اشتراک‌گذاری‌های دستی که پیام در صف ندارند تمام می‌شوند و سهم فروشگاه همکار (بابت ارسال‌های موفق) واریز می‌شود"""
    ids = list(CoopShare.objects.filter(status=CoopShare.Status.SENDING).exclude(
        messages__status__in=[SmsMessage.Status.QUEUED, SmsMessage.Status.SENDING]).values_list('pk', flat=True)[:50])
    for pk in ids:
        net = 0
        with transaction.atomic():
            coop = CoopShare.objects.select_for_update().filter(pk=pk, status=CoopShare.Status.SENDING).first()
            if not coop:
                continue
            net = coop.sent_count * coop.partner_price * (100 - coop.commission_percent) // 100
            coop.status, coop.finished_at, coop.partner_income = CoopShare.Status.DONE, timezone.now(), net
            coop.save(update_fields=['status', 'finished_at', 'partner_income'])
            if net:
                wallet_change(coop.partner, net, SmsLedger.Kind.COOP_IN,
                              f"درآمد ارسال پیشنهاد «{coop.requester.name}» برای {coop.sent_count} مشتری", income=True)
        if net:
            _notify_owner(coop.partner, "درآمد همکاری واریز شد", f"{fa_num(net)} تومان بابت ارسال پیشنهاد «{coop.requester.name}».",
                          link='/dashboard/owner/club/wallet')


def _fail_stale_sending():
    """پیام‌هایی که به‌خاطر قطع سرور در حالت «در حال ارسال» مانده‌اند ناموفق و هزینه‌شان برگشت داده می‌شود"""
    cutoff = timezone.now() - datetime.timedelta(minutes=15)
    for msg in SmsMessage.objects.filter(status=SmsMessage.Status.SENDING, claimed_at__lte=cutoff)[:200]:
        with transaction.atomic():
            n = SmsMessage.objects.filter(pk=msg.pk, status=SmsMessage.Status.SENDING).update(
                status=SmsMessage.Status.FAILED, error="ارسال نیمه‌کاره ماند (قطع سرور)")
            if n:
                _refund_failed(msg)


def _worker_loop():
    global _worker_running
    try:
        close_old_connections()
        while process_queue():
            time.sleep(0.2)
    except Exception:
        logger.exception("SMS worker crashed")
    finally:
        with _worker_lock:
            _worker_running = False
        try:
            # اگر در فاصله‌ی پایان حلقه پیام تازه‌ای در صف آمده، دوباره شروع کن
            again = SmsMessage.objects.filter(status=SmsMessage.Status.QUEUED).exists()
        except Exception:
            again = False
        close_old_connections()
        if again:
            time.sleep(1)  # اگر صف توسط cron قفل است، چرخش بی‌وقفه نداشته باشیم
            kick_worker()


def kick_worker():
    """شروع ارسال پس‌زمینه (اگر در حال اجرا نیست)"""
    global _worker_running
    with _worker_lock:
        if _worker_running:
            return
        _worker_running = True
    threading.Thread(target=_worker_loop, name="sms-worker", daemon=True).start()


# ---------------------------------------------------------------- اعلان‌ها
def _notify_owner(business, title, message, link='/dashboard/owner/club/sms'):
    try:
        from apps.notifications.models import Notification
        from apps.notifications.services import notify
        if business.owner_id:
            notify(business.owner_id, Notification.Category.BUSINESS, title, message, link)
    except Exception:
        logger.exception("SMS owner notification failed")


def _notify_admins(title, message, link='/admin-panel/sms'):
    try:
        from apps.notifications.models import Notification
        from apps.notifications.services import notify_admins
        notify_admins(Notification.Category.SYSTEM, title, message, link)
    except Exception:
        logger.exception("SMS admin notification failed")
