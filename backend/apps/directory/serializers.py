import os

from apps.taxonomy.serializers import CategorySerializer, LocationSerializer
from rest_framework import serializers

from .models import (
    Business,
    BusinessRequest,
    CampaignUsage,
    DiscountCampaign,
    Product,
    Review,
    SiteContent,
    Story,
    SubscriptionPlan,
    TransactionLog,
    UserBusinessVisit,
)
from .utils import get_owner_business

# --- اعتبارسنجی فایل‌های آپلودی ---
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
VIDEO_EXTS = {'.mp4', '.webm'}
MAX_IMAGE_MB = 5
MAX_VIDEO_MB = 20


def validate_upload(f, allowed_exts, max_mb):
    if not f:
        return f
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in allowed_exts:
        raise serializers.ValidationError(f"فرمت فایل مجاز نیست. فرمت‌های مجاز: {', '.join(sorted(allowed_exts))}")
    if f.size > max_mb * 1024 * 1024:
        raise serializers.ValidationError(f"حجم فایل نباید بیشتر از {max_mb} مگابایت باشد.")
    if ext in IMAGE_EXTS:
        try:
            from PIL import Image
            img = Image.open(f)
            img.verify()
            f.seek(0)
        except Exception as exc:
            raise serializers.ValidationError("فایل تصویر معتبر نیست.") from exc
    return f


class ImageFieldsValidationMixin:
    def validate_logo(self, value):
        return validate_upload(value, IMAGE_EXTS, MAX_IMAGE_MB)

    def validate_banner(self, value):
        return validate_upload(value, IMAGE_EXTS, MAX_IMAGE_MB)


class ActiveCampaignMixin:
    """بهترین کمپین عمومی و فعال کسب‌وکار (قبلاً در دو serializer کپی شده بود)"""

    def get_active_campaign(self, obj):
        # فقط کمپین‌هایی که ظرفیت بالا (عمومی) دارند و فعال هستند
        campaign = obj.campaigns.filter(is_active=True, max_usage__gte=10000).order_by('-discount_percent').first()
        if campaign:
            return {
                "id": campaign.id,
                "title": f"{campaign.discount_percent}٪ تخفیف",
                "discount_percent": campaign.discount_percent,
                "code": campaign.code,
            }
        return None


class BusinessListSerializer(ActiveCampaignMixin, serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    active_campaign = serializers.SerializerMethodField() 

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'slug', 'description', 'average_rating', 
            'review_count', 'is_verified', 'is_premium', 'category', 'location', 'logo', 'banner',
            'active_campaign', 'establishment_year', 'followers_count' # ۲. اضافه کردن به خروجی
        ]



# این کلاس را به انتهای فایل اضافه کن
class BusinessCreateSerializer(ImageFieldsValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ['name', 'slug', 'description', 'category', 'location', 'logo', 'banner']
        

# در فایل serializers.py این کلاس را اضافه کن:
class BusinessSerializer(ActiveCampaignMixin, serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    active_campaign = serializers.SerializerMethodField() # اضافه شدن فیلد

    class Meta:
        model = Business
        fields = '__all__'
        
    

class BusinessPublicSerializer(ActiveCampaignMixin, serializers.ModelSerializer):
    """نسخه‌ی عمومی جزئیات کسب‌وکار: فقط فیلدهای قابل نمایش برای همه.
    owner، followers و آمار داخلی عمداً حذف شده‌اند (H3)."""
    category = CategorySerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    active_campaign = serializers.SerializerMethodField()
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    merchant_level = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'slug', 'description', 'category', 'location',
            'logo', 'banner', 'address', 'public_phone', 'instagram_id',
            'latitude', 'longitude', 'website', 'establishment_year',
            'is_verified', 'is_premium', 'average_rating', 'review_count',
            'followers_count', 'active_campaign', 'created_at', 'merchant_level',
        ]

    def get_merchant_level(self, obj):
        """سطح باشگاه پذیرندگان؛ طلایی و الماس نشان «دکان برتر» می‌گیرند"""
        st = getattr(obj, 'merchant_status', None)  # نبودن ردیف = None (RelatedObjectDoesNotExist یک AttributeError است)
        if not st:
            return None
        return {"level": st.level, "label": st.get_level_display(), "is_top": st.is_top}


def mask_phone(phone):
    """09121234567 -> 0912***4567"""
    if not phone:
        return ""
    phone = str(phone)
    if len(phone) < 8:
        return "***"
    return f"{phone[:4]}***{phone[-4:]}"


class BusinessUpdateSerializer(ImageFieldsValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Business
        # تمام فیلدهایی که در فرانت‌اند دارید باید اینجا لیست شوند
        fields = [
            'name', 'slug', 'category', 'location', 'description', 
            'address', 'public_phone', 'instagram_id', 'latitude', 
            'longitude', 'website', 'logo', 'banner'
        ]


        

class ReviewSerializer(serializers.ModelSerializer):
    # این فیلد را قبلاً تعریف کرده‌اید
    # شماره‌ی کامل کاربر عمومی نمی‌شود؛ فقط نسخه‌ی ماسک‌شده (H3)
    user_phone = serializers.SerializerMethodField()

    def get_user_phone(self, obj):
        return mask_phone(getattr(obj.user, 'phone_number', None))

    class Meta:
        model = Review
        # نام 'user_phone' باید حتماً در این لیست باشد
        fields = ['id', 'business', 'user', 'user_phone', 'rating', 'comment', 'created_at', 'owner_reply', 'reply_date'] 
        read_only_fields = ['user', 'business']
        
class DiscountCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCampaign
        # فیلدهایی که صاحب کسب‌وکار می‌تواند ببیند یا پر کند
        fields = ['id', 'code', 'discount_percent', 'max_usage', 'current_usage', 'is_active', 'created_at']
        # این فیلدها فقط خواندنی هستند و نباید توسط کاربر و در فرم ادیت شوند
        read_only_fields = ['id', 'current_usage', 'created_at']

class CampaignUsageSerializer(serializers.ModelSerializer):
    # استخراج نام و شماره موبایل مشتری از جدول User
    client_phone = serializers.CharField(source='client.phone_number', read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)

    class Meta:
        model = CampaignUsage
        fields = ['id', 'client_phone', 'client_name', 'claimed_at', 'is_redeemed']
        read_only_fields = ['id', 'client_phone', 'client_name', 'claimed_at']
        
        
class TransactionLogSerializer(serializers.ModelSerializer):
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)

    class Meta:
        model = TransactionLog
        fields = [
            'id', 
            'customer_phone', 
            'customer_name', 
            'original_amount', 
            'applied_discount_percentage', 
            'discount_source', 
            'final_amount', 
            'created_at'
        ]
        
        
        
class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'
        
        


class UserBusinessVisitSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_slug = serializers.CharField(source='business.slug', read_only=True)
    # استخراج نام صاحب کسب‌وکار (در صورت وجود)
    owner_name = serializers.CharField(source='business.owner.full_name', read_only=True, default='مدیریت فروشگاه')

    class Meta:
        model = UserBusinessVisit
        fields = ['id', 'business_name', 'business_slug', 'owner_name', 'last_visited']
        

# سریالایزر برای لاگ تراکنش‌ها مخصوص ادمین
class AdminTransactionLogSerializer(serializers.ModelSerializer):
    # این فیلدها را اضافه می‌کنیم تا دقیقاً با نام‌هایی که در فرانت‌اند نوشتیم مچ شوند
    business_name = serializers.CharField(source='business.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)

    class Meta:
        model = TransactionLog
        fields = [
            'id', 'business_name', 'customer_phone', 'original_amount', 
            'applied_discount_percentage', 'discount_source', 'final_amount', 'created_at'
        ]
        
        
class ClientCampaignUsageSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='campaign.business.name', read_only=True)
    business_slug = serializers.CharField(source='campaign.business.slug', read_only=True)
    code = serializers.CharField(source='campaign.code', read_only=True)
    discount_percent = serializers.IntegerField(source='campaign.discount_percent', read_only=True)
    title = serializers.SerializerMethodField()

    class Meta:
        model = CampaignUsage
        fields = ['id', 'business_name', 'business_slug', 'code', 'discount_percent', 'title', 'claimed_at', 'is_redeemed']

    def get_title(self, obj):
        return f"{obj.campaign.discount_percent}٪ تخفیف پیشنهاد ویژه"

    
class SiteContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteContent
        fields = ['page_type', 'title', 'content', 'updated_at']
        
        

class StorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Story
        fields = ['id', 'business', 'media', 'link', 'created_at', 'is_active']
        read_only_fields = ['business', 'created_at']

    def validate_media(self, value):
        return validate_upload(value, IMAGE_EXTS | VIDEO_EXTS, MAX_VIDEO_MB)

    def create(self, validated_data):
        request = self.context.get('request')
        
        business = get_owner_business(request.user)
        
        # یک بررسی امنیتی کوچک برای کاربری که هیچ کسب‌وکاری ندارد
        if not business:
            raise serializers.ValidationError({"error": "کسب‌وکاری برای این کاربر یافت نشد."})
            
        return Story.objects.create(business=business, **validated_data)
    
    
    
class PublicStorySerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_slug = serializers.CharField(source='business.slug', read_only=True)
    business_logo = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ['id', 'business_name', 'business_slug', 'business_logo', 'media', 'link', 'created_at']

    def get_business_logo(self, obj):
        request = self.context.get('request')
        if obj.business.logo and request:
            return request.build_absolute_uri(obj.business.logo.url)
        return None
    
    

class ProductSerializer(serializers.ModelSerializer):
    final_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'business', 'name', 'price', 'discount_percentage', 'is_flash_sale', 'final_price', 'created_at']
        read_only_fields = ['business', 'created_at']

    def get_final_price(self, obj):
        if obj.discount_percentage > 0:
            return int(obj.price * (100 - obj.discount_percentage) / 100)
        return obj.price

class BusinessRequestSerializer(serializers.ModelSerializer):
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)

    class Meta:
        model = BusinessRequest
        fields = ['id', 'business', 'request_type', 'request_type_display', 'description', 'is_approved', 'created_at']
        read_only_fields = ['business', 'is_approved', 'created_at']