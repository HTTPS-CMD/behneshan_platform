from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminSiteContentView, AdminVerifyBusinessView, BusinessDetailView, BusinessListView, BusinessCreateView, BusinessOwnerStoryDetailView, BusinessOwnerStoryView, BusinessProductViewSet, BusinessRequestListCreateView, BusinessSalesSummaryView, ClientFavoriteBusinessesListView, ClientRecentViewsAPIView, DailyDiscountsListView, MerchantRankingListView, OwnerAnalyticsView, PublicActiveStoriesView, PublicSiteContentView, ReplyToReviewView, ToggleFavoriteBusinessView, UserBusinessListView, BusinessUpdateView, BusinessReviewListView, BusinessAnalyticsAPIView,AdminBusinessListView,ValidateCampaignCodeView, OwnerCampaignViewSet, OwnerRedeemDiscountView, BusinessProfileView, VerifyCustomerDiscountView, RecordTransactionView, OwnerCustomersListView, SubscriptionPlanListView, PurchaseSubscriptionView, ClientVIPStatusView
from . import views

router = DefaultRouter()
router.register(r'owner/campaigns', OwnerCampaignViewSet, basename='owner-campaigns')
router.register(r'owner/products', BusinessProductViewSet, basename='owner-products')


urlpatterns = [
    path('businesses/me/', UserBusinessListView.as_view(), name='my-businesses'),
    path('businesses/', BusinessListView.as_view(), name='business-list'),
    path('businesses/create/', BusinessCreateView.as_view(), name='business-create'),
    path('businesses/<str:slug>/', BusinessDetailView.as_view(), name='business-detail'),
    path('businesses/<str:slug>/update/', BusinessUpdateView.as_view(), name='business-update'),
    path('businesses/<str:slug>/reviews/', BusinessReviewListView.as_view(), name='business-reviews'),
    path('reviews/<uuid:review_id>/reply/', ReplyToReviewView.as_view(), name='review-reply'),
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
    path('admin/businesses/<uuid:pk>/', views.AdminBusinessDeleteView.as_view(), name='admin-business-delete'),
    path('owner/stories/', BusinessOwnerStoryView.as_view(), name='owner-stories'),
    path('owner/stories/<int:pk>/', BusinessOwnerStoryDetailView.as_view(), name='owner-story-detail'),
    path('public/stories/active/', PublicActiveStoriesView.as_view(), name='public-active-stories'),
    path('owner/sales-summary/', BusinessSalesSummaryView.as_view(), name='owner-sales-summary'),
    path('owner/requests/', BusinessRequestListCreateView.as_view(), name='owner-requests'),
    path('rankings/', MerchantRankingListView.as_view(), name='merchant-rankings'),
    path('businesses/<str:slug>/toggle-favorite/', ToggleFavoriteBusinessView.as_view(), name='toggle-favorite'),
    path('client/favorite-businesses/', ClientFavoriteBusinessesListView.as_view(), name='client-favorite-businesses'),
    path('daily-discounts/', DailyDiscountsListView.as_view(), name='daily-discounts'),
    path('admin/toggle-demo-data/', views.AdminToggleDemoDataView.as_view(), name='admin-toggle-demo-data'),
] + router.urls
