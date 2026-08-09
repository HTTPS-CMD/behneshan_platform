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
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
class OwnerAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            business = Business.objects.get(owner=user)
        except Business.DoesNotExist:
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
            
        business = request.user.businesses.first()
        
        try:
            customer = User.objects.get(phone_number=phone_number)
            
            discount_data = DiscountService.get_best_discount(customer, business)
            discount_pct = discount_data['final_discount']
            
            final_amount = float(original_amount) - (float(original_amount) * (discount_pct / 100))
            
            transaction = TransactionLog.objects.create(
                business=business,
                customer=customer,
                original_amount=original_amount,
                applied_discount_percentage=discount_pct,
                discount_source=discount_data['source'],
                final_amount=final_amount
            )

            # *** سوزاندن کد در صورت استفاده از کمپین اختصاصی ***
            if discount_data['source'] == 'CAMPAIGN' and discount_data.get('campaign_id'):
                # اصلاح شد: پیدا کردن رکورد استفاده (Usage) بر اساس آیدی کمپین و مشتری
                usage = CampaignUsage.objects.get(
                    campaign_id=discount_data['campaign_id'],
                    client=customer,
                    is_redeemed=False
                )
                usage.is_redeemed = True
                usage.save()

            return Response({
                "message": "تراکنش با موفقیت ثبت شد",
                "final_amount": final_amount
            }, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response({"error": "مشتری با این شماره یافت نشد."}, status=status.HTTP_404_NOT_FOUND)
        
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
        
        campaign = get_object_or_404(DiscountCampaign, id=campaign_id, is_active=True)
        
        existing_usage = CampaignUsage.objects.filter(client=request.user, campaign=campaign, is_redeemed=False).first()
        if existing_usage:
            return Response({"message": "شما قبلا این کد را دریافت کرده‌اید.", "code": campaign.code}, status=status.HTTP_200_OK)
            
        if campaign.current_usage >= campaign.max_usage:
            return Response({"error": "ظرفیت این کمپین تکمیل شده است."}, status=status.HTTP_400_BAD_REQUEST)
            
        CampaignUsage.objects.create(client=request.user, campaign=campaign)
        campaign.current_usage += 1
        campaign.save()
        
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
    
    def get(self, request):
        contents = SiteContent.objects.all()
        serializer = SiteContentSerializer(contents, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, page_type):
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