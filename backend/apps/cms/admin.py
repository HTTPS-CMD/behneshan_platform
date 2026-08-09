from django.contrib import admin
from .models import SiteSetting, Menu, Banner

@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'description',)
    search_fields = ('key', 'value')

@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ('title', 'position', 'url', 'order', 'is_active')
    list_filter = ('position', 'is_active')
    list_editable = ('order', 'is_active') # امکان تغییر سریع ترتیب و وضعیت از همان لیست

@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'position', 'order', 'is_active')
    list_filter = ('position', 'is_active')
    list_editable = ('order', 'is_active')