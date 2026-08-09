from django.db import models

class SiteSetting(models.Model):
    """مدل برای ذخیره متن‌های پویا و تنظیمات متنی سایت"""
    key = models.CharField(max_length=100, unique=True, verbose_name="کلید تنظیمات (مثلاً: footer_about_text)")
    value = models.TextField(verbose_name="مقدار (متن نمایشی)")
    description = models.CharField(max_length=255, null=True, blank=True, verbose_name="توضیحات ادمین")

    class Meta:
        db_table = 'cms_site_settings'
        verbose_name = "تنظیمات متن"
        verbose_name_plural = "تنظیمات متون سایت"
        
        
    

    def __str__(self):
        return self.key

class Menu(models.Model):
    """مدل برای مدیریت منوهای هدر، فوتر و موبایل"""
    POSITION_CHOICES = (
        ('header', 'هدر (بالای سایت)'),
        ('footer', 'فوتر (پایین سایت)'),
        ('mobile', 'منوی موبایل'),
    )
    title = models.CharField(max_length=100, verbose_name="عنوان منو")
    url = models.CharField(max_length=255, verbose_name="لینک مقصد")
    icon = models.CharField(max_length=50, null=True, blank=True, verbose_name="نام آیکون (برای موبایل)")
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, default='header', verbose_name="جایگاه")
    order = models.IntegerField(default=0, verbose_name="ترتیب نمایش")
    is_active = models.BooleanField(default=True, verbose_name="فعال برای نمایش؟")

    class Meta:
        db_table = 'cms_menus'
        ordering = ['order']
        verbose_name = "منو"
        verbose_name_plural = "منوها"

    def __str__(self):
        return f"{self.title} ({self.get_position_display()})"

class Banner(models.Model):
    """مدل برای مدیریت بنرهای تبلیغاتی و اسلایدرها"""
    POSITION_CHOICES = (
        ('main_slider', 'اسلایدر اصلی صفحه خانه'),
        ('sidebar', 'بنر سایدبار'),
        ('promotional', 'بنر تبلیغاتی بین دسته‌بندی‌ها'),
    )
    title = models.CharField(max_length=200, verbose_name="عنوان بنر (فقط برای مدیریت)")
    image = models.ImageField(upload_to='cms/banners/', verbose_name="تصویر بنر")
    url = models.URLField(null=True, blank=True, verbose_name="لینک مقصد هنگام کلیک")
    position = models.CharField(max_length=50, choices=POSITION_CHOICES, default='main_slider', verbose_name="جایگاه بنر")
    order = models.IntegerField(default=0, verbose_name="ترتیب نمایش")
    is_active = models.BooleanField(default=True, verbose_name="فعال برای نمایش؟")

    class Meta:
        db_table = 'cms_banners'
        ordering = ['order']
        verbose_name = "بنر"
        verbose_name_plural = "بنرها"

    def __str__(self):
        return f"{self.title} - {self.get_position_display()}"