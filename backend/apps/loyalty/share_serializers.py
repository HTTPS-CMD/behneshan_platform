from rest_framework import serializers

from apps.directory.serializers import mask_phone

from .jalali import to_jalali_str
from .models import CoopShare, ShareProfile, ShareSettings, ShareVoucher, WithdrawalRequest


class ShareSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareSettings
        exclude = ['id']
        read_only_fields = ['updated_at']

    def validate(self, attrs):
        inst = self.instance
        get = lambda k: attrs.get(k, getattr(inst, k, None))
        if get('min_fee') > get('max_fee'):
            raise serializers.ValidationError({"min_fee": "حداقل هزینه نباید از حداکثر بیشتر باشد."})
        if not (get('min_fee') <= get('default_fee') <= get('max_fee')):
            raise serializers.ValidationError({"default_fee": "هزینه‌ی پیش‌فرض باید بین حداقل و حداکثر باشد."})
        if get('coop_min_price') > get('coop_max_price'):
            raise serializers.ValidationError({"coop_min_price": "حداقل سهم نباید از حداکثر بیشتر باشد."})
        if not (get('silver_min_score') < get('gold_min_score') < get('diamond_min_score')):
            raise serializers.ValidationError({"silver_min_score": "امتیاز سطح‌ها باید به ترتیب نقره‌ای < طلایی < الماس باشد."})
        for k in ('silver_commission_off', 'gold_commission_off', 'diamond_commission_off'):
            if get(k) > get('commission_percent'):
                raise serializers.ValidationError({k: "کاهش کارمزد نمی‌تواند از خود کارمزد بیشتر باشد."})
        return attrs


class ShareProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareProfile
        fields = ['send_enabled', 'receive_enabled', 'discount_percent', 'max_discount', 'min_purchase', 'valid_days',
                  'fee_per_customer', 'coop_enabled', 'coop_price', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_fee_per_customer(self, v):
        cfg = ShareSettings.get()
        if not (cfg.min_fee <= v <= cfg.max_fee):
            raise serializers.ValidationError(f"هزینه‌ی هر مشتری جدید باید بین {cfg.min_fee:,} و {cfg.max_fee:,} تومان باشد.")
        return v

    def validate_coop_price(self, v):
        cfg = ShareSettings.get()
        if not (cfg.coop_min_price <= v <= cfg.coop_max_price):
            raise serializers.ValidationError(f"سهم هر گیرنده باید بین {cfg.coop_min_price:,} و {cfg.coop_max_price:,} تومان باشد.")
        return v


class VoucherOutSerializer(serializers.ModelSerializer):
    """کوپن‌هایی که مشتریان من (فروشگاه معرف) گرفته‌اند"""
    target_name = serializers.CharField(source='target.name', read_only=True)
    phone_masked = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_jalali = serializers.SerializerMethodField()
    used_jalali = serializers.SerializerMethodField()

    class Meta:
        model = ShareVoucher
        fields = ['id', 'code', 'target_name', 'phone_masked', 'discount_percent', 'fee', 'status', 'status_display',
                  'origin_income', 'created_jalali', 'used_jalali']

    def get_phone_masked(self, obj):
        return mask_phone(obj.phone)

    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)

    def get_used_jalali(self, obj):
        return to_jalali_str(obj.used_at) if obj.used_at else ''


class VoucherInSerializer(VoucherOutSerializer):
    """کوپن‌های فروشگاه من: شماره فقط بعد از خرید (تأیید با کد خرید) دیده می‌شود"""
    origin_name = serializers.CharField(source='origin.name', read_only=True)
    customer = serializers.SerializerMethodField()

    class Meta(VoucherOutSerializer.Meta):
        fields = ['id', 'origin_name', 'customer', 'phone_masked', 'discount_percent', 'fee', 'status', 'status_display',
                  'created_jalali', 'used_jalali']

    def get_customer(self, obj):
        if obj.status != ShareVoucher.Status.USED or not obj.used_purchase_id:
            return None
        c = obj.used_purchase.customer
        return {"id": str(c.pk), "name": c.full_name, "phone": c.phone_number}

    def get_phone_masked(self, obj):
        # حریم خصوصی: تا خرید با کوپن، فروشگاه پذیرنده هیچ بخشی از شماره را نمی‌بیند
        return obj.phone if obj.status == ShareVoucher.Status.USED else None


class ClientVoucherSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='target.name', read_only=True)
    business_slug = serializers.CharField(source='target.slug', read_only=True)
    business_address = serializers.CharField(source='target.address', read_only=True, default='')
    origin_name = serializers.CharField(source='origin.name', read_only=True)
    description = serializers.SerializerMethodField()
    valid_until_jalali = serializers.SerializerMethodField()
    business_logo = serializers.SerializerMethodField()

    class Meta:
        model = ShareVoucher
        fields = ['id', 'code', 'business_name', 'business_slug', 'business_logo', 'business_address', 'origin_name',
                  'discount_percent', 'max_discount', 'min_purchase', 'description', 'valid_until', 'valid_until_jalali']

    def get_description(self, obj):
        from .share import describe_voucher
        return describe_voucher(obj)

    def get_valid_until_jalali(self, obj):
        return to_jalali_str(obj.valid_until)

    def get_business_logo(self, obj):
        request = self.context.get('request')
        if obj.target.logo and request:
            return request.build_absolute_uri(obj.target.logo.url)
        return None


class CoopShareSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source='requester.name', read_only=True)
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_jalali = serializers.SerializerMethodField()
    expected_partner_income = serializers.SerializerMethodField()

    class Meta:
        model = CoopShare
        fields = ['id', 'requester_name', 'partner_name', 'title', 'text', 'final_text', 'parts', 'recipients_count',
                  'unit_sms_cost', 'partner_price', 'commission_percent', 'cost', 'status', 'status_display',
                  'partner_note', 'admin_note', 'sent_count', 'failed_count', 'partner_income',
                  'expected_partner_income', 'created_jalali']

    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)

    def get_expected_partner_income(self, obj):
        return obj.recipients_count * obj.partner_price * (100 - obj.commission_percent) // 100


class WithdrawalSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_jalali = serializers.SerializerMethodField()
    reviewed_jalali = serializers.SerializerMethodField()

    class Meta:
        model = WithdrawalRequest
        fields = ['id', 'business_name', 'amount', 'sheba', 'account_holder', 'note', 'status',
                  'status_display', 'admin_note', 'bank_ref', 'created_jalali', 'reviewed_jalali']

    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)

    def get_reviewed_jalali(self, obj):
        return to_jalali_str(obj.reviewed_at) if obj.reviewed_at else ''
