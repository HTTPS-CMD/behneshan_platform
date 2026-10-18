from django.contrib import admin, messages
import requests
from django.conf import settings
from .models import Business, SubscriptionPlan, CustomerProfile, TransactionLog



@admin.action(description='🧹 اعمال تغییرات در سایت (پاکسازی کش)')
def clear_frontend_cache(modeladmin, request, queryset):
    # آدرس و رمز از فایل .env خوانده می‌شود
    frontend_url = settings.FRONTEND_REVALIDATE_URL
    payload = {
        "secret": settings.REVALIDATION_SECRET,
    }
    
    try:
        response = requests.post(frontend_url, json=payload, timeout=5)
        if response.status_code == 200:
            modeladmin.message_user(request, "تغییرات با موفقیت در سایت اصلی اعمال شد.", messages.SUCCESS)
        else:
            modeladmin.message_user(request, f"خطا در پاکسازی کش: {response.text}", messages.ERROR)
    except requests.exceptions.RequestException as e:
        modeladmin.message_user(request, f"عدم ارتباط با سرور فرانت‌اند. مطمئن شوید فرانت‌اند ران است.", messages.ERROR)



@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_verified', 'is_premium', 'slug')
    search_fields = ('name',)
    
    actions = [clear_frontend_cache]  # اضافه کردن اکشن پاکسازی کش به مدل Business
    
# --- اضافه شده برای مدیریت سیستم VIP و CRM ---

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_discount_percentage', 'price_per_month', 'is_active')
    list_editable = ('is_active',)

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'active_plan', 'plan_expiry_date')
    search_fields = ('user__phone_number', 'user__full_name')

@admin.register(TransactionLog)
class TransactionLogAdmin(admin.ModelAdmin):
    list_display = ('business', 'customer', 'original_amount', 'final_amount', 'discount_source', 'created_at')
    list_filter = ('discount_source', 'created_at')
    search_fields = ('customer__phone_number', 'business__name')