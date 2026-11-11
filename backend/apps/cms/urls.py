from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminBannerViewSet, AdminContactMessageViewSet, AdminLandingView, AdminMenuViewSet, AdminSiteSettingViewSet,
    CMSDataView, ContactCreateView, PublicLandingView,
)

# روتر به صورت خودکار مسیرهای GET, POST, PUT, DELETE را می‌سازد
router = DefaultRouter()
router.register(r'admin/settings', AdminSiteSettingViewSet, basename='admin-settings')
router.register(r'admin/menus', AdminMenuViewSet, basename='admin-menus')
router.register(r'admin/banners', AdminBannerViewSet, basename='admin-banners')
router.register(r'admin/contact-messages', AdminContactMessageViewSet, basename='admin-contact-messages')

urlpatterns = [
    # API عمومی برای نمایش در سایت
    path('data/', CMSDataView.as_view(), name='cms-data'),
    path('landing/', PublicLandingView.as_view(), name='cms-landing'),
    path('contact/', ContactCreateView.as_view(), name='cms-contact'),  # فرم عمومی تماس با ما
    path('admin/landing/', AdminLandingView.as_view(), name='cms-admin-landing'),
    
    # APIهای مدیریتی پنل ادمین
    path('', include(router.urls)), 
]