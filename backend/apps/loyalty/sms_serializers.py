from rest_framework import serializers

from apps.directory.serializers import IMAGE_EXTS, MAX_IMAGE_MB, validate_upload

from .jalali import to_jalali_str
from .models import SmsCampaign, SmsChargeRequest, SmsLedger, SmsMessage, SmsSettings


class _JalaliMixin:
    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)


class SmsSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsSettings
        fields = ['price_per_part', 'require_approval', 'card_info', 'opt_out_text', 'updated_at']
        read_only_fields = ['updated_at']


class SmsChargeRequestSerializer(_JalaliMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    created_jalali = serializers.SerializerMethodField()

    class Meta:
        model = SmsChargeRequest
        fields = ['id', 'business_name', 'amount', 'ref_code', 'receipt', 'note', 'status', 'status_display',
                  'admin_note', 'created_at', 'created_jalali']
        read_only_fields = ['id', 'status', 'admin_note', 'created_at']

    def validate_amount(self, v):
        if v < 10000:
            raise serializers.ValidationError("حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است.")
        if v > 500_000_000:
            raise serializers.ValidationError("مبلغ نامعتبر است.")
        return v

    def validate_receipt(self, f):
        return validate_upload(f, IMAGE_EXTS, MAX_IMAGE_MB)

    def validate(self, attrs):
        if not attrs.get('ref_code') and not attrs.get('receipt'):
            raise serializers.ValidationError({"ref_code": "کد پیگیری یا تصویر رسید را وارد کنید."})
        return attrs


class SmsCampaignSerializer(_JalaliMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    created_jalali = serializers.SerializerMethodField()
    queued_count = serializers.SerializerMethodField()

    class Meta:
        model = SmsCampaign
        fields = ['id', 'business_name', 'title', 'text', 'filters', 'recipients_count', 'parts', 'cost', 'status',
                  'status_display', 'admin_note', 'sent_count', 'failed_count', 'queued_count', 'created_at', 'created_jalali']

    def get_queued_count(self, obj):
        if obj.status != SmsCampaign.Status.SENDING:
            return 0
        return max(0, obj.recipients_count - obj.sent_count - obj.failed_count)


class SmsMessageSerializer(_JalaliMixin, serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True, default='')
    business_name = serializers.CharField(source='business.name', read_only=True)
    created_jalali = serializers.SerializerMethodField()

    class Meta:
        model = SmsMessage
        fields = ['id', 'business_name', 'phone', 'customer_name', 'text', 'kind', 'kind_display', 'parts', 'cost',
                  'status', 'status_display', 'error', 'campaign', 'created_at', 'created_jalali']


class SmsLedgerSerializer(_JalaliMixin, serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    created_jalali = serializers.SerializerMethodField()

    class Meta:
        model = SmsLedger
        fields = ['id', 'kind', 'kind_display', 'amount', 'balance_after', 'note', 'created_at', 'created_jalali']
