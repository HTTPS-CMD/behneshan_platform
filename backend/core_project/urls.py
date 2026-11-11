from django.contrib import admin
from django.urls import include, path
from django.conf import settings # اضافه شد
from django.conf.urls.static import static # اضافه شد

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/identity/', include('apps.identity.urls')),
    path('api/v1/directory/', include('apps.directory.urls')),
    path('api/v1/taxonomy/', include('apps.taxonomy.urls')),
    path('api/v1/cms/', include('apps.cms.urls')),
    path('api/v1/analytics/', include('analytics.urls')),  # اضافه شد برای مسیرهای آنالیتیکس
    path('api/v1/notifications/', include('apps.notifications.urls')),  # اعلان‌ها
    path('api/v1/loyalty/', include('apps.loyalty.urls')),  # باشگاه مشتریان
    path('api/v1/seo/', include('apps.seo.urls')),  # داده‌ی سایت‌مپ
    path('api/v1/ops/', include('apps.ops.urls')),  # سلامت سیستم و بکاپ (پنل مدیر)
]

# این بخش برای نمایش عکس‌ها در حالت توسعه اضافه شد
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)