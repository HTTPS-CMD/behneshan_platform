from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminSiteContentView, AdminVerifyBusinessView, BusinessDetailView, BusinessListView, BusinessCreateView, BusinessOwnerStoryDetailView, BusinessOwnerStoryView, ClientRecentViewsAPIView, OwnerAnalyticsView, PublicActiveStoriesView, PublicSiteContentView, ReplyToReviewView, UserBusinessListView, BusinessUpdateView, BusinessReviewListView, BusinessAnalyticsAPIView,AdminBusinessListView,ValidateCampaignCodeView, OwnerCampaignViewSet, OwnerRedeemDiscountView, BusinessProfileView, VerifyCustomerDiscountView, RecordTransactionView, OwnerCustomersListView, SubscriptionPlanListView, PurchaseSubscriptionView, ClientVIPStatusView
from . import views

router = DefaultRouter()
router.register(r'owner/campaigns', OwnerCampaignViewSet, basename='owner-campaigns')


urlpatterns = [
    path('businesses/me/', UserBusinessListView.as_view(), name='my-businesses'),
    path('businesses/', BusinessListView.as_view(), name='business-list'),
    path('businesses/create/', BusinessCreateView.as_view(), name='business-create'),
    path('businesses/<slug:slug>/', BusinessDetailView.as_view(), name='business-detail'),
    path('businesses/<slug:slug>/update/', BusinessUpdateView.as_view(), name='business-update'),
    path('businesses/<slug:slug>/reviews/', BusinessReviewListView.as_view(), name='business-reviews'),
    path('reviews/<int:review_id>/reply/', ReplyToReviewView.as_view(), name='review-reply'),
    path('businesses/analytics/me/', BusinessAnalyticsAPIView.as_view(), name='business-analytics'),
    path('admin/businesses/', AdminBusinessListView.as_view(), name='admin-business-list'),
    path('admin/businesses/<uuid:pk>/verify/', AdminVerifyBusinessView.as_view(), name='admin-business-verify'),
    path('campaigns/validate/', ValidateCampaignCodeView.as_view(), name='validate-campaign-code'),
    path('', include(router.urls)),
    path('owner/redeem/<int:usage_id>/', OwnerRedeemDiscountView.as_view(), name='owner-redeem-discount'),
    path('owner/business/', BusinessProfileView.as_view(), name='owner-business-profile'),
    path('owner/analytics/', OwnerAnalyticsView.as_view(), name='owner-analytics'),
    path('owner/crm/verify-discount/', VerifyCustomerDiscountView.as_view(), name='owner-verify-discount'),
    path('owner/crm/record-transaction/', RecordTransactionView.as_view(), name='owner-record-transaction'),
    path('owner/crm/customers/', OwnerCustomersListView.as_view(), name='owner-customers-list'),
    path('client/subscription/plans/', SubscriptionPlanListView.as_view(), name='subscription-plans'),
    path('client/subscription/purchase/', PurchaseSubscriptionView.as_view(), name='subscription-purchase'),
    path('client/recent-visits/', ClientRecentViewsAPIView.as_view(), name='client-recent-visits'),
    path('client/vip/status/', ClientVIPStatusView.as_view(), name='client-vip-status'),
    path('admin/subscription-plans/', views.AdminSubscriptionPlanListCreateView.as_view(), name='admin_vip_plans'),
    path('admin/subscription-plans/<int:pk>/', views.AdminSubscriptionPlanDetailView.as_view(), name='admin_vip_plan_detail'),
    path('admin/transactions/', views.AdminTransactionLogListView.as_view(), name='admin_transactions'),
    path('client/campaigns/claim/', views.ClaimCampaignView.as_view(), name='claim-campaign'),
    path('client/campaigns/', views.ClientCampaignsListView.as_view(), name='client-campaigns'),
    path('content/<str:page_type>/', PublicSiteContentView.as_view(), name='public-content'),
    path('admin/content/<str:page_type>/', AdminSiteContentView.as_view(), name='admin-content'),
    path('owner/stories/', BusinessOwnerStoryView.as_view(), name='owner-stories'),
    path('owner/stories/<int:pk>/', BusinessOwnerStoryDetailView.as_view(), name='owner-story-detail'),
    path('public/stories/active/', PublicActiveStoriesView.as_view(), name='public-active-stories'),
]
