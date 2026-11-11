"""
تأیید مشتری در CRM فروشنده (H4)

قبلاً فروشنده با وارد کردن هر شماره‌ای، اطلاعات صاحب شماره را می‌دید و می‌توانست برایش تراکنش ثبت کند.
حالا فروشنده فقط با «کد خرید» یک‌بارمصرفی که از خود مشتری می‌گیرد به اطلاعات دسترسی دارد. کد به دو روش ساخته می‌شود:
  ۱. مشتری در پنل خودش دکمه‌ی «کد خرید حضوری» را می‌زند.
  ۲. فروشنده دکمه‌ی «ارسال کد با پیامک» را می‌زند و کد برای مشتری پیامک می‌شود.
بعد از تأیید کد، یک verification_token کوتاه‌مدت ساخته می‌شود و ثبت تراکنش فقط با همان توکن ممکن است.
"""
import logging
import secrets

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.views import _api_headers, _dev_mode_without_sms, _hit_limit

from .utils import get_owner_business

User = get_user_model()
logger = logging.getLogger(__name__)

PURCHASE_CODE_TTL = 300          # اعتبار کد خرید: ۵ دقیقه
PURCHASE_CODE_MAX_ATTEMPTS = 5   # حداکثر تلاش اشتباه برای هر کد
SMS_COOLDOWN = 120               # فاصله‌ی مجاز بین دو پیامک برای یک شماره
OWNER_SMS_LIMIT_PER_HOUR = 20    # حداکثر پیامک هر فروشنده در ساعت
OWNER_VERIFY_LIMIT_PER_HOUR = 60 # حداکثر استعلام هر فروشنده در ساعت
VERIFICATION_TTL = 600           # فرصت ثبت تراکنش بعد از تأیید: ۱۰ دقیقه


def normalize_phone(raw):
    phone = str(raw or '').strip()
    # تبدیل ارقام فارسی و عربی به انگلیسی
    phone = phone.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    if phone.isdigit() and len(phone) == 11 and phone.startswith('09'):
        return phone
    return None


def mask_name(full_name):
    """«علی محمدی» -> «علی م***»"""
    if not full_name:
        return "کاربر چهارسوق"
    parts = full_name.split()
    if len(parts) == 1:
        return f"{parts[0][:2]}***"
    return f"{parts[0]} {parts[1][0]}***"


def _code_key(phone):
    return f"crm_pcode_{phone}"


def _issue_code(phone):
    code = f"{secrets.randbelow(900000) + 100000}"
    cache.set(_code_key(phone), code, timeout=PURCHASE_CODE_TTL)
    cache.delete(f"crm_pcode_attempts_{phone}")
    return code


class IsVerifiedBusinessOwner(permissions.BasePermission):
    """فقط صاحبان کسب‌وکارهای تأییدشده توسط ادمین به CRM دسترسی دارند."""
    message = "کسب‌وکار شما هنوز توسط مدیریت تأیید نشده است. پس از تأیید، بخش پذیرش مشتری فعال می‌شود."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and getattr(user, 'role', None) == 'BUSINESS_OWNER'):
            return False
        business = get_owner_business(user)
        return bool(business and business.is_verified)


# ---------- سمت مشتری ----------
class ClientPurchaseCodeView(APIView):
    """مشتری یک کد خرید ۶ رقمی با اعتبار ۵ دقیقه می‌گیرد تا به فروشنده نشان دهد."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        phone = normalize_phone(request.user.phone_number)
        if not phone:
            return Response({"error": "شماره موبایل حساب شما معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        if _hit_limit(f"crm_client_codes_{request.user.pk}", 20, 3600):
            return Response({"error": "تعداد درخواست کد زیاد است. لطفاً بعداً تلاش کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        code = _issue_code(phone)
        return Response({"code": code, "expires_in": PURCHASE_CODE_TTL}, status=status.HTTP_200_OK)


# ---------- سمت فروشنده ----------
class OwnerSendPurchaseCodeView(APIView):
    """فروشنده درخواست می‌دهد کد خرید برای مشتری پیامک شود."""
    permission_classes = [IsAuthenticated, IsVerifiedBusinessOwner]

    def post(self, request):
        phone = normalize_phone(request.data.get('phone_number'))
        if not phone:
            return Response({"error": "شماره موبایل معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        if cache.get(f"crm_sms_cooldown_{phone}"):
            return Response({"error": "کد قبلاً ارسال شده است. لطفاً ۲ دقیقه صبر کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if _hit_limit(f"crm_owner_sms_{request.user.pk}", OWNER_SMS_LIMIT_PER_HOUR, 3600):
            return Response({"error": "سقف ارسال پیامک در این ساعت پر شده است."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        generic = {"message": "اگر این شماره عضو چهارسوق باشد، کد خرید برای مشتری پیامک شد."}
        # مشتری‌هایی که فروشنده در «باشگاه مشتریان» ثبت کرده هم (حتی بدون حساب سایت) کد می‌گیرند
        from apps.loyalty.models import ShareVoucher, StoreCustomer
        business = get_owner_business(request.user)
        is_member = (
            User.objects.filter(phone_number=phone).exists()
            or StoreCustomer.objects.filter(business=business, phone_number=phone).exists()
            # مشتری جدیدی که کوپن همکاری این فروشگاه را دارد (ShareClub)
            or ShareVoucher.objects.filter(target=business, phone=phone, status=ShareVoucher.Status.ISSUED).exists()
        )
        if not is_member:
            # پاسخ یکسان، تا نشود با این endpoint فهمید چه کسی عضو سایت است
            return Response(generic, status=status.HTTP_200_OK)

        code = _issue_code(phone)
        cache.set(f"crm_sms_cooldown_{phone}", 1, timeout=SMS_COOLDOWN)

        if _dev_mode_without_sms():
            print(f"\n >>> [DEV] CRM purchase code for {phone} : {code} <<< \n")
        else:
            try:
                resp = requests.post(
                    "https://s.api.ir/api/sw1/SmsOTP",
                    json={"code": code, "mobile": phone, "template": 1},  # 1 = کد تایید
                    headers=_api_headers(), timeout=15,
                )
                if not resp.json().get('data'):
                    logger.error("CRM SMS API error: %s", resp.text[:300])
                    cache.delete(_code_key(phone))
                    return Response({"error": "مشکلی در ارسال پیامک رخ داد."}, status=status.HTTP_502_BAD_GATEWAY)
            except Exception:
                logger.exception("CRM SMS request failed")
                cache.delete(_code_key(phone))
                return Response({"error": "خطا در ارتباط با سرور پیامک."}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(generic, status=status.HTTP_200_OK)


def check_purchase_code(owner_user, raw_phone, raw_code):
    """
    شماره و کد خرید را بررسی و در صورت درستی مصرف می‌کند (مشترک بین CRM قدیمی و باشگاه مشتریان).
    خروجی: (phone, error_response)
    """
    phone = normalize_phone(raw_phone)
    code = str(raw_code or '').strip().translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789'))
    if not phone or not (code.isdigit() and len(code) == 6):
        return None, Response({"error": "شماره موبایل و کد خرید ۶ رقمی مشتری الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

    if _hit_limit(f"crm_owner_verify_{owner_user.pk}", OWNER_VERIFY_LIMIT_PER_HOUR, 3600):
        return None, Response({"error": "تعداد استعلام‌ها زیاد است. لطفاً بعداً تلاش کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    stored = cache.get(_code_key(phone))
    error = Response({"error": "کد خرید اشتباه است یا منقضی شده. از مشتری بخواهید کد جدید بگیرد."}, status=status.HTTP_400_BAD_REQUEST)
    if not stored:
        return None, error

    if _hit_limit(f"crm_pcode_attempts_{phone}", PURCHASE_CODE_MAX_ATTEMPTS, PURCHASE_CODE_TTL):
        cache.delete(_code_key(phone))  # بعد از ۵ تلاش اشتباه کد باطل می‌شود
        return None, error

    if not secrets.compare_digest(stored, code):
        return None, error

    # کد یک‌بارمصرف است
    cache.delete(_code_key(phone))
    cache.delete(f"crm_pcode_attempts_{phone}")
    return phone, None


def verify_purchase_code(request):
    """
    شماره و کد خرید را بررسی می‌کند (CRM قدیمی؛ فقط کاربران دارای حساب سایت).
    خروجی: (customer, business, error_response)
    """
    phone, error = check_purchase_code(request.user, request.data.get('phone_number'), request.data.get('purchase_code'))
    if error:
        return None, None, error
    customer = User.objects.filter(phone_number=phone).first()
    if not customer:
        return None, None, Response({"error": "این مشتری حساب کاربری در سایت ندارد. از بخش «باشگاه مشتریان» استفاده کنید."}, status=status.HTTP_400_BAD_REQUEST)
    return customer, get_owner_business(request.user), None


def create_verification_token(customer, business):
    token = secrets.token_urlsafe(24)
    cache.set(f"crm_verified_{token}", {"customer_id": str(customer.pk), "business_id": str(business.pk)}, timeout=VERIFICATION_TTL)
    return token


def consume_verification_token(token, business):
    """توکن را یک بار مصرف می‌کند و مشتری را برمی‌گرداند (یا None)."""
    if not token:
        return None
    data = cache.get(f"crm_verified_{token}")
    if not data or data.get("business_id") != str(business.pk):
        return None
    cache.delete(f"crm_verified_{token}")
    return User.objects.filter(pk=data["customer_id"]).first()
