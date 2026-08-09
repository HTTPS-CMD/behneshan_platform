from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CMSDataView, AdminSiteSettingViewSet, AdminMenuViewSet, AdminBannerViewSet

# روتر به صورت خودکار مسیرهای GET, POST, PUT, DELETE را می‌سازد
router = DefaultRouter()
router.register(r'admin/settings', AdminSiteSettingViewSet, basename='admin-settings')
router.register(r'admin/menus', AdminMenuViewSet, basename='admin-menus')
router.register(r'admin/banners', AdminBannerViewSet, basename='admin-banners')

urlpatterns = [
    # API عمومی برای نمایش در سایت
    path('data/', CMSDataView.as_view(), name='cms-data'),
    
    # APIهای مدیریتی پنل ادمین
    path('', include(router.urls)), 
]