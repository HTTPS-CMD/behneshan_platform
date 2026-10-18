from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction as db_transaction
from django.db.migrations import serializer
from django.utils import timezone
from datetime import timedelta
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, UpdateAPIView, ListCreateAPIView, ValidationError
from rest_framework.response import Response
from rest_framework import status, generics, viewsets
from django.shortcuts import get_object_or_404
from .models import Business, CampaignUsage, DiscountCampaign, Review, DiscountService, TransactionLog, UserBusinessVisit, SubscriptionPlan, CustomerProfile
from .serializers import BusinessListSerializer, BusinessCreateSerializer, BusinessSerializer, BusinessUpdateSerializer, CampaignUsageSerializer, DiscountCampaignSerializer, PublicStorySerializer, ReviewSerializer, TransactionLogSerializer, ClientCampaignUsageSerializer, SubscriptionPlanSerializer, AdminTransactionLogSerializer, UserBusinessVisitSerializer
from rest_framework.permissions import IsAdminUser, IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from .permissions import IsOwner, IsBusinessOwnerRole
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Avg
from django.db import transaction
from apps.taxonomy.models import Category, Location
from .models import Business, DiscountCampaign, Product

User = get_user_model()

# === ۱. تعریف کلاس صفحه‌بندی اختصاصی ===
class BusinessPagination(PageNumberPagination):
    page_size = 9  # نمایش ۹ کسب‌وکار در هر صفحه (بهترین حالت برای گرید ۳ ستونه)
    page_size_query_param = 'page_size'
    max_page_size = 50

# ۱. ویو برای دریافت لیست تمام کسب‌وکارها (فقط ادمین)
class AdminBusinessListView(generics.ListAPIView):
    # گرفتن تمام کسب‌وکارها به ترتیب جدیدترین‌ها
    queryset = Business.objects.all().order_by('-created_at') 
    serializer_class = BusinessSerializer
    permission_classes = [IsAdminUser] # فقط کاربرانی که is_staff=True هستند

# ۲. ویو برای تغییر وضعیت تایید کسب‌وکار (Verify)
class AdminVerifyBusinessView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        business = get_object_or_404(Business, pk=pk)
        
        # دریافت مقدار جدید از فرانت‌اند
        is_verified = request.data.get('is_verified')
        
        if is_verified is not None:
            # تبدیل به نوع بولین برای اطمینان
            business.is_verified = bool(is_verified)
            business.save()
            return Response(
                {"message": "وضعیت تایید کسب‌وکار با موفقیت تغییر کرد.", "is_verified": business.is_verified},
                status=status.HTTP_200_OK
            )
            
        return Response(
            {"error": "مقدار is_verified در درخواست ارسال نشده است."},
            status=status.HTTP_400_BAD_REQUEST
        )

# === ۲. بازنویسی ویوی لیست با ListAPIView ===
class BusinessListView(ListAPIView):
    serializer_class = BusinessListSerializer
    pagination_class = BusinessPagination

    def get_queryset(self):
        # مرتب‌سازی بر اساس جدیدترین‌ها
        queryset = Business.objects.all().order_by('-created_at')
        
        # دریافت پارامترهای سرچ
        search_query = self.request.query_params.get('search', '')
        category_id = self.request.query_params.get('category', '')
        location_id = self.request.query_params.get('location', '')

        # اعمال فیلترها
        if search_query:
            queryset = queryset.filter(name__icontains=search_query)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if location_id:
            queryset = queryset.filter(location_id=location_id)
            
        return queryset
    
class BusinessCreateView(APIView):
    permission_classes = [IsAuthenticated] 

    def post(self, request):
        serializer = BusinessCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            
            response_data = serializer.data
            
            # --- منطق ارتقای خودکار نقش کاربر ---
            if hasattr(request.user, 'role') and request.user.role == 'CLIENT':
                request.user.role = 'BUSINESS_OWNER'
                request.user.save()
                
                refresh = RefreshToken.for_user(request.user)
                response_data['new_tokens'] = {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'role': request.user.role
                }
                
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class UserBusinessListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def get(self, request):
        businesses = Business.objects.filter(owner=request.user)
        serializer = BusinessSerializer(businesses, many=True) 
        return Response(serializer.data)
    
class BusinessDetailView(RetrieveAPIView):
    queryset = Business.objects.all()
    serializer_class = BusinessSerializer
    lookup_field = 'slug'
    
    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        if request.user.is_authenticated:
            business = self.get_object()
            UserBusinessVisit.objects.update_or_create(
                user=request.user, business=business
            )
        return response
    
class BusinessUpdateView(UpdateAPIView):
    queryset = Business.objects.all()
    serializer_class = BusinessUpdateSerializer
    lookup_field = 'slug'
    permission_classes = [IsAuthenticated, IsOwner]
    
class BusinessReviewListView(ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        slug = self.kwargs['slug']
        return Review.objects.filter(business__slug=slug)

    def perform_create(self, serializer):
        slug = self.kwargs['slug']
        business = get_object_or_404(Business, slug=slug)
        if Review.objects.filter(business=business, user=self.request.user).exists():
            raise ValidationError({"error": "شما قبلاً برای این کسب‌وکار نظر ثبت کرده‌اید."})
        serializer.save(user=self.request.user, business=business)
        
        reviews = business.reviews.all()
        business.review_count = reviews.count()
        business.average_rating = round(reviews.aggregate(Avg('rating'))['rating__avg'] or 0.0, 1)
        business.save()
        
class ReplyToReviewView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        if review.business.owner != request.user:
            return Response(
                {"error": "شما دسترسی لازم برای پاسخ به این نظر را ندارید."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        reply_text = request.data.get('owner_reply')
        if not reply_text:
            return Response({"error": "متن پاسخ نمی‌تواند خالی باشد."}, status=status.HTTP_400_BAD_REQUEST)
        
        review.owner_reply = reply_text
        review.reply_date = timezone.now()
        review.save()
        return Response({"message": "پاسخ شما با موفقیت ثبت شد."}, status=status.HTTP_200_OK)
    
class BusinessAnalyticsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = [
            { "name": "هفته اول", "views": 120, "engagement": 45 },
            { "name": "هفته دوم", "views": 150, "engagement": 60 },
            { "name": "هفته سوم", "views": 180, "engagement": 75 },
            { "name": "هفته چهارم", "views": 210, "engagement": 90 },
            { "name": "هفته پنجم", "views": 250, "engagement": 110 },
            { "name": "هفته ششم", "views": 300, "engagement": 140 },
        ]
        return Response(data)
    
class ValidateCampaignCodeView(APIView):
    permission_classes = [AllowAny] 

    def get(self, request):
        code = request.query_params.get('code')
        if not code:
            return Response({"error": "کد معرف ارسال نشده است."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            campaign = DiscountCampaign.objects.get(code=code, is_active=True)
            if campaign.current_usage >= campaign.max_usage:
                return Response({"error": "ظرفیت استفاده از این کد تکمیل شده است."}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                "campaign_id": campaign.id,
                "business_name": campaign.business.name,
                "discount_percent": campaign.discount_percent,
                "message": f"کد معتبر است. شما در حال ثبت‌نام از طرف {campaign.business.name} هستید."
            }, status=status.HTTP_200_OK)
            
        except DiscountCampaign.DoesNotExist:
            return Response({"error": "کد معرف نامعتبر است یا منقضی شده."}, status=status.HTTP_404_NOT_FOUND)
        
class OwnerCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = DiscountCampaignSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DiscountCampaign.objects.filter(business__owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        user_business = self.request.user.businesses.first()
        if not user_business:
            raise ValidationError({"error": "شما هنوز هیچ کسب‌وکاری ثبت نکرده‌اید."})
        serializer.save(business=user_business)

    @action(detail=True, methods=['get'])
    def usages(self, request, pk=None):
        campaign = self.get_object()
        usages = campaign.usages.all().order_by('-claimed_at')
        serializer = CampaignUsageSerializer(usages, many=True)
        return Response(serializer.data)

class OwnerRedeemDiscountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, usage_id):
        usage = get_object_or_404(
            CampaignUsage, 
            id=usage_id, 
            campaign__business__owner=request.user
        )

        if usage.is_redeemed:
            return Response({"error": "این تخفیف قبلاً اعمال و سوزانده شده است."}, status=status.HTTP_400_BAD_REQUEST)

        usage.is_redeemed = True
        usage.save()
        return Response({"message": "تخفیف با موفقیت اعمال و سوزانده شد."}, status=status.HTTP_200_OK)
    
class BusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        business = request.user.businesses.first()
        if not business:
            return Response({"error": "هنوز کسب‌وکاری برای شما ثبت نشده است."}, status=404)
        serializer = BusinessSerializer(business)
        return Response(serializer.data)

    def patch(self, request):
        business = request.user.businesses.first()
        if not business:
            return Response({"error": "هنوز کسب‌وکاری برای شما ثبت نشده است."}, status=404)
        # فقط فیلدهای مجاز (نه تایید، امتیاز، مالک و ...) قابل ویرایش هستند
        serializer = BusinessUpdateSerializer(business, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(BusinessSerializer(business).data)
        return Response(serializer.errors, status=400)
    
class OwnerAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # get() برای کاربری با بیش از یک کسب‌وکار خطای 500 می‌داد
        business = request.user.businesses.first()
        if not business:
            return Response({
                "total_views": 0,
                "total_engagements": 0,
                "average_rating": 0,
                "campaign_uses": 0,
            })

        campaigns = DiscountCampaign.objects.filter(business=business)
        campaign_uses = CampaignUsage.objects.filter(campaign__in=campaigns).count()

        return Response({
            "total_views": business.views_count, 
            "total_engagements": business.engagement_count, 
            "average_rating": business.average_rating, 
            "campaign_uses": campaign_uses,
        })
        
class VerifyCustomerDiscountView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def post(self, request):
        phone_number = request.data.get('phone_number')
        if not phone_number:
            return Response({"error": "شماره موبایل الزامی است."}, status=status.HTTP_400_BAD_REQUEST)
        business = request.user.businesses.first()
        if not business:
            return Response({"error": "کسب و کاری یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            customer = User.objects.get(phone_number=phone_number)
            discount_data = DiscountService.get_best_discount(customer, business)
            
            user_discount = 0
            if hasattr(customer, 'customer_profile') and customer.customer_profile.has_active_subscription:
                user_discount = customer.customer_profile.active_plan.base_discount_percentage
                
            campaign_discount = 0
            valid_usage = CampaignUsage.objects.filter(client=customer, campaign__business=business, is_redeemed=False).order_by('-campaign__discount_percent').first()
            if valid_usage:
                campaign_discount = valid_usage.campaign.discount_percent or 0

            return Response({
                "customer_name": customer.full_name or "کاربر ناشناس",
                "phone_number": customer.phone_number,
                "discount_percentage": discount_data['final_discount'],
                "discount_source": discount_data['source'],
                "vip_discount": user_discount,
                "campaign_discount": campaign_discount
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "مشتری با این شماره یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

class RecordTransactionView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def post(self, request):
        phone_number = request.data.get('phone_number')
        original_amount = request.data.get('original_amount')
        
        if not phone_number or not original_amount:
            return Response({"error": "اطلاعات ناقص است."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            original_amount = Decimal(str(original_amount))
        except InvalidOperation:
            return Response({"error": "مبلغ نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)
        if original_amount <= 0:
            return Response({"error": "مبلغ باید بیشتر از صفر باشد."}, status=status.HTTP_400_BAD_REQUEST)

        business = request.user.businesses.first()
        if not business:
            return Response({"error": "کسب و کاری یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response({"error": "مشتری با این شماره یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        # ثبت تراکنش و سوزاندن کد باید با هم انجام شوند تا یک کد دو بار استفاده نشود
        with db_transaction.atomic():
            discount_data = DiscountService.get_best_discount(customer, business)
            discount_pct = discount_data['final_discount']

            # محاسبه‌ی پولی با Decimal و گرد کردن به تومان
            final_amount = (original_amount * (100 - discount_pct) / 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)

            TransactionLog.objects.create(
                business=business,
                customer=customer,
                original_amount=original_amount,
                applied_discount_percentage=discount_pct,
                discount_source=discount_data['source'],
                final_amount=final_amount
            )

            # *** سوزاندن کد در صورت استفاده از کمپین اختصاصی ***
            if discount_data['source'] == 'CAMPAIGN' and discount_data.get('campaign_id'):
                CampaignUsage.objects.filter(
                    campaign_id=discount_data['campaign_id'],
                    client=customer,
                    is_redeemed=False
                ).update(is_redeemed=True)

        return Response({
            "message": "تراکنش با موفقیت ثبت شد",
            "final_amount": final_amount
        }, status=status.HTTP_201_CREATED)
        
class OwnerCustomersListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def get(self, request):
        business = request.user.businesses.first()
        if not business:
            return Response({"error": "شما کسب‌وکاری ندارید."}, status=status.HTTP_404_NOT_FOUND)

        transactions = TransactionLog.objects.filter(business=business).order_by('-created_at')
        serializer = TransactionLogSerializer(transactions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class SubscriptionPlanListView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('price_per_month')
        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class PurchaseSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # تا زمان اتصال درگاه پرداخت، فعال‌سازی رایگان اشتراک بسته است
        return Response(
            {"error": "خرید اشتراک به‌زودی از طریق درگاه پرداخت فعال می‌شود."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({"error": "شناسه پلن ارسال نشده است."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "پلن انتخابی معتبر نیست."}, status=status.HTTP_404_NOT_FOUND)
            
        profile, created = CustomerProfile.objects.get_or_create(user=request.user)
        
        profile.active_plan = plan
        profile.plan_expiry_date = timezone.now() + timedelta(days=30)
        profile.save()

        return Response({
            "message": f"اشتراک {plan.name} با موفقیت برای شما فعال شد.",
            "expiry_date": profile.plan_expiry_date
        }, status=status.HTTP_200_OK)
        
class ClientRecentViewsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        visits = UserBusinessVisit.objects.filter(user=request.user)[:5]
        serializer = UserBusinessVisitSerializer(visits, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class ClientVIPStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            profile = CustomerProfile.objects.get(user=request.user)
            if profile.has_active_subscription:
                return Response({
                    "is_vip": True,
                    "plan_name": profile.active_plan.name,
                    "discount_percentage": profile.active_plan.base_discount_percentage,
                    "expiry_date": profile.plan_expiry_date
                }, status=status.HTTP_200_OK)
        except CustomerProfile.DoesNotExist:
            pass
        return Response({"is_vip": False}, status=status.HTTP_200_OK)

class ClaimCampaignView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        campaign_id = request.data.get('campaign_id')
        if not campaign_id:
            return Response({"error": "آیدی کمپین نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)
        
        # قفل ردیف کمپین تا درخواست‌های هم‌زمان نتوانند از سقف ظرفیت رد شوند
        with db_transaction.atomic():
            campaign = get_object_or_404(DiscountCampaign.objects.select_for_update(), id=campaign_id, is_active=True)

            # unique_together اجازه‌ی دو رکورد برای یک مشتری نمی‌دهد، پس هر رکوردی (حتی استفاده‌شده) را چک می‌کنیم
            if CampaignUsage.objects.filter(client=request.user, campaign=campaign).exists():
                return Response({"message": "شما قبلا این کد را دریافت کرده‌اید.", "code": campaign.code}, status=status.HTTP_200_OK)

            if campaign.current_usage >= campaign.max_usage:
                return Response({"error": "ظرفیت این کمپین تکمیل شده است."}, status=status.HTTP_400_BAD_REQUEST)

            CampaignUsage.objects.create(client=request.user, campaign=campaign)
            campaign.current_usage += 1
            campaign.save(update_fields=['current_usage'])

        return Response({"message": "کد تخفیف با موفقیت دریافت شد.", "code": campaign.code}, status=status.HTTP_201_CREATED)

class ClientCampaignsListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        usages = CampaignUsage.objects.filter(client=request.user).order_by('-claimed_at')
        serializer = ClientCampaignUsageSerializer(usages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

# --- APIهای بخش SuperAdmin ---
class AdminSubscriptionPlanListCreateView(generics.ListCreateAPIView):
    queryset = SubscriptionPlan.objects.all().order_by('price_per_month')
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAdminUser] 

class AdminSubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAdminUser]

class AdminTransactionLogListView(generics.ListAPIView):
    queryset = TransactionLog.objects.select_related('business', 'customer').order_by('-created_at')
    serializer_class = AdminTransactionLogSerializer
    permission_classes = [IsAdminUser]
    
    
from .models import SiteContent
from .serializers import SiteContentSerializer

# API عمومی برای نمایش در صفحات سایت (بدون نیاز به لاگین)
class PublicSiteContentView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, page_type):
        # فقط صفحه‌های تعریف‌شده مجازند؛ وگرنه هر آدرس دلخواه یک رکورد جدید در دیتابیس می‌ساخت
        if page_type not in dict(SiteContent.PAGE_CHOICES):
            return Response({"error": "صفحه یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        # استفاده از get_or_create به جای get_object_or_404
        # به این شکل اگر متنی در دیتابیس نباشد، یک صفحه با متن پیش‌فرض می‌سازد تا سایت ارور ندهد
        content, created = SiteContent.objects.get_or_create(
            page_type=page_type,
            defaults={
                'title': 'در حال بروزرسانی',
                'content': 'محتوای این صفحه به زودی توسط مدیریت سایت تکمیل خواهد شد.'
            }
        )
        serializer = SiteContentSerializer(content)
        return Response(serializer.data, status=status.HTTP_200_OK)

# API مدیریت برای پنل ادمین (مخصوص ادمین کل)
class AdminSiteContentView(APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request, page_type):
        content_obj = get_object_or_404(SiteContent, page_type=page_type)
        serializer = SiteContentSerializer(content_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, page_type):
        if page_type not in dict(SiteContent.PAGE_CHOICES):
            return Response({"error": "صفحه یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        content_obj, created = SiteContent.objects.get_or_create(page_type=page_type)
        serializer = SiteContentSerializer(content_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
from rest_framework import generics, permissions
from django.utils import timezone
from datetime import timedelta
from .models import Story, Business
from .serializers import StorySerializer

# API 1: مخصوص پنل صاحب کسب‌وکار (آپلود، لیست استوری‌های خودش، حذف)
class BusinessOwnerStoryView(generics.ListCreateAPIView):
    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # اصلاح شد: استفاده از in و businesses.all()
        return Story.objects.filter(business__in=self.request.user.businesses.all())

class BusinessOwnerStoryDetailView(generics.DestroyAPIView):
    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # اصلاح شد
        return Story.objects.filter(business__in=self.request.user.businesses.all())


# API 2: مخصوص صفحه اصلی سایت (نمایش استوری‌های فعال همه کسب‌وکارها)
class PublicActiveStoriesView(generics.ListAPIView):
    serializer_class = PublicStorySerializer # تغییر به سریالایزر جدید
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        time_threshold = timezone.now() - timedelta(hours=24)
        return Story.objects.filter(created_at__gte=time_threshold)
    
    

from django.db.models import Sum
from .models import Product, BusinessRequest
from .serializers import ProductSerializer, BusinessRequestSerializer

# گزارش فروش روزانه، ماهانه، سالانه و تعداد دنبال‌کنندگان
class BusinessSalesSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def get(self, request):
        business = request.user.businesses.first()
        if not business:
            return Response({"error": "کسب‌وکاری یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now - timedelta(days=30)
        year_start = now - timedelta(days=365)

        txs = TransactionLog.objects.filter(business=business)

        return Response({
            "daily_sales": txs.filter(created_at__gte=today_start).aggregate(total=Sum('final_amount'))['total'] or 0,
            "monthly_sales": txs.filter(created_at__gte=month_start).aggregate(total=Sum('final_amount'))['total'] or 0,
            "yearly_sales": txs.filter(created_at__gte=year_start).aggregate(total=Sum('final_amount'))['total'] or 0,
            "followers_count": business.followers.count(),
        }, status=status.HTTP_200_OK)

# مدیریت محصولات و تخفیف‌ها
class BusinessProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def get_queryset(self):
        business = self.request.user.businesses.first()
        if not business:
            return Product.objects.none()
        return Product.objects.filter(business=business).order_by('-created_at')

    def perform_create(self, serializer):
        business = self.request.user.businesses.first()
        if not business:
            raise ValidationError({"error": "ابتدا باید یک کسب‌وکار ثبت کنید."})
        serializer.save(business=business)

# درخواست‌های نردبان، پیامک و معرفی ویژه
class BusinessRequestListCreateView(ListCreateAPIView):
    serializer_class = BusinessRequestSerializer
    permission_classes = [IsAuthenticated, IsBusinessOwnerRole]

    def get_queryset(self):
        return BusinessRequest.objects.filter(business__owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        business = self.request.user.businesses.first()
        if not business:
            raise ValidationError({"error": "کسب‌وکاری یافت نشد."})
        serializer.save(business=business)

# رده‌بندی کاسبان بر اساس امتیاز و نظرات
class MerchantRankingListView(ListAPIView):
    serializer_class = BusinessListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Business.objects.filter(is_verified=True).order_by('-average_rating', '-review_count')[:20]

# افزودن و حذف از فروشگاه‌های منتخب (دنبال کردن)
class ToggleFavoriteBusinessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        business = get_object_or_404(Business, slug=slug)
        if business.followers.filter(id=request.user.id).exists():
            business.followers.remove(request.user)
            return Response({"is_followed": False, "message": "از فروشگاه‌های منتخب حذف شد."})
        business.followers.add(request.user)
        return Response({"is_followed": True, "message": "به فروشگاه‌های منتخب اضافه شد."})

# لیست فروشگاه‌های منتخب مشتری
class ClientFavoriteBusinessesListView(ListAPIView):
    serializer_class = BusinessListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.favorite_businesses.all().order_by('-created_at')

# نمایش تخفیفات روز و محصولات شگفت‌انگیز
class DailyDiscountsListView(ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Product.objects.filter(
            discount_percentage__gt=0,
            business__is_verified=True
        ).order_by('-discount_percentage', '-created_at')[:20]
        
        
class AdminBusinessDeleteView(generics.DestroyAPIView):
    queryset = Business.objects.all()
    permission_classes = [IsAdminUser]
    
    
    
class AdminToggleDemoDataView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        has_demo = Business.objects.filter(slug__startswith='demo-').exists()
        count = Business.objects.filter(slug__startswith='demo-').count()
        return Response({"has_demo": has_demo, "count": count})

    def post(self, request):
        try:
            demo_businesses = Business.objects.filter(slug__startswith='demo-')

            # حالت اول: اگر دیتای دمو وجود دارد -> همه را تمیز پاک کن
            if demo_businesses.exists():
                count = demo_businesses.count()
                with transaction.atomic():
                    DiscountCampaign.objects.filter(code__startswith='DEMO-').delete()
                    demo_businesses.delete()
                    User.objects.filter(phone_number__startswith='0999000').delete()
                    Category.objects.filter(slug__startswith='demo-').delete()
                    Location.objects.filter(slug__startswith='demo-').delete()
                return Response({
                    "status": "removed",
                    "has_demo": False,
                    "message": f"{count} کسب‌وکار نمایشی با موفقیت از سایت پاک شدند."
                })

            # حالت دوم: اگر دیتای دمو وجود ندارد -> ایجاد کسب‌وکارهای واقعی و کامل
            with transaction.atomic():
                # پاکسازی احتمالی بقایای قبلی برای جلوگیری از خطای Unique
                DiscountCampaign.objects.filter(code__startswith='DEMO-').delete()

                # ۱. اطمینان از وجود شهر
                loc = Location.objects.first()
                if not loc:
                    loc, _ = Location.objects.get_or_create(
                        slug="demo-isfahan",
                        defaults={"name": "اصفهان"}
                    )

                # ۲. اطمینان از وجود دسته‌بندی‌های جذاب با ایموجی
                cats_data = [
                    ("رستوران و کافه", "demo-restaurant", "🍽️"),
                    ("سالن زیبایی و اسپا", "demo-beauty-salon", "✂️"),
                    ("خدمات خودرو و دیتیلینگ", "demo-car-service", "🚗"),
                    ("کلینیک پزشکی و سلامت", "demo-clinic", "🏥"),
                    ("باشگاه و تناسب اندام", "demo-gym", "🏋️"),
                    ("پت‌شاپ و دامپزشکی", "demo-pet-shop", "🐾"),
                ]
                cats = {}
                for name, slug, icon in cats_data:
                    cat_obj = Category.objects.filter(name=name).first()
                    if not cat_obj:
                        cat_obj, _ = Category.objects.get_or_create(
                            slug=slug,
                            defaults={"name": name, "icon": icon, "price": 0}
                        )
                    cats[slug] = cat_obj

                # ۳. لیست ۹ کسب‌وکار واقع‌گرایانه برای ویترین سایت
                demo_items = [
                    {
                        "phone": "09990000001", "owner_name": "امیرحسین رضایی",
                        "name": "کافه رستوران سنتی عمارت نقش‌جهان", "slug": "demo-emarat-restaurant",
                        "cat": cats["demo-restaurant"], "rating": 4.9, "reviews": 48,
                        "desc": "تجربه اصیل‌ترین طعم کباب‌ها و بریانی سنتی اصفهان در فضایی تاریخی و دلنشین با موسیقی زنده و سرویس‌دهی VIP.",
                        "address": "اصفهان، میدان نقش جهان، جنب بازار قیصریه", "pub_phone": "03132221100", "insta": "@emarat_food",
                        "discount": 20, "code": "DEMO-EMARAT20",
                        "products": [("سینی مخصوص سرآشپز (۴ نفره)", 1450000, 20, True), ("بریانی اعلا مخصوص", 320000, 15, False)]
                    },
                    {
                        "phone": "09990000002", "owner_name": "مهسا شریفی",
                        "name": "سالن زیبایی و کلینیک تخصصی الماس", "slug": "demo-almas-beauty",
                        "cat": cats["demo-beauty-salon"], "rating": 4.8, "reviews": 64,
                        "desc": "ارائه کلیه خدمات تخصصی میکاپ عروس، احیا و کراتین مو، طراحی ناخن و فیشیال تخصصی پوست با برندهای اورجینال اروپایی.",
                        "address": "اصفهان، خیابان چهارباغ بالا، مجتمع کوثر، طبقه ۳", "pub_phone": "03136204455", "insta": "@almas_beauty_vip",
                        "discount": 30, "code": "DEMO-ALMAS30",
                        "products": [("پکیج کامل فیشیال و پاکسازی VIP", 980000, 30, True), ("پروتئین‌تراپی و احیای مو", 2200000, 25, False)]
                    },
                    {
                        "phone": "09990000003", "owner_name": "مهندس کاظمی",
                        "name": "مرکز تخصصی دیتیلینگ و سرامیک خودرو کاربن", "slug": "demo-carbon-auto",
                        "cat": cats["demo-car-service"], "rating": 4.7, "reviews": 31,
                        "desc": "احیای رنگ تخصصی، پوشش نانو سرامیک بدنه، صافکاری بی‌رنگ (PDR) و صفرشویی VIP انواع خودروهای وارداتی و داخلی.",
                        "address": "اصفهان، خیابان ارتش، نرسیده به سه راه حکیم نظامی", "pub_phone": "03136289900", "insta": "@carbon_detailing",
                        "discount": 15, "code": "DEMO-CARBON15",
                        "products": [("سرامیک ۵ ساله بدنه خودرو (آلمانی)", 12000000, 20, True), ("صفرشویی کامل VIP با مواد نانو", 1800000, 15, False)]
                    },
                    {
                        "phone": "09990000004", "owner_name": "دکتر فرهاد احمدی",
                        "name": "کلینیک دندانپزشکی و زیبایی لبخند سپنتا", "slug": "demo-sepanta-dental",
                        "cat": cats["demo-clinic"], "rating": 4.9, "reviews": 82,
                        "desc": "مرکز تخصصی ایمپلنت دیجیتال، لمینت سرامیکی، کامپوزیت ونیر و اصلاح طرح لبخند با بهره‌گیری از جدیدترین تجهیزات روز دنیا.",
                        "address": "اصفهان، خیابان توحید میانی، ساختمان پزشکان پارسیان", "pub_phone": "03136241020", "insta": "@sepanta_dental",
                        "discount": 25, "code": "DEMO-SEPANTA25",
                        "products": [("بلیچینگ و سفید کردن کامل دندان (دو فک)", 4500000, 25, True), ("جرم‌گیری و بروساژ تخصصی", 950000, 20, False)]
                    },
                    {
                        "phone": "09990000005", "owner_name": "سعید نادری",
                        "name": "آکادمی و باشگاه بدنسازی VIP اکسیژن", "slug": "demo-oxygen-gym",
                        "cat": cats["demo-gym"], "rating": 4.6, "reviews": 29,
                        "desc": "مجهزترین مجموعه ورزشی با دستگاه‌های Technogym ایتالیا، سالن اختصاصی کراس‌فیت، بوفه رژیمی و مربیان رسمی فدراسیون.",
                        "address": "اصفهان، مرداویج، خیابان فارابی شمالی", "pub_phone": "03136687711", "insta": "@oxygen_gym_isf",
                        "discount": 20, "code": "DEMO-OXYGEN20",
                        "products": [("اشتراک یک‌ماهه VIP بدنسازی + برنامه تمرینی", 2400000, 20, True)]
                    },
                    {
                        "phone": "09990000006", "owner_name": "پویا رستمی",
                        "name": "کافه بیکری و روستری تخصصی روژان", "slug": "demo-rojan-cafe",
                        "cat": cats["demo-restaurant"], "rating": 4.8, "reviews": 53,
                        "desc": "سرو قهوه‌های تخصصی تک‌خاستگاه (Specialty Coffee) و پخت روزانه انواع کروسان کره‌ای، شیرینی‌های فرانسوی و صبحانه ملل.",
                        "address": "اصفهان، جلفا، خیابان خاقانی، کوچه کلیسا", "pub_phone": "03136273344", "insta": "@rojan_roastery",
                        "discount": 15, "code": "DEMO-ROJAN15",
                        "products": [("پک صبحانه دونفره انگلیسی + دو عدد لاته", 580000, 15, True)]
                    },
                    {
                        "phone": "09990000007", "owner_name": "دکتر سارا کریمی",
                        "name": "پت‌شاپ و کلینیک دامپزشکی مهرگان", "slug": "demo-mehrgan-pet",
                        "cat": cats["demo-pet-shop"], "rating": 4.9, "reviews": 37,
                        "desc": "عرضه انواع غذای خشک و کنسرو اورجینال، لوازم جانبی، اصلاح و شستشوی تخصصی و چکاپ کامل حیوانات خانگی.",
                        "address": "اصفهان، خیابان نظر میانی، نبش کوچه ۱۲", "pub_phone": "03136258899", "insta": "@mehrgan_petshop",
                        "discount": 10, "code": "DEMO-PET10",
                        "products": [("پکیج شستشو، اصلاح و چکاپ کامل پت", 750000, 20, False)]
                    },
                    {
                        "phone": "09990000008", "owner_name": "عرفان محمدی",
                        "name": "فست‌فود و برگر ذغالی برگرلند", "slug": "demo-burgerland",
                        "cat": cats["demo-restaurant"], "rating": 4.7, "reviews": 41,
                        "desc": "برگرهای دست‌ساز ۱۰۰٪ گوشت گوساله تازه روی گریل ذغالی به همراه پیتزاهای ایتالیایی تنوری با پنیر موزارلای طبیعی.",
                        "address": "اصفهان، خیابان شیخ صدوق شمالی، نبش نیکبخت", "pub_phone": "03136612233", "insta": "@burgerland_isf",
                        "discount": 25, "code": "DEMO-BURGER25",
                        "products": [("کمبو ماشروم برگر ذغالی + سیب‌زمینی ویژه", 420000, 25, True)]
                    },
                    {
                        "phone": "09990000009", "owner_name": "خانم تابش",
                        "name": "کلینیک لیزر و جوانسازی پوست نیلوفر", "slug": "demo-niloofar-laser",
                        "cat": cats["demo-clinic"], "rating": 4.8, "reviews": 60,
                        "desc": "مجهز به دستگاه لیزر الکساندرایت ۲۰۲۶ بدون درد با کولینگ فوق‌قوی، هایفوتراپی و تزریق ژل و بوتاکس زیر نظر پزشک متخصص.",
                        "address": "اصفهان، خیابان شریعتی، روبروی بیمارستان شریعتی", "pub_phone": "03136265544", "insta": "@niloofar_clinic",
                        "discount": 35, "code": "DEMO-LASER35",
                        "products": [("پکیج فول‌بادی لیزر الکساندرایت", 890000, 35, True)]
                    },
                ]

                for item in demo_items:
                    user, _ = User.objects.get_or_create(
                        phone_number=item["phone"],
                        defaults={
                            "full_name": item["owner_name"],
                            "role": "BUSINESS_OWNER",
                            "is_shahkar_verified": True,
                            "is_active": True
                        }
                    )
                    biz, _ = Business.objects.update_or_create(
                        slug=item["slug"],
                        defaults={
                            "owner": user,
                            "category": item["cat"],
                            "location": loc,
                            "name": item["name"],
                            "description": item["desc"],
                            "address": item["address"],
                            "public_phone": item["pub_phone"],
                            "instagram_id": item["insta"],
                            "is_verified": True,
                            "is_premium": True,
                            "average_rating": item["rating"],
                            "review_count": item["reviews"],
                            "views_count": 240,
                            "engagement_count": 85,
                            "establishment_year": "1401"
                        }
                    )
                    if item.get("discount"):
                        DiscountCampaign.objects.update_or_create(
                            code=item["code"],
                            defaults={
                                "business": biz,
                                "discount_percent": item["discount"],
                                "max_usage": 999999,
                                "is_active": True
                            }
                        )
                    for p_name, p_price, p_disc, is_flash in item.get("products", []):
                        Product.objects.create(
                            business=biz,
                            name=p_name,
                            price=p_price,
                            discount_percentage=p_disc,
                            is_flash_sale=is_flash
                        )

            return Response({
                "status": "created",
                "has_demo": True,
                "message": "۹ کسب‌وکار نمونه به همراه کمپین‌های تخفیف و محصولات با موفقیت به سایت اضافه شدند!"
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)