import logging
import secrets
import requests
import uuid
from django.conf import settings
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.directory.models import Business, DiscountCampaign, CampaignUsage
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from django.db import transaction
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from ipware import get_client_ip
from analytics.models import UserLoginLog

User = get_user_model()
logger = logging.getLogger(__name__)

# --- تنظیمات امنیتی OTP ---
OTP_TTL_SECONDS = 120            # اعتبار کد
OTP_RESEND_COOLDOWN = 120        # فاصله‌ی مجاز بین دو پیامک برای یک شماره
OTP_MAX_VERIFY_ATTEMPTS = 5      # حداکثر تلاش برای وارد کردن کد
OTP_IP_LIMIT_PER_HOUR = 10       # حداکثر درخواست کد از یک IP در ساعت
ALLOWED_SIGNUP_ROLES = ('CLIENT', 'BUSINESS_OWNER')


def _api_headers():
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.API_IR_KEY}",
    }


def _dev_mode_without_sms():
    """توسعه‌ی محلی بدون کلید api.ir: پیامک و شاهکار رد می‌شوند و کد فقط در ترمینال چاپ می‌شود"""
    return settings.DEBUG and not settings.API_IR_KEY


def _hit_limit(key, limit, window):
    """شمارنده‌ی ساده در کش؛ True یعنی از سقف عبور کرده"""
    added = cache.add(key, 1, timeout=window)
    if added:
        return False
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=window)
        return False
    return count > limit


class GenerateOTPView(APIView):
    def post(self, request):
        action = request.data.get('action')  # 'login' یا 'register'
        phone_number = str(request.data.get('phone_number') or '').strip()

        if action not in ('login', 'register'):
            return Response({"error": "نوع درخواست نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        if not (phone_number.isdigit() and len(phone_number) == 11 and phone_number.startswith('09')):
            return Response({"error": "شماره موبایل معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)

        # --- محدودیت ارسال: هر شماره یک پیامک در هر ۲ دقیقه ---
        if cache.get(f"otp_cooldown_{phone_number}"):
            return Response({"error": "کد قبلاً ارسال شده است. لطفاً ۲ دقیقه صبر کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # --- محدودیت هر IP ---
        ip, _ = get_client_ip(request)
        if ip and _hit_limit(f"otp_ip_{ip}", OTP_IP_LIMIT_PER_HOUR, 3600):
            return Response({"error": "تعداد درخواست‌ها زیاد است. لطفاً بعداً تلاش کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        user_exists = User.objects.filter(phone_number=phone_number).exists()

        role = request.data.get('role', 'CLIENT')
        if role not in ALLOWED_SIGNUP_ROLES:
            role = 'CLIENT'

        # --- ۱. منطق صفحه ثبت‌نام ---
        if action == 'register':
            if user_exists:
                return Response({"error": "شما قبلاً ثبت‌نام کرده‌اید. در حال انتقال به صفحه ورود..."}, status=status.HTTP_409_CONFLICT)

            national_id = str(request.data.get('national_id') or '').strip()
            if not (national_id.isdigit() and len(national_id) == 10):
                return Response({"error": "کد ملی معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(national_id=national_id).exists():
                return Response({"error": "این کد ملی قبلاً در سیستم ثبت شده است."}, status=status.HTTP_409_CONFLICT)

            # استعلام شاهکار
            if not _dev_mode_without_sms():
                shahkar_url = "https://s.api.ir/api/sw1/ShahkarLite"
                try:
                    shahkar_response = requests.post(
                        shahkar_url, json={"nationalCode": national_id, "mobile": phone_number},
                        headers=_api_headers(), timeout=15,
                    )
                    if not shahkar_response.json().get('data'):
                        return Response({"error": "کد ملی با شماره موبایل تطابق ندارد."}, status=status.HTTP_400_BAD_REQUEST)
                except Exception:
                    logger.exception("Shahkar request failed")
                    return Response({"error": "خطا در برقراری ارتباط با سرور شاهکار."}, status=status.HTTP_502_BAD_GATEWAY)

        # --- ۲. منطق صفحه ورود ---
        elif action == 'login':
            if not user_exists:
                return Response({"error": "شما هنوز ثبت‌نام نکرده‌اید. در حال انتقال به صفحه ثبت‌نام..."}, status=status.HTTP_404_NOT_FOUND)

        # --- ۳. تولید OTP امن ---
        otp = f"{secrets.randbelow(900000) + 100000}"

        # --- ۴. ارسال پیامک از طریق api.ir ---
        if not _dev_mode_without_sms():
            sms_url = "https://s.api.ir/api/sw1/SmsOTP"
            template_id = 1 if action == 'register' else 0  # 1=کد تایید, 0=کد ورود
            try:
                sms_response = requests.post(
                    sms_url, json={"code": otp, "mobile": phone_number, "template": template_id},
                    headers=_api_headers(), timeout=15,
                )
                sms_data = sms_response.json()
                if not sms_data.get('data'):
                    logger.error("SMS API error: %s", sms_data)
                    return Response({"error": "مشکلی در ارسال پیامک رخ داد. لطفاً دقایقی دیگر تلاش کنید."}, status=status.HTTP_502_BAD_GATEWAY)
            except Exception:
                logger.exception("SMS request failed")
                return Response({"error": "خطا در ارتباط با سرور پیامک."}, status=status.HTTP_502_BAD_GATEWAY)

        # --- ۵. ذخیره در کش ---
        cache.set(f"otp_data_{phone_number}", {
            "otp": otp,
            "action": action,
            "national_id": request.data.get('national_id'),
            "full_name": request.data.get('full_name'),
            "role": role,
            "business_name": request.data.get('business_name'),
        }, timeout=OTP_TTL_SECONDS)
        cache.delete(f"otp_attempts_{phone_number}")
        cache.set(f"otp_cooldown_{phone_number}", 1, timeout=OTP_RESEND_COOLDOWN)

        # فقط در حالت توسعه کد در ترمینال نمایش داده می‌شود
        if settings.DEBUG:
            print(f"\n >>> [DEV] OTP for {phone_number} : {otp} <<< \n")

        return Response({"message": "کد تایید پیامک شد."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    def post(self, request):
        phone_number = request.data.get('phone_number')
        user_otp = request.data.get('otp_code')
        referral_code = request.data.get('referral_code')

        cached_data = cache.get(f"otp_data_{phone_number}")

        if cached_data and str(cached_data['otp']) == str(user_otp):
            try:
                with transaction.atomic():
                    # ۱. ابتدا کد معرف را بررسی می‌کنیم (قبل از ساختن کاربر در دیتابیس)
                    campaign = None
                    if referral_code:
                        try:
                            campaign = DiscountCampaign.objects.select_for_update().get(
                                code=referral_code,
                                is_active=True
                            )
                            if campaign.current_usage >= campaign.max_usage:
                                return Response(
                                    {"error": "ظرفیت این کد تخفیف تکمیل شده است."},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                        except DiscountCampaign.DoesNotExist:
                            return Response(
                                {"error": "کد معرف نامعتبر است."},
                                status=status.HTTP_400_BAD_REQUEST
                            )

                    # ۲. حالا که از صحت کد معرف مطمئن شدیم، کاربر را می‌سازیم یا می‌گیریم
                    user, created = User.objects.get_or_create(phone_number=phone_number)

                    # ۳. اگر کد معرف معتبری وجود داشت، آن را برای کاربر ثبت می‌کنیم
                    if campaign:
                        usage, usage_created = CampaignUsage.objects.get_or_create(
                            client=user,
                            campaign=campaign
                        )
                        if usage_created:
                            campaign.current_usage += 1
                            campaign.save()

                    # ۴. تکمیل اطلاعات ثبت‌نام و ساخت کسب‌وکار (در صورت صاحب کسب‌وکار بودن)
                    if cached_data.get('action') == 'register' and (created or not user.is_shahkar_verified):
                        user.full_name = cached_data.get('full_name')
                        user.national_id = cached_data.get('national_id')
                        user.role = cached_data.get('role')
                        user.is_shahkar_verified = True
                        user.save()

                        if getattr(user, 'role', 'CLIENT') == 'BUSINESS_OWNER' and cached_data.get('business_name'):
                            Business.objects.get_or_create(
                                owner=user,
                                defaults={
                                    'name': cached_data['business_name'],
                                    'slug': str(uuid.uuid4())[:8]
                                }
                            )

                # پاک کردن کد تایید از کش بعد از موفقیت‌آمیز بودن همه مراحل
                cache.delete(f"otp_data_{phone_number}")

                refresh = RefreshToken.for_user(user)
                role_val = getattr(user, 'role', 'CLIENT')

                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'role': role_val,
                    'message': 'ورود با موفقیت انجام شد.'
                }, status=status.HTTP_200_OK)

            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({"error": f"خطای سرور: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"error": "کد تایید نامعتبر یا منقضی شده است."}, status=status.HTTP_400_BAD_REQUEST)

# کلاس‌های ادمین دست‌نخورده باقی می‌مانند
class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'phone_number', 'role', 'is_active', 'created_at']


    
class AdminUserViewSet(viewsets.ModelViewSet):
    """
    API ادمین جهت مشاهده لیست، ویرایش (مثل مسدودسازی) و مدیریت کاربران
    """
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]
    
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['phone_number', 'full_name', 'national_id', 'role']
        # شماره موبایل، کد ملی و نقش نباید توسط خود کاربر ویرایش شوند
        read_only_fields = ['phone_number', 'national_id', 'role']

class UserProfileView(RetrieveUpdateAPIView):
    """
    دریافت و ویرایش اطلاعات کاربری که لاگین کرده است
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        # این متد به صورت خودکار کاربری که توکن فرستاده را برمی‌گرداند
        return self.request.user
    
    
from .serializers import ClientProfileSerializer

class ClientDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ClientProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ClientReferralsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invited_users = User.objects.filter(referred_by=request.user).order_by('-created_at')
        
        friends_list = []
        for u in invited_users:
            friends_list.append({
                "phone": u.phone_number,
                "name": u.full_name or "کاربر ناشناس",
                "joined_at": u.created_at
            })

        return Response({
            "total_referral_profit": request.user.referral_profit,
            "total_invited_count": invited_users.count(),
            "friends": friends_list
        }, status=status.HTTP_200_OK)