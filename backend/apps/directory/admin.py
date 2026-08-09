from django.contrib import admin
from .models import Business, SubscriptionPlan, CustomerProfile, TransactionLog

@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_verified', 'is_premium')
    search_fields = ('name',)
    
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