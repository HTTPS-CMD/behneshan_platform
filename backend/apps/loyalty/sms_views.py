"""API سامانه پیامکی — بخش فروشنده (owner/sms/...) و بخش ادمین سایت (admin/sms/...)"""
import datetime

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.directory.models import Business

from .models import SmsCampaign, SmsChargeRequest, SmsLedger, SmsMessage, SmsSettings, SmsWallet
from .services import get_settings
from .sms import (
    SmsError, TEMPLATE_VARS, approve_campaign, approve_charge, campaign_quote, cancel_campaign, create_campaign,
    get_provider, get_wallet, reject_charge, render, sms_parts, wallet_change,
)
from .sms_serializers import (
    SmsCampaignSerializer, SmsChargeRequestSerializer, SmsLedgerSerializer, SmsMessageSerializer, SmsSettingsSerializer,
)
from .views import OwnerMixin, StandardPagination


def _err(exc):
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class IsPlatformAdmin(permissions.BasePermission):
    message = "این بخش فقط برای مدیر سایت است."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) == 'ADMIN'))


# ====================================================================== فروشنده
class OwnerSmsOverviewView(OwnerMixin, APIView):
    """موجودی، قیمت، اطلاعات کارت، تنظیمات پیامک خودکار و آمار ماه"""

    def get(self, request):
        cfg = SmsSettings.get()
        st = get_settings(self.business)
        month_ago = timezone.now() - datetime.timedelta(days=30)
        stats = SmsMessage.objects.filter(business=self.business, created_at__gte=month_ago).aggregate(
            sent=Count('id', filter=Q(status=SmsMessage.Status.SENT)),
            failed=Count('id', filter=Q(status=SmsMessage.Status.FAILED)),
            queued=Count('id', filter=Q(status__in=[SmsMessage.Status.QUEUED, SmsMessage.Status.SENDING])),
            # پیامک‌های همکاری را فروشگاه درخواست‌دهنده پرداخت کرده است
            cost=Sum('cost', filter=Q(status=SmsMessage.Status.SENT) & ~Q(kind=SmsMessage.Kind.COOP)),
        )
        return Response({
            "balance": get_wallet(self.business).balance,
            "withdrawable": get_wallet(self.business).withdrawable,
            "price_per_part": cfg.price_per_part,
            "require_approval": cfg.require_approval,
            "card_info": cfg.card_info,
            "opt_out_text": cfg.opt_out_text,
            "provider": get_provider().name,
            "template_vars": TEMPLATE_VARS,
            "auto": {
                "purchase_sms_enabled": st.purchase_sms_enabled,
                "purchase_sms_template": st.purchase_sms_template,
                "incentive_sms_enabled": st.incentive_sms_enabled,
            },
            "stats_30d": {k: v or 0 for k, v in stats.items()},
        })

    def put(self, request):
        """ذخیره‌ی تنظیمات پیامک‌های خودکار"""
        st = get_settings(self.business)
        data = request.data
        if 'purchase_sms_enabled' in data:
            st.purchase_sms_enabled = bool(data['purchase_sms_enabled'])
        if 'incentive_sms_enabled' in data:
            st.incentive_sms_enabled = bool(data['incentive_sms_enabled'])
        if 'purchase_sms_template' in data:
            tpl = (data.get('purchase_sms_template') or '').strip()
            if len(tpl) > 400:
                return _err("قالب پیامک حداکثر ۴۰۰ نویسه می‌تواند باشد.")
            st.purchase_sms_template = tpl
        st.save()
        return self.get(request)


class OwnerSmsPreviewView(OwnerMixin, APIView):
    """پیش‌نمایش ارسال انبوه: تعداد گیرنده، تعداد بخش، هزینه و متن نهایی"""

    def post(self, request):
        return Response(campaign_quote(self.business, request.data.get('text') or '', request.data.get('filters') or {}))


class OwnerSmsTemplatePreviewView(OwnerMixin, APIView):
    """پیش‌نمایش قالب پیامک خرید با داده‌ی نمونه"""

    def post(self, request):
        text = render(request.data.get('template') or '', **{
            'نام': 'علی محمدی', 'فروشگاه': self.business.name, 'مبلغ': '۲۵۰٬۰۰۰', 'کش_بک': '۱۲٬۵۰۰',
            'موجودی': '۴۰٬۰۰۰', 'هدیه': '۲۰٪ تخفیف', 'اعتبار_تا': '۱۴۰۵/۰۸/۱۵',
        })
        cfg = SmsSettings.get()
        parts = sms_parts(text)
        return Response({"text": text, "parts": parts, "cost": parts * cfg.price_per_part})


class OwnerSmsCampaignViewSet(OwnerMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = SmsCampaignSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ('create',):
            from apps.directory.crm import IsVerifiedBusinessOwner
            return [IsAuthenticated(), IsVerifiedBusinessOwner()]
        return super().get_permissions()

    def get_queryset(self):
        return SmsCampaign.objects.filter(business=self.business)

    def create(self, request, *args, **kwargs):
        try:
            campaign = create_campaign(self.business, request.data.get('title') or '', request.data.get('text') or '',
                                       request.data.get('filters') or {}, request.user)
        except SmsError as exc:
            return _err(exc)
        return Response(self.get_serializer(campaign).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        try:
            cancel_campaign(self.get_object())
        except SmsError as exc:
            return _err(exc)
        return Response({"ok": True})


class OwnerSmsMessageViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = SmsMessageSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = SmsMessage.objects.filter(business=self.business).select_related('customer', 'business')
        p = self.request.query_params
        if p.get('status') in SmsMessage.Status.values:
            qs = qs.filter(status=p['status'])
        if p.get('kind') in SmsMessage.Kind.values:
            qs = qs.filter(kind=p['kind'])
        if (p.get('campaign') or '').isdigit():
            qs = qs.filter(campaign_id=int(p['campaign']))
        if p.get('q'):
            qs = qs.filter(phone__contains=p['q'].strip())
        return qs


class OwnerSmsChargeViewSet(OwnerMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = SmsChargeRequestSerializer
    pagination_class = StandardPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return SmsChargeRequest.objects.filter(business=self.business).select_related('business')

    def perform_create(self, serializer):
        if SmsChargeRequest.objects.filter(business=self.business, status=SmsChargeRequest.Status.PENDING).count() >= 3:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "حداکثر ۳ درخواست شارژ در انتظار بررسی می‌توانید داشته باشید."})
        req = serializer.save(business=self.business, created_by=self.request.user)
        from .sms import _notify_admins, fa_num
        _notify_admins("درخواست شارژ پیامک", f"{self.business.name}: {fa_num(req.amount)} تومان")


class OwnerSmsLedgerViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = SmsLedgerSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        return SmsLedger.objects.filter(business=self.business)


# ====================================================================== ادمین سایت
class AdminSmsSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        cfg = SmsSettings.get()
        data = SmsSettingsSerializer(cfg).data
        data['provider'] = get_provider().name
        data['totals'] = {
            "wallets_balance": SmsWallet.objects.aggregate(s=Sum('balance'))['s'] or 0,
            "pending_charges": SmsChargeRequest.objects.filter(status=SmsChargeRequest.Status.PENDING).count(),
            "pending_campaigns": SmsCampaign.objects.filter(status=SmsCampaign.Status.PENDING).count(),
            "sent_30d": SmsMessage.objects.filter(status=SmsMessage.Status.SENT,
                                                  created_at__gte=timezone.now() - datetime.timedelta(days=30)).count(),
        }
        return Response(data)

    def put(self, request):
        ser = SmsSettingsSerializer(SmsSettings.get(), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return self.get(request)


class AdminSmsChargeViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = SmsChargeRequestSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = SmsChargeRequest.objects.select_related('business')
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st in SmsChargeRequest.Status.values else qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        try:
            approve_charge(self.get_object(), request.user, request.data.get('note') or '')
        except SmsError as exc:
            return _err(exc)
        return Response({"ok": True})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            reject_charge(self.get_object(), request.user, request.data.get('note') or '')
        except SmsError as exc:
            return _err(exc)
        return Response({"ok": True})


class AdminSmsCampaignViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = SmsCampaignSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = SmsCampaign.objects.select_related('business')
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st in SmsCampaign.Status.values else qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        try:
            approve_campaign(self.get_object(), request.user, request.data.get('note') or '')
        except SmsError as exc:
            return _err(exc)
        return Response({"ok": True})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            cancel_campaign(self.get_object(), by_admin=request.user, note=request.data.get('note') or '')
        except SmsError as exc:
            return _err(exc)
        return Response({"ok": True})


class AdminSmsMessageViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = SmsMessageSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = SmsMessage.objects.select_related('customer', 'business')
        p = self.request.query_params
        if p.get('status') in SmsMessage.Status.values:
            qs = qs.filter(status=p['status'])
        if p.get('kind') in SmsMessage.Kind.values:
            qs = qs.filter(kind=p['kind'])
        if p.get('q'):
            qs = qs.filter(Q(phone__contains=p['q'].strip()) | Q(business__name__icontains=p['q'].strip()))
        return qs


class AdminSmsWalletAdjustView(APIView):
    """اصلاح دستی موجودی کیف‌پول پیامک یک کسب‌وکار"""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def post(self, request):
        try:
            business = Business.objects.filter(pk=request.data.get('business')).first()
        except Exception:
            business = None
        try:
            amount = int(request.data.get('amount') or 0)
        except (TypeError, ValueError):
            amount = 0
        if not business or not amount:
            return _err("کسب‌وکار و مبلغ را مشخص کنید.")
        from django.db import transaction
        try:
            with transaction.atomic():
                wallet = wallet_change(business, amount, SmsLedger.Kind.ADJUST, (request.data.get('note') or 'اصلاح توسط ادمین'))
        except SmsError as exc:
            return _err(exc)
        return Response({"balance": wallet.balance})


class AdminSmsWalletListView(APIView):
    """موجودی کیف‌پول پیامک کسب‌وکارها (برای اصلاح دستی)"""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        qs = Business.objects.all()
        if q:
            qs = qs.filter(name__icontains=q)
        rows = []
        wallets = {w[0]: w[1:] for w in SmsWallet.objects.values_list('business_id', 'balance', 'withdrawable')}
        for b in qs.order_by('name')[:50]:
            bal, wd = wallets.get(b.pk, (0, 0))
            rows.append({"id": str(b.pk), "name": b.name, "balance": bal, "withdrawable": wd})
        return Response(rows)
