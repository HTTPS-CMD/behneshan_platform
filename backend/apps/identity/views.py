import random
import requests
import uuid
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from apps.directory.models import Business, DiscountCampaign, CampaignUsage
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from apps.identity.models import User
from django.db import transaction
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

User = get_user_model()

class GenerateOTPView(APIView):
    def post(self, request):
        action = request.data.get('action') # 'login' یا 'register'
        phone_number = request.data.get('phone_number')

        if not phone_number:
            return Response({"error": "شماره موبایل الزامی است"}, status=status.HTTP_400_BAD_REQUEST)

        # بررسی وجود کاربر در دیتابیس
        user_exists = User.objects.filter(phone_number=phone_number).exists()
        
        # کلید API مشترک برای شاهکار و پیامک
        api_key = "cmJgVImeTHmOwa+kaXLBv+NR7PhPFK+WH0Jl4Zcv9jbGirjrJrA4BGgUyQPlFtcr/3h0NDT9N9UFkQms1urPNuDSVMLhAfHQQlKIEWhKqcw="
        api_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        # --- ۱. منطق صفحه ثبت‌نام ---
        if action == 'register':
            if user_exists:
                return Response({"error": "شما قبلاً ثبت‌نام کرده‌اید. در حال انتقال به صفحه ورود..."}, status=status.HTTP_409_CONFLICT)
            
            national_id = request.data.get('national_id')
            if User.objects.filter(national_id=national_id).exists():
                return Response({"error": "این کد ملی قبلاً در سیستم ثبت شده است."}, status=status.HTTP_409_CONFLICT)
                
            # استعلام شاهکار
            shahkar_url = "https://s.api.ir/api/sw1/ShahkarLite"
            try:
                shahkar_response = requests.post(shahkar_url, json={"nationalCode": national_id, "mobile": phone_number}, headers=api_headers)
                if not shahkar_response.json().get('data'):
                    return Response({"error": "کد ملی با شماره موبایل تطابق ندارد."}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                return Response({"error": "خطا در برقراری ارتباط با سرور شاهکار."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- ۲. منطق صفحه ورود ---
        elif action == 'login':
            if not user_exists:
                return Response({"error": "شما هنوز ثبت‌نام نکرده‌اید. در حال انتقال به صفحه ثبت‌نام..."}, status=status.HTTP_404_NOT_FOUND)

        # --- ۳. تولید OTP ---
        otp = str(random.randint(100000, 999999))
        
        # --- ۴. ارسال پیامک واقعی از طریق api.ir ---
        sms_url = "https://s.api.ir/api/sw1/SmsOTP"
        template_id = 1 if action == 'register' else 0  # 1=کد تایید, 0=کد ورود
        
        sms_payload = {
            "code": otp,
            "mobile": phone_number,
            "template": template_id
        }
        
        try:
            sms_response = requests.post(sms_url, json=sms_payload, headers=api_headers)
            sms_data = sms_response.json()
            
            if not sms_data.get('data'):
                # در صورتی که پنل پیامک ارور داد (مثلاً شارژ نداشت)
                print(f"SMS API Error: {sms_data}")
                return Response({"error": "مشکلی در ارسال پیامک رخ داد. لطفاً دقایقی دیگر تلاش کنید."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            print(f"SMS Request Exception: {e}")
            return Response({"error": "خطا در ارتباط با سرور پیامک."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # --- ۵. ذخیره در کش ---
        cache_data = {
            "otp": otp,
            "action": action,
            "national_id": request.data.get('national_id'),
            "full_name": request.data.get('full_name'),
            "role": request.data.get('role', 'CLIENT'),
            "business_name": request.data.get('business_name')
        }
        cache.set(f"otp_data_{phone_number}", cache_data, timeout=120)
        
        # لاگ برای دولوپر (همچنان در ترمینال چاپ می‌شود تا در زمان توسعه راحت باشی)
        print(f"\n >>> OTP for {phone_number} : {otp} (Template: {template_id}) <<< \n")
        
        return Response({"message": "کد تایید پیامک شد."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    def post(self, request):
        phone_number = request.data.get('phone_number')
        user_otp = request.data.get('otp_code')
        referral_code = request.data.get('referral_code')  # دریافت کد معرف از فرانت‌اند
        
        cached_data = cache.get(f"otp_data_{phone_number}")

        if cached_data and str(cached_data['otp']) == str(user_otp):
            try:
                # استفاده از تراکنش برای جلوگیری از ثبت ناقص در صورت خطا
                with transaction.atomic():
                    user, created = User.objects.get_or_create(phone_number=phone_number)
                    
                    # --- منطق اعمال کد معرف و تخفیف ---
                    if referral_code:
                        try:
                            # select_for_update دیتابیس را قفل می‌کند تا همزمان دو نفر ظرفیت آخر را نگیرند
                            campaign = DiscountCampaign.objects.select_for_update().get(
                                code=referral_code, 
                                is_active=True
                            )

                            if campaign.current_usage >= campaign.max_usage:
                                return Response(
                                    {"error": "ظرفیت استفاده از این کد معرف به پایان رسیده است."}, 
                                    status=status.HTTP_400_BAD_REQUEST
                                )

                            # ثبت رکورد استفاده (اگر از قبل برای این کاربر ثبت نشده باشد)
                            usage, usage_created = CampaignUsage.objects.get_or_create(
                                client=user,
                                campaign=campaign
                            )

                            if usage_created:
                                campaign.current_usage += 1
                                campaign.save()

                        except DiscountCampaign.DoesNotExist:
                            return Response(
                                {"error": "کد معرف وارد شده معتبر نیست یا غیرفعال شده است."}, 
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    # -----------------------------------
                    
                    if cached_data.get('action') == 'register' and (created or not user.is_shahkar_verified):
                        user.full_name = cached_data.get('full_name')
                        user.national_id = cached_data.get('national_id')
                        user.role = cached_data.get('role')
                        user.is_shahkar_verified = True
                        user.save()

                        if getattr(user, 'role', 'CLIENT') == 'BUSINESS_OWNER' and cached_data.get('business_name'):
                            Business.objects.get_or_create(
                                owner=user, defaults={'name': cached_data['business_name'], 'slug': str(uuid.uuid4())[:8]}
                            )

                # حذف کش و تولید توکن‌ها فقط پس از موفقیت کامل تراکنش
                cache.delete(f"otp_data_{phone_number}")
                refresh = RefreshToken.for_user(user)
                
                role_val = getattr(user, 'role', 'CLIENT')
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'role': role_val,
                    'message': 'ورود موفقیت‌آمیز'
                }, status=status.HTTP_200_OK)
                
            except Exception as e:
                import traceback
                traceback.print_exc() # این خط باعث می‌شود ارور با جزئیات کامل در ترمینال چاپ شود
                return Response({"error": f"جزئیات خطا: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                # return Response({"error": "خطایی در سمت سرور رخ داد. لطفاً مجدداً تلاش کنید."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({"error": "کد وارد شده نامعتبر است یا منقضی شده."}, status=status.HTTP_400_BAD_REQUEST)

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