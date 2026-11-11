"""
باشگاه مشتریان (Loyalty): کش‌بک، کیف‌پول اعتبار مشتری در هر فروشگاه، شعبه و بخش فروش، و تراکنش‌ها.

نکته‌ها:
- همه‌ی مبالغ به تومان و عدد صحیح هستند (مثل بقیه‌ی سایت).
- موجودی اعتبار هر مشتری در هر فروشگاه جداست (اعتبار فروشگاه A فقط در فروشگاه A خرج می‌شود).
- هر تغییر موجودی یک ردیف WalletEntry دارد تا حساب‌رسی دقیق باشد.
"""
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

PERCENT_VALIDATORS = [MinValueValidator(0), MaxValueValidator(100)]


class LoyaltySettings(models.Model):
    business = models.OneToOneField('directory.Business', on_delete=models.CASCADE, related_name='loyalty_settings')
    default_cashback_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=PERCENT_VALIDATORS,
        verbose_name="درصد کش‌بک پیش‌فرض",
        help_text="برای خریدهایی که بخش فروش ندارند",
    )
    max_credit_use_percent = models.PositiveSmallIntegerField(
        default=100, validators=PERCENT_VALIDATORS,
        verbose_name="حداکثر درصد فاکتور قابل پرداخت با اعتبار",
    )
    cashback_expiry_days = models.PositiveIntegerField(
        default=0, verbose_name="مدت اعتبار کش‌بک (روز)", help_text="۰ یعنی بدون انقضا",
    )
    # --- پیامک‌های خودکار (سامانه پیامکی)
    purchase_sms_enabled = models.BooleanField(default=False, verbose_name="پیامک بعد از هر خرید")
    purchase_sms_template = models.TextField(
        blank=True,
        default="{نام} عزیز، خرید {مبلغ} تومانی شما در {فروشگاه} ثبت شد. کش‌بک: {کش_بک} تومان. موجودی اعتبار: {موجودی} تومان",
        verbose_name="قالب پیامک خرید",
    )
    incentive_sms_enabled = models.BooleanField(default=True, verbose_name="پیامک هدیه‌های طرح‌های تشویقی")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات باشگاه"
        verbose_name_plural = "تنظیمات باشگاه"

    def __str__(self):
        return f"تنظیمات باشگاه {self.business}"


class Branch(models.Model):
    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=120, verbose_name="نام شعبه")
    description = models.CharField(max_length=500, blank=True, verbose_name="توضیحات")
    address = models.CharField(max_length=500, blank=True, verbose_name="آدرس")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "شعبه"
        verbose_name_plural = "شعب"

    def __str__(self):
        return self.name


class SalesLine(models.Model):
    """بخش فروش (مثلاً پوشاک، لوازم خانگی) با درصد کش‌بک اختصاصی"""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='lines')
    name = models.CharField(max_length=120, verbose_name="نام بخش")
    description = models.CharField(max_length=500, blank=True, verbose_name="توضیحات")
    cashback_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=PERCENT_VALIDATORS, verbose_name="درصد کش‌بک",
    )
    max_amount = models.PositiveBigIntegerField(
        null=True, blank=True, verbose_name="سقف مبلغ مشمول کش‌بک (تومان)",
        help_text="خالی یعنی بدون سقف",
    )
    sms_template = models.TextField(blank=True, verbose_name="قالب پیامک خرید این بخش", help_text="خالی = قالب کلی فروشگاه")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "بخش فروش"
        verbose_name_plural = "بخش‌های فروش"

    def __str__(self):
        return f"{self.branch.name} / {self.name}"


class CustomerLabel(models.Model):
    COLORS = (
        ('brand', 'سرمه‌ای'), ('saffron', 'زعفرانی'), ('emerald', 'سبز'),
        ('rose', 'قرمز'), ('sky', 'آبی'), ('violet', 'بنفش'), ('slate', 'خاکستری'),
    )
    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='customer_labels')
    name = models.CharField(max_length=60, verbose_name="نام برچسب")
    color = models.CharField(max_length=20, choices=COLORS, default='brand')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('business', 'name')
        verbose_name = "برچسب مشتری"
        verbose_name_plural = "برچسب‌های مشتری"

    def __str__(self):
        return self.name


class StoreCustomer(models.Model):
    """مشتری یک فروشگاه. با شماره موبایل شناخته می‌شود و اگر حساب سایت داشته باشد به آن وصل است."""

    class Source(models.TextChoices):
        MANUAL = 'MANUAL', 'ثبت دستی'
        PURCHASE = 'PURCHASE', 'ثبت در خرید'
        IMPORT = 'IMPORT', 'ورود از اکسل'

    class Marital(models.TextChoices):
        UNKNOWN = '', 'نامشخص'
        SINGLE = 'SINGLE', 'مجرد'
        MARRIED = 'MARRIED', 'متأهل'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='store_customers')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='store_memberships',
    )
    phone_number = models.CharField(max_length=11, verbose_name="موبایل")
    full_name = models.CharField(max_length=150, blank=True, verbose_name="نام")
    membership_no = models.PositiveIntegerField(verbose_name="شماره اشتراک")
    marital_status = models.CharField(max_length=10, choices=Marital.choices, default='', blank=True)
    # تاریخ‌های شمسی به‌صورت جدا نگه داشته می‌شوند تا تولد/سالگرد هر سال بدون تبدیل پیدا شود
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True)
    birth_month = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(12)])
    birth_day = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(31)])
    anniversary_year = models.PositiveSmallIntegerField(null=True, blank=True)
    anniversary_month = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(12)])
    anniversary_day = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(31)])
    labels = models.ManyToManyField(CustomerLabel, blank=True, related_name='customers')
    note = models.CharField(max_length=500, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    sms_opt_out = models.BooleanField(default=False, verbose_name="لغو دریافت پیامک تبلیغاتی")

    credit_balance = models.PositiveBigIntegerField(default=0, verbose_name="موجودی اعتبار (تومان)")
    total_purchase_amount = models.PositiveBigIntegerField(default=0)
    purchase_count = models.PositiveIntegerField(default=0)
    first_purchase_at = models.DateTimeField(null=True, blank=True)
    last_purchase_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = (('business', 'phone_number'), ('business', 'membership_no'))
        indexes = [models.Index(fields=['business', 'last_purchase_at'])]
        verbose_name = "مشتری فروشگاه"
        verbose_name_plural = "مشتریان فروشگاه"

    def __str__(self):
        return f"{self.full_name or self.phone_number} @ {self.business}"


class Purchase(models.Model):
    """تراکنش خرید در باشگاه مشتریان"""

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', 'نقدی'
        POS = 'POS', 'کارت‌خوان'
        CARD = 'CARD', 'کارت به کارت'
        ONLINE = 'ONLINE', 'آنلاین'
        OTHER = 'OTHER', 'سایر'

    class DiscountSource(models.TextChoices):
        NONE = 'NONE', 'بدون تخفیف'
        SUBSCRIPTION = 'SUBSCRIPTION', 'اشتراک VIP'
        CAMPAIGN = 'CAMPAIGN', 'کمپین اختصاصی'
        FIRST_PURCHASE = 'FIRST_PURCHASE', 'طرح اولین خرید'
        REWARD = 'REWARD', 'هدیه‌ی طرح تشویقی'
        SHARE = 'SHARE', 'کوپن همکاری (اشتراک‌گذاری)'

    class Source(models.TextChoices):
        PANEL = 'PANEL', 'پنل فروشنده'
        IMPORT = 'IMPORT', 'ورود از اکسل'
        LEGACY = 'LEGACY', 'پذیرش مشتری (قدیمی)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='loyalty_purchases')
    customer = models.ForeignKey(StoreCustomer, on_delete=models.PROTECT, related_name='purchases')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    line = models.ForeignKey(SalesLine, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH)

    original_amount = models.PositiveBigIntegerField(verbose_name="مبلغ فاکتور")
    discount_percent = models.PositiveSmallIntegerField(default=0)
    discount_source = models.CharField(max_length=15, choices=DiscountSource.choices, default=DiscountSource.NONE)
    discount_amount = models.PositiveBigIntegerField(default=0)
    credit_used = models.PositiveBigIntegerField(default=0, verbose_name="اعتبار مصرف‌شده")
    final_amount = models.PositiveBigIntegerField(verbose_name="مبلغ پرداختی")
    cashback_amount = models.PositiveBigIntegerField(default=0, verbose_name="کش‌بک")

    verified = models.BooleanField(default=False, verbose_name="تأیید با کد خرید مشتری")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.PANEL)
    note = models.CharField(max_length=500, blank=True)
    transaction_log = models.OneToOneField(
        'directory.TransactionLog', on_delete=models.SET_NULL, null=True, blank=True, related_name='loyalty_purchase',
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    purchased_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchased_at']
        indexes = [models.Index(fields=['business', 'purchased_at'])]
        verbose_name = "تراکنش باشگاه"
        verbose_name_plural = "تراکنش‌های باشگاه"

    def __str__(self):
        return f"{self.business} - {self.customer.phone_number} - {self.final_amount}"


class WalletEntry(models.Model):
    """دفتر کیف‌پول اعتبار مشتری در یک فروشگاه"""

    class Kind(models.TextChoices):
        EARN = 'EARN', 'کش‌بک خرید'
        GIFT = 'GIFT', 'اعتبار هدیه'
        SPEND = 'SPEND', 'مصرف اعتبار'
        EXPIRE = 'EXPIRE', 'انقضای اعتبار'

    customer = models.ForeignKey(StoreCustomer, on_delete=models.CASCADE, related_name='wallet_entries')
    kind = models.CharField(max_length=10, choices=Kind.choices)
    amount = models.BigIntegerField(help_text="مثبت برای واریز، منفی برای برداشت")
    balance_after = models.PositiveBigIntegerField()
    # برای واریزها: چقدر از این واریز هنوز خرج نشده (برای انقضای «اول واریز، اول خرج»)
    remaining = models.PositiveBigIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='wallet_entries')
    note = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "گردش اعتبار"
        verbose_name_plural = "گردش‌های اعتبار"

    def __str__(self):
        return f"{self.get_kind_display()} {self.amount} - {self.customer}"


class IncentivePlan(models.Model):
    """طرح تشویقی: اولین خرید، فراموشی (بازگشت مشتری)، تولد و سالگرد ازدواج"""

    class Kind(models.TextChoices):
        FIRST_PURCHASE = 'FIRST_PURCHASE', 'اولین خرید'
        WINBACK = 'WINBACK', 'فراموشی (بازگشت مشتری)'
        BIRTHDAY = 'BIRTHDAY', 'تولد'
        ANNIVERSARY = 'ANNIVERSARY', 'سالگرد ازدواج'

    class RewardType(models.TextChoices):
        PERCENT = 'PERCENT', 'تخفیف درصدی'
        AMOUNT = 'AMOUNT', 'تخفیف مبلغ ثابت'
        CREDIT = 'CREDIT', 'اعتبار کیف‌پول'
        GIFT = 'GIFT', 'هدیه‌ی کالایی'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='incentive_plans')
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=120, verbose_name="عنوان")
    is_active = models.BooleanField(default=True)

    reward_type = models.CharField(max_length=10, choices=RewardType.choices, default=RewardType.PERCENT)
    value = models.PositiveBigIntegerField(default=0, help_text="درصد (برای تخفیف درصدی) یا مبلغ به تومان")
    max_discount = models.PositiveBigIntegerField(null=True, blank=True, verbose_name="سقف تخفیف (تومان)")
    gift_text = models.CharField(max_length=200, blank=True, verbose_name="شرح هدیه‌ی کالایی")
    min_purchase = models.PositiveBigIntegerField(default=0, verbose_name="حداقل مبلغ خرید (تومان)")

    valid_days = models.PositiveIntegerField(default=30, verbose_name="مدت اعتبار هدیه (روز)")
    inactive_days = models.PositiveIntegerField(default=60, verbose_name="روزهای بدون خرید (طرح فراموشی)")
    days_before = models.PositiveSmallIntegerField(default=0, verbose_name="چند روز قبل از مناسبت")
    message = models.TextField(blank=True, verbose_name="متن پیام/پیامک")

    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    max_grants = models.PositiveIntegerField(null=True, blank=True, verbose_name="سقف تعداد هدیه")
    grants_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['kind', '-created_at']
        verbose_name = "طرح تشویقی"
        verbose_name_plural = "طرح‌های تشویقی"

    def __str__(self):
        return f"{self.get_kind_display()}: {self.title}"

    def is_running(self, day=None):
        day = day or timezone.localdate()
        if not self.is_active:
            return False
        if self.starts_on and day < self.starts_on:
            return False
        if self.ends_on and day > self.ends_on:
            return False
        if self.max_grants is not None and self.grants_count >= self.max_grants:
            return False
        return True


class CustomerReward(models.Model):
    """هدیه‌ای که از یک طرح تشویقی به یک مشتری داده شده است"""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'فعال'
        USED = 'USED', 'استفاده‌شده'
        CANCELLED = 'CANCELLED', 'لغوشده'

    customer = models.ForeignKey(StoreCustomer, on_delete=models.CASCADE, related_name='rewards')
    # PROTECT: طرحی که هدیه داده حذف نمی‌شود (فقط غیرفعال) تا هدیه‌ی تکراری در همان دوره صادر نشود
    plan = models.ForeignKey(IncentivePlan, on_delete=models.PROTECT, null=True, blank=True, related_name='rewards')
    kind = models.CharField(max_length=20, choices=IncentivePlan.Kind.choices)
    title = models.CharField(max_length=120)
    reward_type = models.CharField(max_length=10, choices=IncentivePlan.RewardType.choices)
    value = models.PositiveBigIntegerField(default=0)
    max_discount = models.PositiveBigIntegerField(null=True, blank=True)
    min_purchase = models.PositiveBigIntegerField(default=0)
    gift_text = models.CharField(max_length=200, blank=True)

    # برای جلوگیری از هدیه‌ی تکراری در یک دوره (مثلاً تولد سال ۱۴۰۵)
    period_key = models.CharField(max_length=40)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    issued_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='rewards')
    wallet_entry = models.ForeignKey(WalletEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        ordering = ['-issued_at']
        constraints = [
            models.UniqueConstraint(fields=['plan', 'customer', 'period_key'], name='unique_reward_per_period'),
        ]
        indexes = [models.Index(fields=['customer', 'status'])]
        verbose_name = "هدیه‌ی مشتری"
        verbose_name_plural = "هدیه‌های مشتری"

    def __str__(self):
        return f"{self.title} -> {self.customer}"

    @property
    def is_usable(self):
        return self.status == self.Status.ACTIVE and (not self.valid_until or self.valid_until > timezone.now())



# ======================================================================
# سامانه پیامکی
# ======================================================================
class SmsSettings(models.Model):
    """تنظیمات سراسری سامانه پیامکی (فقط یک ردیف؛ توسط ادمین سایت)"""
    price_per_part = models.PositiveIntegerField(default=150, verbose_name="قیمت هر بخش پیامک (تومان)")
    require_approval = models.BooleanField(default=True, verbose_name="کمپین‌های انبوه نیاز به تأیید ادمین دارند")
    card_info = models.TextField(blank=True, verbose_name="اطلاعات کارت برای شارژ (شماره کارت، نام صاحب حساب)")
    opt_out_text = models.CharField(max_length=30, default="لغو۱۱", verbose_name="متن لغو در پایان پیامک تبلیغاتی")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات سامانه پیامکی"
        verbose_name_plural = "تنظیمات سامانه پیامکی"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SmsWallet(models.Model):
    """
    کیف‌پول فروشنده (مشترک): هزینه‌ی پیامک و هزینه‌ی مشتری جدید از آن کم می‌شود و درآمد اشتراک‌گذاری به آن اضافه می‌شود.
    فقط بخش «درآمد» (withdrawable) قابل برداشت به حساب بانکی است؛ همیشه withdrawable <= balance.
    """
    business = models.OneToOneField('directory.Business', on_delete=models.CASCADE, related_name='sms_wallet')
    balance = models.PositiveBigIntegerField(default=0, verbose_name="موجودی (تومان)")
    withdrawable = models.PositiveBigIntegerField(default=0, verbose_name="درآمد قابل برداشت (تومان)")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "کیف‌پول فروشنده"
        verbose_name_plural = "کیف‌پول‌های فروشندگان"

    def __str__(self):
        return f"{self.business} - {self.balance}"


class SmsChargeRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'در انتظار بررسی'
        APPROVED = 'APPROVED', 'تأیید و شارژ شد'
        REJECTED = 'REJECTED', 'رد شد'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='sms_charge_requests')
    amount = models.PositiveBigIntegerField(verbose_name="مبلغ (تومان)")
    ref_code = models.CharField(max_length=60, blank=True, verbose_name="کد پیگیری")
    receipt = models.ImageField(upload_to='sms/receipts/%Y/%m/', null=True, blank=True, verbose_name="تصویر رسید")
    note = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    admin_note = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "درخواست شارژ پیامک"
        verbose_name_plural = "درخواست‌های شارژ پیامک"


class SmsCampaign(models.Model):
    """ارسال انبوه به مشتریان یک فروشگاه"""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'در انتظار تأیید'
        SENDING = 'SENDING', 'در حال ارسال'
        DONE = 'DONE', 'ارسال‌شده'
        REJECTED = 'REJECTED', 'رد شد'
        CANCELLED = 'CANCELLED', 'لغو شد'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='sms_campaigns')
    title = models.CharField(max_length=120)
    text = models.TextField()
    filters = models.JSONField(default=dict, blank=True)
    recipient_ids = models.JSONField(default=list, blank=True, help_text="فهرست مشتریان در لحظه‌ی ثبت")
    recipients_count = models.PositiveIntegerField(default=0)
    parts = models.PositiveSmallIntegerField(default=1)
    cost = models.PositiveBigIntegerField(default=0, verbose_name="هزینه‌ی رزروشده (تومان)")
    income_used = models.PositiveBigIntegerField(default=0, help_text="بخشی از هزینه که از درآمد قابل برداشت کم شد (برای برگشت درست)")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    admin_note = models.CharField(max_length=300, blank=True)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "کمپین پیامکی"
        verbose_name_plural = "کمپین‌های پیامکی"

    def __str__(self):
        return self.title


class SmsMessage(models.Model):
    class Kind(models.TextChoices):
        BULK = 'BULK', 'انبوه'
        PURCHASE = 'PURCHASE', 'بعد از خرید'
        INCENTIVE = 'INCENTIVE', 'طرح تشویقی'
        COOP = 'COOP', 'همکاری با فروشگاه دیگر'

    class Status(models.TextChoices):
        QUEUED = 'QUEUED', 'در صف'
        SENDING = 'SENDING', 'در حال ارسال'
        SENT = 'SENT', 'ارسال‌شده'
        FAILED = 'FAILED', 'ناموفق'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='sms_messages')
    campaign = models.ForeignKey(SmsCampaign, on_delete=models.CASCADE, null=True, blank=True, related_name='messages')
    customer = models.ForeignKey(StoreCustomer, on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_messages')
    # پیامک «اشتراک‌گذاری دستی»: business = فروشگاه صاحب مشتری (B)، هزینه از کیف‌پول درخواست‌دهنده (A)
    coop = models.ForeignKey('CoopShare', on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    phone = models.CharField(max_length=11)
    text = models.TextField()
    kind = models.CharField(max_length=10, choices=Kind.choices)
    parts = models.PositiveSmallIntegerField(default=1)
    cost = models.PositiveIntegerField(default=0)
    income_used = models.PositiveIntegerField(default=0, help_text="بخشی از هزینه که از درآمد قابل برداشت کم شد")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED, db_index=True)
    provider_id = models.CharField(max_length=60, blank=True)
    error = models.CharField(max_length=300, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    claimed_at = models.DateTimeField(null=True, blank=True, help_text="زمان برداشته شدن از صف برای ارسال")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['customer', 'kind', 'created_at'])]
        verbose_name = "پیامک"
        verbose_name_plural = "پیامک‌ها"


class SmsLedger(models.Model):
    """دفتر حساب کیف‌پول پیامک"""

    class Kind(models.TextChoices):
        CHARGE = 'CHARGE', 'شارژ'
        SEND = 'SEND', 'هزینه‌ی ارسال'
        REFUND = 'REFUND', 'برگشت هزینه'
        ADJUST = 'ADJUST', 'اصلاح توسط ادمین'
        SHARE_FEE = 'SHARE_FEE', 'هزینه‌ی مشتری جدید (همکاری)'
        SHARE_IN = 'SHARE_IN', 'درآمد معرفی مشتری'
        COOP_SEND = 'COOP_SEND', 'هزینه‌ی ارسال همکاری'
        COOP_IN = 'COOP_IN', 'درآمد ارسال همکاری'
        WITHDRAW = 'WITHDRAW', 'برداشت درآمد'
        WD_REFUND = 'WD_REFUND', 'برگشت برداشت رد‌شده'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='sms_ledger')
    kind = models.CharField(max_length=10, choices=Kind.choices)
    amount = models.BigIntegerField()
    balance_after = models.PositiveBigIntegerField()
    note = models.CharField(max_length=300, blank=True)
    campaign = models.ForeignKey(SmsCampaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    charge_request = models.ForeignKey(SmsChargeRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "گردش کیف‌پول فروشنده"
        verbose_name_plural = "گردش‌های کیف‌پول فروشنده"


# ======================================================================
# اشتراک‌گذاری مشتری (ShareClub)، باشگاه پذیرندگان و برداشت درآمد
# ======================================================================
class ShareSettings(models.Model):
    """تنظیمات سراسری اشتراک‌گذاری و باشگاه پذیرندگان (فقط یک ردیف؛ توسط ادمین سایت)"""
    enabled = models.BooleanField(default=True, verbose_name="اشتراک‌گذاری فعال است")
    commission_percent = models.PositiveSmallIntegerField(default=20, validators=PERCENT_VALIDATORS,
                                                          verbose_name="کارمزد سایت از هزینه‌ی هر مشتری جدید (٪)")
    min_fee = models.PositiveIntegerField(default=15000, verbose_name="حداقل هزینه‌ی هر مشتری جدید (تومان)")
    max_fee = models.PositiveIntegerField(default=500000, verbose_name="حداکثر هزینه‌ی هر مشتری جدید (تومان)")
    default_fee = models.PositiveIntegerField(default=70000, verbose_name="هزینه‌ی پیش‌فرض هر مشتری جدید (تومان)")
    vouchers_per_purchase = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(5)],
                                                             verbose_name="حداکثر کوپن بعد از هر خرید")
    issue_cooldown_days = models.PositiveSmallIntegerField(default=7, verbose_name="فاصله‌ی صدور کوپن برای یک مشتری (روز)")
    max_distance_km = models.PositiveSmallIntegerField(default=10, verbose_name="حداکثر فاصله‌ی فروشگاه‌های همکار (کیلومتر)")
    # اشتراک‌گذاری دستی (ارسال پیشنهاد A به مشتریان B)
    coop_min_price = models.PositiveIntegerField(default=50, verbose_name="حداقل سهم فروشگاه همکار برای هر گیرنده (تومان)")
    coop_max_price = models.PositiveIntegerField(default=5000, verbose_name="حداکثر سهم فروشگاه همکار برای هر گیرنده (تومان)")
    # باشگاه پذیرندگان (۳۰ روز اخیر): امتیاز = مشتریان متمایز خریدکرده + ۲ × خریدهای تأییدشده با کد + ۵ × مشتری جذب/معرفی‌شده
    silver_min_score = models.PositiveIntegerField(default=30, verbose_name="امتیاز لازم سطح نقره‌ای")
    gold_min_score = models.PositiveIntegerField(default=100, verbose_name="امتیاز لازم سطح طلایی")
    diamond_min_score = models.PositiveIntegerField(default=300, verbose_name="امتیاز لازم سطح الماس")
    silver_commission_off = models.PositiveSmallIntegerField(default=2, verbose_name="کاهش کارمزد سطح نقره‌ای (واحد درصد)")
    gold_commission_off = models.PositiveSmallIntegerField(default=5, verbose_name="کاهش کارمزد سطح طلایی (واحد درصد)")
    diamond_commission_off = models.PositiveSmallIntegerField(default=8, verbose_name="کاهش کارمزد سطح الماس (واحد درصد)")
    min_withdraw = models.PositiveIntegerField(default=100000, verbose_name="حداقل مبلغ برداشت (تومان)")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات اشتراک‌گذاری و باشگاه پذیرندگان"
        verbose_name_plural = "تنظیمات اشتراک‌گذاری و باشگاه پذیرندگان"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ShareProfile(models.Model):
    """تنظیمات اشتراک‌گذاری هر فروشگاه"""
    business = models.OneToOneField('directory.Business', on_delete=models.CASCADE, related_name='share_profile')
    # نقش «معرف» (A): بعد از خرید از من، مشتری کوپن فروشگاه‌های همکار را می‌گیرد و من درآمد دارم
    send_enabled = models.BooleanField(default=False, verbose_name="مشتریانم را به فروشگاه‌های همکار معرفی کن")
    # نقش «پذیرنده» (B): مشتری جدید از فروشگاه‌های دیگر می‌پذیرم و برای هر مشتری خریدکرده هزینه می‌دهم
    receive_enabled = models.BooleanField(default=False, verbose_name="مشتری جدید از فروشگاه‌های همکار می‌پذیرم")
    discount_percent = models.PositiveSmallIntegerField(default=10, validators=[MinValueValidator(1), MaxValueValidator(70)],
                                                        verbose_name="درصد تخفیف کوپن برای مشتری جدید")
    max_discount = models.PositiveBigIntegerField(default=0, verbose_name="سقف تخفیف کوپن (تومان، ۰ = بدون سقف)")
    min_purchase = models.PositiveBigIntegerField(default=0, verbose_name="حداقل مبلغ خرید برای استفاده از کوپن")
    valid_days = models.PositiveSmallIntegerField(default=30, validators=[MinValueValidator(3), MaxValueValidator(180)],
                                                  verbose_name="مدت اعتبار کوپن (روز)")
    fee_per_customer = models.PositiveIntegerField(default=70000, verbose_name="هزینه‌ی هر مشتری جدید (تومان)")
    # اشتراک‌گذاری دستی
    coop_enabled = models.BooleanField(default=False, verbose_name="درخواست ارسال پیشنهاد فروشگاه‌های دیگر را می‌پذیرم")
    coop_price = models.PositiveIntegerField(default=300, verbose_name="سهم من برای هر گیرنده (تومان)")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات اشتراک‌گذاری فروشگاه"
        verbose_name_plural = "تنظیمات اشتراک‌گذاری فروشگاه‌ها"

    def __str__(self):
        return f"اشتراک‌گذاری {self.business}"


class ShareVoucher(models.Model):
    """کوپنی که بعد از خرید از فروشگاه A برای استفاده در فروشگاه همکار B به مشتری داده می‌شود"""

    class Status(models.TextChoices):
        ISSUED = 'ISSUED', 'فعال'
        USED = 'USED', 'استفاده‌شده'
        EXPIRED = 'EXPIRED', 'منقضی'
        CANCELLED = 'CANCELLED', 'لغو شد'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    origin = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='share_vouchers_out')
    target = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='share_vouchers_in')
    origin_purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='share_vouchers')
    phone = models.CharField(max_length=11, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='share_vouchers')
    # شرایط در لحظه‌ی صدور ثابت می‌شود
    discount_percent = models.PositiveSmallIntegerField()
    max_discount = models.PositiveBigIntegerField(default=0)
    min_purchase = models.PositiveBigIntegerField(default=0)
    fee = models.PositiveIntegerField(verbose_name="هزینه‌ی مشتری جدید")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ISSUED, db_index=True)
    valid_until = models.DateTimeField()
    used_purchase = models.OneToOneField(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='share_voucher_used')
    used_at = models.DateTimeField(null=True, blank=True)
    origin_income = models.PositiveIntegerField(default=0, verbose_name="درآمد فروشگاه معرف")
    commission = models.PositiveIntegerField(default=0, verbose_name="کارمزد سایت")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['target', 'phone', 'status']), models.Index(fields=['origin', 'created_at'])]
        constraints = [
            models.UniqueConstraint(fields=['target', 'phone'], condition=models.Q(status='ISSUED'),
                                    name='loyalty_one_active_share_voucher'),
        ]
        verbose_name = "کوپن همکاری"
        verbose_name_plural = "کوپن‌های همکاری"

    def __str__(self):
        return f"{self.code}: {self.origin} → {self.target}"


class MerchantStatus(models.Model):
    """سطح فروشگاه در باشگاه پذیرندگان (روزانه به‌روز می‌شود)"""

    class Level(models.TextChoices):
        BRONZE = 'BRONZE', 'برنزی'
        SILVER = 'SILVER', 'نقره‌ای'
        GOLD = 'GOLD', 'طلایی'
        DIAMOND = 'DIAMOND', 'الماس'

    business = models.OneToOneField('directory.Business', on_delete=models.CASCADE, related_name='merchant_status')
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.BRONZE)
    score = models.PositiveIntegerField(default=0)
    manual = models.BooleanField(default=False, verbose_name="سطح دستی (محاسبه‌ی خودکار تغییرش ندهد)")
    computed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "سطح فروشگاه"
        verbose_name_plural = "سطح فروشگاه‌ها"

    def __str__(self):
        return f"{self.business} - {self.get_level_display()}"

    @property
    def is_top(self):
        return self.level in (self.Level.GOLD, self.Level.DIAMOND)


class CoopShare(models.Model):
    """اشتراک‌گذاری دستی: فروشگاه A می‌خواهد پیشنهادش با پیامک به مشتریان فروشگاه B برسد (شماره‌ها هرگز به A داده نمی‌شود)"""

    class Status(models.TextChoices):
        PENDING_PARTNER = 'PENDING_PARTNER', 'در انتظار پذیرش فروشگاه همکار'
        PENDING_ADMIN = 'PENDING_ADMIN', 'در انتظار تأیید مدیریت'
        SENDING = 'SENDING', 'در حال ارسال'
        DONE = 'DONE', 'ارسال‌شده'
        PARTNER_REJECTED = 'PARTNER_REJECTED', 'رد توسط فروشگاه همکار'
        REJECTED = 'REJECTED', 'رد توسط مدیریت'
        CANCELLED = 'CANCELLED', 'لغو شد'

    requester = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='coop_requests_out')
    partner = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='coop_requests_in')
    title = models.CharField(max_length=120)
    text = models.TextField(verbose_name="متن پیشنهاد")
    final_text = models.TextField()
    parts = models.PositiveSmallIntegerField(default=1)
    recipients_count = models.PositiveIntegerField(default=0, verbose_name="تعداد گیرنده‌ی رزروشده")
    unit_sms_cost = models.PositiveIntegerField(default=0)
    partner_price = models.PositiveIntegerField(default=0, verbose_name="سهم فروشگاه همکار برای هر گیرنده")
    commission_percent = models.PositiveSmallIntegerField(default=0)
    cost = models.PositiveBigIntegerField(default=0, verbose_name="هزینه‌ی رزروشده از درخواست‌دهنده")
    income_used = models.PositiveBigIntegerField(default=0, help_text="بخشی از هزینه که از درآمد قابل برداشت کم شد")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PARTNER, db_index=True)
    partner_note = models.CharField(max_length=300, blank=True)
    admin_note = models.CharField(max_length=300, blank=True)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    partner_income = models.PositiveBigIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    partner_responded_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "اشتراک‌گذاری دستی"
        verbose_name_plural = "اشتراک‌گذاری‌های دستی"

    def __str__(self):
        return f"{self.requester} → {self.partner}: {self.title}"

    @property
    def unit_cost(self):
        return self.unit_sms_cost + self.partner_price


class WithdrawalRequest(models.Model):
    """برداشت درآمد کیف‌پول فروشنده به حساب بانکی (با تأیید و واریز دستی ادمین)"""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'در انتظار بررسی'
        PAID = 'PAID', 'واریز شد'
        REJECTED = 'REJECTED', 'رد شد'

    business = models.ForeignKey('directory.Business', on_delete=models.CASCADE, related_name='withdrawal_requests')
    amount = models.PositiveBigIntegerField(verbose_name="مبلغ (تومان)")
    sheba = models.CharField(max_length=26, verbose_name="شماره شبا")
    account_holder = models.CharField(max_length=120, verbose_name="نام صاحب حساب")
    note = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    admin_note = models.CharField(max_length=300, blank=True)
    bank_ref = models.CharField(max_length=60, blank=True, verbose_name="کد پیگیری واریز")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "درخواست برداشت درآمد"
        verbose_name_plural = "درخواست‌های برداشت درآمد"
