from datetime import timedelta
import uuid
from django.db import models
from apps.identity.models import User
from apps.taxonomy.models import Category, Location
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.conf import settings

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='businesses')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='businesses', null=True, blank=True)
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name='businesses', null=True, blank=True)
    
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, allow_unicode=True)
    logo = models.ImageField(upload_to='businesses/logos/', null=True, blank=True)
    banner = models.ImageField(upload_to='businesses/banners/', null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    
    # فیلدهای ارتباطی و عمومی
    address = models.TextField(blank=True, null=True)
    public_phone = models.CharField(max_length=20, blank=True, null=True)
    instagram_id = models.CharField(max_length=255, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    
    is_verified = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    
    # --- امکانات جدید اضافه شده ---
    establishment_year = models.CharField(max_length=4, null=True, blank=True, verbose_name="تاریخچه/سال تاسیس")
    followers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='favorite_businesses', blank=True, verbose_name="دنبال‌کنندگان")
    ladder_expiry = models.DateTimeField(null=True, blank=True, verbose_name="اعتبار نردبان (قرارگیری در صدر)")
    # -----------------------------
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    views_count = models.PositiveIntegerField(default=0, verbose_name="مجموع بازدیدها")
    engagement_count = models.PositiveIntegerField(default=0, verbose_name="تعاملات ثبت شده (کلیک، تماس و...) ")
    average_rating = models.FloatField(default=0.0, verbose_name="میانگین امتیازات")
    review_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'directory_businesses'

    def __str__(self):
        return self.name

# --- مدل جدید محصولات ---
class Product(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255, verbose_name="نام محصول/خدمت")
    price = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="قیمت پایه")
    discount_percentage = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)], verbose_name="درصد تخفیف")
    is_flash_sale = models.BooleanField(default=False, verbose_name="فروش فوری")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.business.name}"

# --- مدل جدید تیکت و درخواست‌های تبلیغاتی کاسبان ---
class BusinessRequest(models.Model):
    REQUEST_TYPES = (
        ('LADDER', 'درخواست نردبان'),
        ('SMS', 'تبلیغات پیامکی'),
        ('FEATURED', 'معرفی ویژه روز در چارسوق'),
    )
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='requests')
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPES, verbose_name="نوع درخواست")
    description = models.TextField(blank=True, null=True, verbose_name="توضیحات کاسب")
    is_approved = models.BooleanField(default=False, verbose_name="تایید شده")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_request_type_display()} - {self.business.name}"


class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reviews')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    owner_reply = models.TextField(null=True, blank=True, verbose_name="پاسخ صاحب کسب‌وکار")
    reply_date = models.DateTimeField(null=True, blank=True, verbose_name="تاریخ ثبت پاسخ")

    class Meta:
        db_table = 'directory_reviews'
        ordering = ['-created_at'] 
        unique_together = ('business', 'user') 

    def __str__(self):
        return f"{self.user.phone_number} - {self.business.name} ({self.rating})"
    
class DiscountCampaign(models.Model):
    business = models.ForeignKey('Business', on_delete=models.CASCADE, related_name='campaigns')
    code = models.CharField(max_length=50, unique=True, verbose_name="کد معرف")
    discount_percent = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)], verbose_name="درصد تخفیف")
    max_usage = models.PositiveIntegerField(default=10, verbose_name="ظرفیت کل")
    current_usage = models.PositiveIntegerField(default=0, verbose_name="تعداد استفاده شده")
    is_active = models.BooleanField(default=True, verbose_name="فعال/غیرفعال")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.business.name}"

class CampaignUsage(models.Model):
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='used_campaigns')
    campaign = models.ForeignKey(DiscountCampaign, on_delete=models.CASCADE, related_name='usages')
    claimed_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان دریافت")
    is_redeemed = models.BooleanField(default=False, verbose_name="آیا در خرید حضوری استفاده شد؟")

    class Meta:
        unique_together = ('client', 'campaign') 

    def __str__(self):
        return f"{self.client.phone_number} -> {self.campaign.code}"
    
class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام پلن (مثل برنزی، طلایی)")
    base_discount_percentage = models.PositiveIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)], verbose_name="درصد تخفیف پایه")
    price_per_month = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="قیمت ماهانه")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.base_discount_percentage}%"

class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile')
    active_plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True)
    plan_expiry_date = models.DateTimeField(null=True, blank=True)

    @property
    def has_active_subscription(self):
        return bool(self.active_plan and self.plan_expiry_date and self.plan_expiry_date > timezone.now())

class DiscountService:
    @staticmethod
    def get_best_discount(user, business):
        user_discount = 0
        campaign_discount = 0
        active_campaign_id = None
        
        if hasattr(user, 'customer_profile') and user.customer_profile.has_active_subscription:
            user_discount = user.customer_profile.active_plan.base_discount_percentage

        valid_usage = CampaignUsage.objects.filter(
            client=user,
            campaign__business=business,
            is_redeemed=False,          
            campaign__is_active=True    
        ).select_related('campaign').order_by('-campaign__discount_percent').first()

        if valid_usage:
            campaign_discount = valid_usage.campaign.discount_percent or 0
            active_campaign_id = valid_usage.campaign.id

        if campaign_discount > user_discount:
            return {
                "final_discount": campaign_discount,
                "source": "CAMPAIGN",
                "campaign_id": active_campaign_id
            }
        elif user_discount > 0:
            return {
                "final_discount": user_discount,
                "source": "SUBSCRIPTION",
                "campaign_id": None
            }
        else:
            return {
                "final_discount": 0,
                "source": "NONE",
                "campaign_id": None
            }

class TransactionLog(models.Model):
    SOURCE_CHOICES = (
        ('SUBSCRIPTION', 'اشتراک VIP'),
        ('CAMPAIGN', 'کمپین اختصاصی'),
        ('NONE', 'بدون تخفیف'),
    )

    business = models.ForeignKey('Business', on_delete=models.CASCADE, related_name='transactions')
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    
    original_amount = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="مبلغ اولیه فاکتور")
    applied_discount_percentage = models.PositiveIntegerField(verbose_name="درصد تخفیف اعمال شده")
    discount_source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    final_amount = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="مبلغ پرداختی نهایی")
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.business.name} - {self.customer.phone_number} - {self.final_amount}"

class UserBusinessVisit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='business_visits')
    business = models.ForeignKey('Business', on_delete=models.CASCADE)
    last_visited = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'business') 
        ordering = ['-last_visited'] 

    def __str__(self):
        return f"{self.user.phone_number} visited {self.business.name}"
    
class SiteContent(models.Model):
    PAGE_CHOICES = (
        ('about', 'درباره ما'),
        ('contact', 'تماس با ما'),
        ('terms_client', 'قوانین مشتریان'),
        ('terms_business', 'قوانین کسب و کار'),
    )
    
    page_type = models.CharField(max_length=20, choices=PAGE_CHOICES, unique=True, verbose_name="نوع صفحه")
    title = models.CharField(max_length=200, verbose_name="عنوان صفحه")
    content = models.TextField(verbose_name="محتوای صفحه")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "محتوای سایت"
        verbose_name_plural = "محتواهای سایت"

    def __str__(self):
        return self.get_page_type_display()
    
class Story(models.Model):
    business = models.ForeignKey('Business', on_delete=models.CASCADE, related_name='stories')
    media = models.FileField(upload_to='businesses/stories/%Y/%m/', help_text="عکس یا ویدیوی استوری")
    link = models.URLField(blank=True, null=True, help_text="لینک اختیاری (مثلا برای Swipe Up)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Story by {self.business.name} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def is_active(self):
        return self.created_at >= timezone.now() - timedelta(hours=24)