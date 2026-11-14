from rest_framework import serializers

from apps.directory.serializers import mask_phone

from .jalali import parse_jalali, to_jalali_str
from .models import Branch, CustomerLabel, LoyaltySettings, Purchase, SalesLine, StoreCustomer, WalletEntry


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = ['default_cashback_percent', 'max_credit_use_percent', 'cashback_expiry_days',
                  'purchase_sms_enabled', 'purchase_sms_template', 'incentive_sms_enabled', 'updated_at']
        read_only_fields = ['updated_at']


class SalesLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesLine
        fields = ['id', 'branch', 'name', 'description', 'cashback_percent', 'max_amount', 'sms_template', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_branch(self, branch):
        business = self.context['business']
        if branch.business_id != business.pk:
            raise serializers.ValidationError("شعبه‌ی نامعتبر.")
        return branch


class BranchSerializer(serializers.ModelSerializer):
    lines = SalesLineSerializer(many=True, read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'name', 'description', 'address', 'is_active', 'lines', 'created_at']
        read_only_fields = ['id', 'lines', 'created_at']


class CustomerLabelSerializer(serializers.ModelSerializer):
    customers_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CustomerLabel
        fields = ['id', 'name', 'color', 'customers_count']
        read_only_fields = ['id', 'customers_count']

    def validate_name(self, value):
        value = value.strip()
        business = self.context['business']
        qs = CustomerLabel.objects.filter(business=business, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("برچسبی با این نام وجود دارد.")
        return value


def _jalali_parts_to_str(y, m, d):
    if not (m and d):
        return ''
    return f"{y:04d}/{m:02d}/{d:02d}" if y else f"{m:02d}/{d:02d}"


class StoreCustomerSerializer(serializers.ModelSerializer):
    """
    تاریخ‌ها به‌صورت شمسی ورودی و خروجی دارند: birth_date و anniversary_date مثل «1370/05/12».
    """
    birth_date = serializers.CharField(required=False, allow_blank=True, write_only=True)
    anniversary_date = serializers.CharField(required=False, allow_blank=True, write_only=True)
    birth_date_display = serializers.SerializerMethodField()
    anniversary_date_display = serializers.SerializerMethodField()
    label_ids = serializers.PrimaryKeyRelatedField(
        source='labels', many=True, required=False, queryset=CustomerLabel.objects.none(),
    )
    labels = CustomerLabelSerializer(many=True, read_only=True)
    has_account = serializers.SerializerMethodField()
    last_purchase_jalali = serializers.SerializerMethodField()
    created_jalali = serializers.SerializerMethodField()

    class Meta:
        model = StoreCustomer
        fields = [
            'id', 'phone_number', 'full_name', 'membership_no', 'marital_status',
            'birth_date', 'anniversary_date', 'birth_date_display', 'anniversary_date_display',
            'birth_month', 'labels', 'label_ids', 'note', 'source', 'sms_opt_out', 'has_account',
            'credit_balance', 'total_purchase_amount', 'purchase_count',
            'last_purchase_at', 'last_purchase_jalali', 'created_at', 'created_jalali',
        ]
        read_only_fields = [
            'id', 'membership_no', 'source', 'birth_month', 'credit_balance', 'total_purchase_amount',
            'purchase_count', 'last_purchase_at', 'created_at',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        business = self.context.get('business')
        if business is not None:
            self.fields['label_ids'].child_relation.queryset = CustomerLabel.objects.filter(business=business)
        if self.instance is not None and not isinstance(self.instance, (list, tuple)) and hasattr(self.instance, 'pk'):
            # شماره موبایل بعد از ثبت قابل تغییر نیست (هویت مشتری)
            self.fields['phone_number'].read_only = True

    def get_birth_date_display(self, obj):
        return _jalali_parts_to_str(obj.birth_year, obj.birth_month, obj.birth_day)

    def get_anniversary_date_display(self, obj):
        return _jalali_parts_to_str(obj.anniversary_year, obj.anniversary_month, obj.anniversary_day)

    def get_has_account(self, obj):
        return bool(obj.user_id)

    def get_last_purchase_jalali(self, obj):
        return to_jalali_str(obj.last_purchase_at)

    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)

    def validate_phone_number(self, value):
        from apps.directory.crm import normalize_phone
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("شماره موبایل معتبر نیست (مثال: 09121234567).")
        business = self.context['business']
        if StoreCustomer.objects.filter(business=business, phone_number=phone).exists():
            raise serializers.ValidationError("این شماره قبلاً در مشتریان شما ثبت شده است.")
        return phone

    @staticmethod
    def _parse_date_field(value, field):
        if value in (None, ''):
            return (None, None, None)
        parts = parse_jalali(value)
        if not parts:
            raise serializers.ValidationError({field: "تاریخ شمسی معتبر نیست (مثال: 1370/05/12)."})
        return parts

    def validate(self, attrs):
        if 'birth_date' in attrs:
            y, m, d = self._parse_date_field(attrs.pop('birth_date'), 'birth_date')
            attrs.update(birth_year=y, birth_month=m, birth_day=d)
        if 'anniversary_date' in attrs:
            y, m, d = self._parse_date_field(attrs.pop('anniversary_date'), 'anniversary_date')
            attrs.update(anniversary_year=y, anniversary_month=m, anniversary_day=d)
        return attrs


class WalletEntrySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    created_jalali = serializers.SerializerMethodField()
    expires_jalali = serializers.SerializerMethodField()

    class Meta:
        model = WalletEntry
        fields = ['id', 'kind', 'kind_display', 'amount', 'balance_after', 'remaining', 'note',
                  'purchase', 'created_at', 'created_jalali', 'expires_at', 'expires_jalali']

    def get_created_jalali(self, obj):
        return to_jalali_str(obj.created_at)

    def get_expires_jalali(self, obj):
        return to_jalali_str(obj.expires_at)


class PurchaseSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    customer_id = serializers.UUIDField(source='customer.pk', read_only=True)
    membership_no = serializers.IntegerField(source='customer.membership_no', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    line_name = serializers.CharField(source='line.name', read_only=True, default='')
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    discount_source_display = serializers.CharField(source='get_discount_source_display', read_only=True)
    purchased_jalali = serializers.SerializerMethodField()
    purchased_time = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            'id', 'customer_id', 'customer_name', 'customer_phone', 'membership_no',
            'branch', 'branch_name', 'line', 'line_name', 'payment_method', 'payment_method_display',
            'original_amount', 'discount_percent', 'discount_source', 'discount_source_display',
            'discount_amount', 'credit_used', 'final_amount', 'cashback_amount', 'verified',
            'source', 'note', 'client_ref', 'pos_reference', 'purchased_at', 'purchased_jalali', 'purchased_time',
        ]

    def get_purchased_jalali(self, obj):
        return to_jalali_str(obj.purchased_at)

    def get_purchased_time(self, obj):
        from django.utils import timezone
        return timezone.localtime(obj.purchased_at).strftime('%H:%M')


class ClientWalletSerializer(serializers.ModelSerializer):
    """کارت «اعتبار من در فروشگاه‌ها» در پنل مشتری"""
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_slug = serializers.CharField(source='business.slug', read_only=True)
    business_logo = serializers.SerializerMethodField()
    next_expiry = serializers.SerializerMethodField()
    rewards = serializers.SerializerMethodField()

    class Meta:
        model = StoreCustomer
        fields = ['id', 'business_name', 'business_slug', 'business_logo', 'membership_no',
                  'credit_balance', 'purchase_count', 'next_expiry', 'rewards']

    def get_business_logo(self, obj):
        request = self.context.get('request')
        if obj.business.logo and request:
            return request.build_absolute_uri(obj.business.logo.url)
        return None

    def get_rewards(self, obj):
        """هدیه‌های فعال (قابل استفاده) مشتری در این فروشگاه"""
        from .incentives import describe_reward, usable_rewards
        return [
            {"id": r.pk, "title": r.title, "description": describe_reward(r.reward_type, r.value, r.max_discount, r.gift_text),
             "valid_until": to_jalali_str(r.valid_until), "min_purchase": r.min_purchase}
            for r in usable_rewards(obj)
        ]

    def get_next_expiry(self, obj):
        entry = (obj.wallet_entries.filter(remaining__gt=0, expires_at__isnull=False)
                 .order_by('expires_at').first())
        if not entry:
            return None
        return {"amount": entry.remaining, "date": to_jalali_str(entry.expires_at)}


def verified_customer_payload(customer, token):
    """اطلاعاتی که بعد از تأیید کد خرید به فروشنده نمایش داده می‌شود"""
    from apps.directory.crm import mask_name
    name = customer.full_name
    # اگر فروشنده اسمی ثبت نکرده، اسم حساب سایت فقط ماسک‌شده نمایش داده می‌شود
    if not name and customer.user_id:
        name = mask_name(customer.user.full_name)
    return {
        "verification_token": token,
        "customer_id": str(customer.pk),
        "customer_name": name or "مشتری",
        "phone_number": mask_phone(customer.phone_number),
        "membership_no": customer.membership_no,
        "credit_balance": customer.credit_balance,
        "has_account": bool(customer.user_id),
    }


# ------------------------------------------------------------------ طرح‌های تشویقی
from .models import CustomerReward, IncentivePlan  # noqa: E402


class IncentivePlanSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    reward_type_display = serializers.CharField(source='get_reward_type_display', read_only=True)
    description = serializers.SerializerMethodField()
    used_count = serializers.IntegerField(read_only=True, default=0)
    active_count = serializers.IntegerField(read_only=True, default=0)
    starts_on = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ends_on = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    starts_on_jalali = serializers.SerializerMethodField()
    ends_on_jalali = serializers.SerializerMethodField()

    class Meta:
        model = IncentivePlan
        fields = [
            'id', 'kind', 'kind_display', 'title', 'is_active', 'reward_type', 'reward_type_display', 'value',
            'max_discount', 'gift_text', 'min_purchase', 'valid_days', 'inactive_days', 'days_before', 'message',
            'starts_on', 'ends_on', 'starts_on_jalali', 'ends_on_jalali', 'max_grants', 'grants_count',
            'used_count', 'active_count', 'description', 'created_at',
        ]
        read_only_fields = ['id', 'grants_count', 'created_at']

    def get_description(self, obj):
        from .incentives import describe_reward
        return describe_reward(obj.reward_type, obj.value, obj.max_discount, obj.gift_text)

    def update(self, instance, validated_data):
        # فقط فیلدهای ویرایش‌شده ذخیره می‌شوند تا شمارنده‌ی grants_count هم‌زمان از دست نرود
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save(update_fields=list(validated_data) + ['updated_at'])
        return instance

    def get_starts_on_jalali(self, obj):
        return to_jalali_str(obj.starts_on)

    def get_ends_on_jalali(self, obj):
        return to_jalali_str(obj.ends_on)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['starts_on'] = data.pop('starts_on_jalali')
        data['ends_on'] = data.pop('ends_on_jalali')
        return data

    @staticmethod
    def _date(value, field):
        from .jalali import parse_date_param
        if value in (None, ''):
            return None
        d = parse_date_param(value)
        if not d:
            raise serializers.ValidationError({field: "تاریخ معتبر نیست (مثال: 1405/01/01)."})
        return d

    def validate(self, attrs):
        for f in ('starts_on', 'ends_on'):
            if f in attrs:
                attrs[f] = self._date(attrs[f], f)
        inst = self.instance
        get = lambda k: attrs.get(k, getattr(inst, k, None) if inst else None)  # noqa: E731
        rtype, value = get('reward_type'), get('value') or 0
        if rtype == IncentivePlan.RewardType.PERCENT and not (1 <= value <= 100):
            raise serializers.ValidationError({"value": "درصد تخفیف باید بین ۱ تا ۱۰۰ باشد."})
        if rtype in (IncentivePlan.RewardType.AMOUNT, IncentivePlan.RewardType.CREDIT) and value <= 0:
            raise serializers.ValidationError({"value": "مبلغ هدیه را وارد کنید."})
        if rtype == IncentivePlan.RewardType.GIFT and not (get('gift_text') or '').strip():
            raise serializers.ValidationError({"gift_text": "شرح هدیه را بنویسید (مثلاً یک قهوه‌ی رایگان)."})
        s, e = get('starts_on'), get('ends_on')
        if s and e and e < s:
            raise serializers.ValidationError({"ends_on": "تاریخ پایان باید بعد از تاریخ شروع باشد."})
        if get('kind') == IncentivePlan.Kind.WINBACK and not (get('inactive_days') or 0) >= 7:
            raise serializers.ValidationError({"inactive_days": "حداقل ۷ روز بدون خرید."})
        if (get('days_before') or 0) > 30:
            raise serializers.ValidationError({"days_before": "حداکثر ۳۰ روز قبل."})
        return attrs


class CustomerRewardSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    status_display = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    customer_id = serializers.UUIDField(source='customer.pk', read_only=True)
    issued_jalali = serializers.SerializerMethodField()
    valid_until_jalali = serializers.SerializerMethodField()
    used_jalali = serializers.SerializerMethodField()

    class Meta:
        model = CustomerReward
        fields = ['id', 'kind', 'kind_display', 'title', 'reward_type', 'description', 'status', 'status_display',
                  'customer_id', 'customer_name', 'customer_phone', 'issued_jalali', 'valid_until_jalali',
                  'used_jalali', 'purchase']

    def get_status_display(self, obj):
        if obj.status == CustomerReward.Status.ACTIVE and not obj.is_usable:
            return "منقضی‌شده"
        if obj.reward_type == IncentivePlan.RewardType.CREDIT and obj.status == CustomerReward.Status.USED:
            return "به کیف‌پول اضافه شد"
        return obj.get_status_display()

    def get_description(self, obj):
        from .incentives import describe_reward
        return describe_reward(obj.reward_type, obj.value, obj.max_discount, obj.gift_text)

    def get_issued_jalali(self, obj):
        return to_jalali_str(obj.issued_at)

    def get_valid_until_jalali(self, obj):
        return to_jalali_str(obj.valid_until)

    def get_used_jalali(self, obj):
        return to_jalali_str(obj.used_at)
