from django.urls import include, path
from .views import AdminUserViewSet, GenerateOTPView, VerifyOTPView, UserProfileView, ClientDashboardView, ClientReferralsView, SessionRefreshView, LogoutView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'admin/users', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    # علامت هشتگ باید از ابتدای خط زیر پاک شود تا مسیر فعال گردد
    path('request-otp/', GenerateOTPView.as_view(), name='request-otp'), 
    
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    # تمدید نشست با چرخش و باطل شدن refresh قبلی (H6)
    path('token/refresh/', SessionRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('client/dashboard/', ClientDashboardView.as_view(), name='client-dashboard'),
    path('client/referrals/', ClientReferralsView.as_view(), name='client-referrals'),
    path('', include(router.urls)),
]