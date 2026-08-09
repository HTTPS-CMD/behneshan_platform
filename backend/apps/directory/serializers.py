from rest_framework import serializers
from .models import Business, Review, SiteContent
from apps.taxonomy.models import Category, Location
from .models import DiscountCampaign, CampaignUsage, TransactionLog, SubscriptionPlan, CustomerProfile, SubscriptionPlan
# from apps.taxonomy.serializers import CategorySerializer, LocationSerializer

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon_url']

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'slug']

class BusinessListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    # ۱. تعریف فیلد داینامیک جدید
    active_campaign = serializers.SerializerMethodField() 

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'slug', 'description', 'average_rating', 
            'review_count', 'is_verified', 'is_premium', 'category', 'location', 'logo', 'banner',
            'active_campaign' # ۲. اضافه کردن به خروجی
        ]

    # ۳. متد برای پیدا کردن بهترین کمپین فعال این کسب‌وکار
    def get_active_campaign(self, obj):
        # فیلتر جدید: فقط کمپین‌هایی که ظرفیت بالا (عمومی) دارند و فعال هستند را بگیر
        campaign = obj.campaigns.filter(is_active=True, max_usage__gte=10000).order_by('-discount_percent').first()
        if campaign:
            return {
                "id": campaign.id,
                "title": f"{campaign.discount_percent}٪ تخفیف",
                "discount_percent": campaign.discount_percent,
                "code": campaign.code
            }
        return None


# این کلاس را به انتهای فایل اضافه کن
class BusinessCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ['name', 'slug', 'description', 'category', 'location', 'logo', 'banner']
        

# در فایل serializers.py این کلاس را اضافه کن:
class BusinessSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    location = LocationSerializer(read_only=True)
    active_campaign = serializers.SerializerMethodField() # اضافه شدن فیلد

    class Meta:
        model = Business
        fields = '__all__'
        
    def get_active_campaign(self, obj):
        # فیلتر جدید: فقط کمپین‌هایی که ظرفیت بالا (عمومی) دارند و فعال هستند را بگیر
        campaign = obj.campaigns.filter(is_active=True, max_usage__gte=10000).order_by('-discount_percent').first()
        if campaign:
            return {
                "id": campaign.id,
                "title": f"{campaign.discount_percent}٪ تخفیف",
                "discount_percent": campaign.discount_percent,
                "code": campaign.code
            }
        return None
    

class BusinessUpdateSerializer(serializers.ModelSerializer):
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
    user_phone = serializers.CharField(source='user.phone_number', read_only=True)

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
        
        

from .models import UserBusinessVisit

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
        
        
from rest_framework import serializers
from .models import Story

class StorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Story
        fields = ['id', 'business', 'media', 'link', 'created_at', 'is_active']
        read_only_fields = ['business', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        
        # اصلاح شد: گرفتن اولین کسب‌وکار از لیست کسب‌وکارهای کاربر
        business = request.user.businesses.first()
        
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