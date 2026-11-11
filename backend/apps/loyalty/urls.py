from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .sms_views import (
    AdminSmsCampaignViewSet, AdminSmsChargeViewSet, AdminSmsMessageViewSet, AdminSmsSettingsView,
    AdminSmsWalletAdjustView, AdminSmsWalletListView, OwnerSmsCampaignViewSet, OwnerSmsChargeViewSet,
    OwnerSmsLedgerViewSet, OwnerSmsMessageViewSet, OwnerSmsOverviewView, OwnerSmsPreviewView,
    OwnerSmsTemplatePreviewView,
)
from .share_views import (
    AdminCoopViewSet, AdminMerchantLevelView, AdminShareOverviewView, AdminShareSettingsView, AdminWithdrawalViewSet,
    OwnerCoopPartnersView, OwnerCoopQuoteView, OwnerCoopViewSet, OwnerShareOverviewView, OwnerShareVoucherViewSet,
    OwnerWalletView, OwnerWithdrawalViewSet,
)
from .views import (
    BranchViewSet, ClientWalletsView, CustomerLabelViewSet, CustomerRewardViewSet, IncentivePlanViewSet,
    InsightsView, LoyaltySettingsView, PurchaseViewSet, SegmentListView,
    SalesLineViewSet, StoreCustomerViewSet, VerifyStoreCustomerView,
)

router = DefaultRouter()
router.register(r'owner/branches', BranchViewSet, basename='loyalty-branches')
router.register(r'owner/lines', SalesLineViewSet, basename='loyalty-lines')
router.register(r'owner/labels', CustomerLabelViewSet, basename='loyalty-labels')
router.register(r'owner/customers', StoreCustomerViewSet, basename='loyalty-customers')
router.register(r'owner/purchases', PurchaseViewSet, basename='loyalty-purchases')
router.register(r'owner/incentives', IncentivePlanViewSet, basename='loyalty-incentives')
router.register(r'owner/rewards', CustomerRewardViewSet, basename='loyalty-rewards')
router.register(r'owner/sms/campaigns', OwnerSmsCampaignViewSet, basename='loyalty-sms-campaigns')
router.register(r'owner/sms/messages', OwnerSmsMessageViewSet, basename='loyalty-sms-messages')
router.register(r'owner/sms/charges', OwnerSmsChargeViewSet, basename='loyalty-sms-charges')
router.register(r'owner/sms/ledger', OwnerSmsLedgerViewSet, basename='loyalty-sms-ledger')
router.register(r'admin/sms/charges', AdminSmsChargeViewSet, basename='loyalty-admin-sms-charges')
router.register(r'admin/sms/campaigns', AdminSmsCampaignViewSet, basename='loyalty-admin-sms-campaigns')
router.register(r'admin/sms/messages', AdminSmsMessageViewSet, basename='loyalty-admin-sms-messages')
router.register(r'owner/share/vouchers', OwnerShareVoucherViewSet, basename='loyalty-share-vouchers')
router.register(r'owner/share/coops', OwnerCoopViewSet, basename='loyalty-share-coops')
router.register(r'owner/wallet/withdrawals', OwnerWithdrawalViewSet, basename='loyalty-withdrawals')
router.register(r'admin/share/withdrawals', AdminWithdrawalViewSet, basename='loyalty-admin-withdrawals')
router.register(r'admin/share/coops', AdminCoopViewSet, basename='loyalty-admin-coops')

urlpatterns = [
    path('owner/settings/', LoyaltySettingsView.as_view(), name='loyalty-settings'),
    path('owner/verify-customer/', VerifyStoreCustomerView.as_view(), name='loyalty-verify-customer'),
    path('owner/insights/', InsightsView.as_view(), name='loyalty-insights'),
    path('owner/segments/', SegmentListView.as_view(), name='loyalty-segments'),
    path('client/wallets/', ClientWalletsView.as_view(), name='loyalty-client-wallets'),
    path('owner/sms/overview/', OwnerSmsOverviewView.as_view(), name='loyalty-sms-overview'),
    path('owner/sms/preview/', OwnerSmsPreviewView.as_view(), name='loyalty-sms-preview'),
    path('owner/sms/template-preview/', OwnerSmsTemplatePreviewView.as_view(), name='loyalty-sms-template-preview'),
    path('admin/sms/settings/', AdminSmsSettingsView.as_view(), name='loyalty-admin-sms-settings'),
    path('admin/sms/wallets/', AdminSmsWalletListView.as_view(), name='loyalty-admin-sms-wallets'),
    path('admin/sms/wallets/adjust/', AdminSmsWalletAdjustView.as_view(), name='loyalty-admin-sms-adjust'),
    path('owner/share/overview/', OwnerShareOverviewView.as_view(), name='loyalty-share-overview'),
    path('owner/share/partners/', OwnerCoopPartnersView.as_view(), name='loyalty-share-partners'),
    path('owner/share/coop-quote/', OwnerCoopQuoteView.as_view(), name='loyalty-share-coop-quote'),
    path('owner/wallet/', OwnerWalletView.as_view(), name='loyalty-wallet'),
    path('admin/share/settings/', AdminShareSettingsView.as_view(), name='loyalty-admin-share-settings'),
    path('admin/share/overview/', AdminShareOverviewView.as_view(), name='loyalty-admin-share-overview'),
    path('admin/share/levels/', AdminMerchantLevelView.as_view(), name='loyalty-admin-share-levels'),
    path('', include(router.urls)),
]
