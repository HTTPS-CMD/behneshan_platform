from django.contrib import admin
from .models import Category, Location

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price')
    search_fields = ('name',)
    list_editable = ('price',) # امکان ویرایش سریع قیمت بدون ورود به صفحه دسته

admin.site.register(Location)