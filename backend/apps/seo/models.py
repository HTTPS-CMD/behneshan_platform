from django.db import models


class SeoPage(models.Model):
    """
    تنظیمات سئوی یک صفحه که ادمین از پنل وارد می‌کند.
    هر فیلد خالی یعنی «از مقدار خودکار سایت استفاده شود»؛ پس نبودن ردیف هم کاملاً عادی است.
    برای صفحه‌ی ثابت، page_key همان مسیر است (مثل /about) و برای بقیه اسلاگ.
    """
    TYPE_STATIC = 'static'
    TYPE_BUSINESS = 'business'
    TYPE_CATEGORY = 'category'
    TYPE_LOCATION = 'location'
    TYPES = (
        (TYPE_STATIC, 'صفحه‌ی ثابت'),
        (TYPE_BUSINESS, 'کسب‌وکار'),
        (TYPE_CATEGORY, 'دسته'),
        (TYPE_LOCATION, 'محله'),
    )

    id = models.BigAutoField(primary_key=True)
    page_type = models.CharField(max_length=20, choices=TYPES, verbose_name='نوع صفحه')
    page_key = models.CharField(max_length=255, verbose_name='کلید صفحه (مسیر یا اسلاگ)')
    title = models.CharField(max_length=255, blank=True, default='', verbose_name='عنوان سئو')
    description = models.CharField(max_length=500, blank=True, default='', verbose_name='توضیح متا')
    focus_keyword = models.CharField(max_length=120, blank=True, default='', verbose_name='کلمه‌ی کلیدی اصلی')
    canonical = models.CharField(max_length=500, blank=True, default='', verbose_name='آدرس کانونیکال')
    og_image = models.CharField(max_length=500, blank=True, default='', verbose_name='تصویر اشتراک‌گذاری')
    noindex = models.BooleanField(default=False, verbose_name='عدم نمایش در گوگل (noindex)')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seo_pages'
        unique_together = ('page_type', 'page_key')
        verbose_name = 'تنظیمات سئوی صفحه'
        verbose_name_plural = 'تنظیمات سئوی صفحه‌ها'

    def __str__(self):
        return f'{self.page_type}:{self.page_key}'
