from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import AdminUserViewSet, GenerateOTPView, VerifyOTPView, UserProfileView
from rest_framework.routers import DefaultRouter



router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')


urlpatterns = [
    # آدرس را دقیقاً همان چیزی گذاشتیم که فرانت‌اند شما درخواست داده بود
    path('request-otp/', GenerateOTPView.as_view(), name='request-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('', include(router.urls)),
]