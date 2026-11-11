from django.contrib import admin

from .models import Branch, CustomerLabel, LoyaltySettings, Purchase, SalesLine, StoreCustomer, WalletEntry


class SalesLineInline(admin.TabularInline):
    model = SalesLine
    extra = 0


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('name', 'business', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'business__name')
    inlines = [SalesLineInline]


@admin.register(LoyaltySettings)
class LoyaltySettingsAdmin(admin.ModelAdmin):
    list_display = ('business', 'default_cashback_percent', 'max_credit_use_percent', 'cashback_expiry_days')


@admin.register(CustomerLabel)
class CustomerLabelAdmin(admin.ModelAdmin):
    list_display = ('name', 'business', 'color')
    search_fields = ('name', 'business__name')


@admin.register(StoreCustomer)
class StoreCustomerAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'full_name', 'business', 'membership_no', 'credit_balance', 'purchase_count', 'source')
    list_filter = ('source', 'marital_status')
    search_fields = ('phone_number', 'full_name', 'business__name')
    readonly_fields = ('credit_balance', 'total_purchase_amount', 'purchase_count', 'first_purchase_at', 'last_purchase_at')
    raw_id_fields = ('user', 'business')


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ('business', 'customer', 'original_amount', 'final_amount', 'credit_used', 'cashback_amount',
                    'payment_method', 'verified', 'purchased_at')
    list_filter = ('payment_method', 'verified', 'source')
    search_fields = ('customer__phone_number', 'business__name')
    raw_id_fields = ('business', 'customer', 'branch', 'line', 'transaction_log', 'created_by')

    def has_change_permission(self, request, obj=None):
        return False  # تراکنش‌ها فقط‌خواندنی‌اند تا با دفتر کیف‌پول ناهماهنگ نشوند


@admin.register(WalletEntry)
class WalletEntryAdmin(admin.ModelAdmin):
    list_display = ('customer', 'kind', 'amount', 'balance_after', 'remaining', 'expires_at', 'created_at')
    list_filter = ('kind',)
    search_fields = ('customer__phone_number',)
    raw_id_fields = ('customer', 'purchase', 'created_by')

    def has_change_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False


from .models import CustomerReward, IncentivePlan  # noqa: E402


@admin.register(IncentivePlan)
class IncentivePlanAdmin(admin.ModelAdmin):
    list_display = ('title', 'business', 'kind', 'reward_type', 'value', 'is_active', 'grants_count')
    list_filter = ('kind', 'reward_type', 'is_active')
    search_fields = ('title', 'business__name')


@admin.register(CustomerReward)
class CustomerRewardAdmin(admin.ModelAdmin):
    list_display = ('title', 'customer', 'kind', 'reward_type', 'status', 'issued_at', 'valid_until')
    list_filter = ('kind', 'reward_type', 'status')
    search_fields = ('customer__phone_number', 'title')
    raw_id_fields = ('customer', 'plan', 'purchase', 'wallet_entry')


from .models import SmsCampaign, SmsChargeRequest, SmsLedger, SmsMessage, SmsSettings, SmsWallet  # noqa: E402


@admin.register(SmsSettings)
class SmsSettingsAdmin(admin.ModelAdmin):
    list_display = ('price_per_part', 'require_approval', 'updated_at')


@admin.register(SmsWallet)
class SmsWalletAdmin(admin.ModelAdmin):
    list_display = ('business', 'balance', 'withdrawable', 'updated_at')
    search_fields = ('business__name',)
    readonly_fields = ('balance', 'withdrawable')


@admin.register(SmsChargeRequest)
class SmsChargeRequestAdmin(admin.ModelAdmin):
    list_display = ('business', 'amount', 'ref_code', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('status',)  # تأیید فقط از پنل مدیریت سایت تا شارژ کیف‌پول ثبت شود


@admin.register(SmsCampaign)
class SmsCampaignAdmin(admin.ModelAdmin):
    list_display = ('title', 'business', 'recipients_count', 'cost', 'status', 'sent_count', 'failed_count', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('status', 'cost', 'recipient_ids')


@admin.register(SmsMessage)
class SmsMessageAdmin(admin.ModelAdmin):
    list_display = ('phone', 'business', 'kind', 'status', 'cost', 'created_at')
    list_filter = ('kind', 'status')
    search_fields = ('phone', 'business__name')

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(SmsLedger)
class SmsLedgerAdmin(admin.ModelAdmin):
    list_display = ('business', 'kind', 'amount', 'balance_after', 'created_at')
    list_filter = ('kind',)

    def has_change_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False


from .models import CoopShare, MerchantStatus, ShareProfile, ShareSettings, ShareVoucher, WithdrawalRequest  # noqa: E402


@admin.register(ShareSettings)
class ShareSettingsAdmin(admin.ModelAdmin):
    list_display = ('enabled', 'commission_percent', 'default_fee', 'updated_at')


@admin.register(ShareProfile)
class ShareProfileAdmin(admin.ModelAdmin):
    list_display = ('business', 'send_enabled', 'receive_enabled', 'discount_percent', 'fee_per_customer', 'coop_enabled')
    list_filter = ('send_enabled', 'receive_enabled', 'coop_enabled')
    search_fields = ('business__name',)


@admin.register(ShareVoucher)
class ShareVoucherAdmin(admin.ModelAdmin):
    list_display = ('code', 'origin', 'target', 'status', 'fee', 'origin_income', 'valid_until', 'created_at')
    list_filter = ('status',)
    search_fields = ('code', 'origin__name', 'target__name')
    readonly_fields = ('origin_purchase', 'used_purchase', 'origin_income', 'commission')


@admin.register(MerchantStatus)
class MerchantStatusAdmin(admin.ModelAdmin):
    list_display = ('business', 'level', 'score', 'manual', 'computed_at')
    list_filter = ('level', 'manual')
    search_fields = ('business__name',)


@admin.register(CoopShare)
class CoopShareAdmin(admin.ModelAdmin):
    list_display = ('title', 'requester', 'partner', 'status', 'recipients_count', 'sent_count', 'cost', 'created_at')
    list_filter = ('status',)
    search_fields = ('title', 'requester__name', 'partner__name')
    readonly_fields = ('cost', 'partner_income', 'sent_count', 'failed_count')


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('business', 'amount', 'sheba', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('business__name', 'sheba')
    readonly_fields = ('amount', 'sheba', 'status')
