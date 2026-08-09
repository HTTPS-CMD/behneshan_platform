from django.db import models

# Create your models here.
import uuid
from django.db import models

class Location(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, allow_unicode=True) # برای URLهای فارسی
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    
    class Meta:
        db_table = 'taxonomy_locations'

    def __str__(self):
        return self.name

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, allow_unicode=True)
    icon_url = models.URLField(null=True, blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='subcategories')
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name="آیکون یا ایموجی")
    
    price = models.BigIntegerField(default=0, verbose_name="قیمت (تومان)")
    
    class Meta:
        db_table = 'taxonomy_categories'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name