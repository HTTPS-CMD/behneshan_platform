from django.contrib import admin
from .models import User  # اسم مدل اختصاصی خودت رو اینجا بنویس (مثلا CustomUser یا User)

@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    # فیلدهایی که دوست داری تو لیست پنل ادمین ببینی
    list_display = ('phone_number', 'role', 'is_active', 'is_staff')
    
    # فیلدهایی که می‌خوای بر اساسشون سرچ کنی
    search_fields = ('phone_number',)
    
    # فیلترهای کنار صفحه
    list_filter = ('role', 'is_active')