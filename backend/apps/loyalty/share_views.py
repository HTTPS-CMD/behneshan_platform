"""
API اشتراک‌گذاری مشتری (ShareClub)، کیف‌پول فروشنده، باشگاه پذیرندگان و اشتراک‌گذاری دستی.
  فروشنده: owner/share/... و owner/wallet/...
  ادمین:   admin/share/...
"""
import datetime

from django.core.exceptions import ValidationError

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.directory.crm import IsVerifiedBusinessOwner
from apps.directory.models import Business

from .models import (
    CoopShare, MerchantStatus, ShareProfile, ShareSettings, ShareVoucher, SmsLedger, SmsSettings, WithdrawalRequest,
)
from .share import (
    ShareError, admin_review_coop, cancel_coop, coop_partners, coop_quote, create_coop, create_withdrawal,
    get_profile, level_info, partner_respond, refresh_level, review_withdrawal,
)
from .share_serializers import (
    CoopShareSerializer, ShareProfileSerializer, ShareSettingsSerializer, VoucherInSerializer, VoucherOutSerializer,
    WithdrawalSerializer,
)
from .sms import get_wallet
from .sms_views import IsPlatformAdmin
from .views import OwnerMixin, StandardPagination


def _err(exc):
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def _business(pk):
    if not pk:
        return None
    try:
        return Business.objects.filter(pk=pk).first()
    except (ValueError, ValidationError):
        return None


def _int(v, default=0):
    try:
        return int(str(v).replace(',', ''))
    except (TypeError, ValueError):
        return default


# ====================================================================== فروشنده: ShareClub
class OwnerShareOverviewView(OwnerMixin, APIView):
    """تنظیمات اشتراک‌گذاری فروشگاه + سطح باشگاه پذیرندگان + آمار"""

    def get(self, request):
        b = self.business
        cfg = ShareSettings.get()
        profile = get_profile(b)
        out = ShareVoucher.objects.filter(origin=b).aggregate(
            issued=Count('id'), used=Count('id', filter=Q(status=ShareVoucher.Status.USED)),
            income=Sum('origin_income', filter=Q(status=ShareVoucher.Status.USED)))
        inc = ShareVoucher.objects.filter(target=b).aggregate(
            issued=Count('id'), active=Count('id', filter=Q(status=ShareVoucher.Status.ISSUED, valid_until__gte=timezone.now())),
            used=Count('id', filter=Q(status=ShareVoucher.Status.USED)),
            fees=Sum('fee', filter=Q(status=ShareVoucher.Status.USED)))
        coop_income = CoopShare.objects.filter(partner=b, status=CoopShare.Status.DONE).aggregate(s=Sum('partner_income'))['s']
        wallet = get_wallet(b)
        return Response({
            "enabled": cfg.enabled,
            "profile": ShareProfileSerializer(profile).data,
            "limits": {"min_fee": cfg.min_fee, "max_fee": cfg.max_fee, "default_fee": cfg.default_fee,
                       "coop_min_price": cfg.coop_min_price, "coop_max_price": cfg.coop_max_price,
                       "vouchers_per_purchase": cfg.vouchers_per_purchase, "max_distance_km": cfg.max_distance_km},
            "level": level_info(b),
            "has_location": bool((b.latitude is not None and b.longitude is not None) or b.location_id),
            "is_verified": b.is_verified,
            "wallet": {"balance": wallet.balance, "withdrawable": wallet.withdrawable},
            "stats": {
                "out_issued": out['issued'] or 0, "out_used": out['used'] or 0, "out_income": out['income'] or 0,
                "in_issued": inc['issued'] or 0, "in_active": inc['active'] or 0, "in_used": inc['used'] or 0,
                "in_fees": inc['fees'] or 0, "coop_income": coop_income or 0,
                "pending_coop_in": CoopShare.objects.filter(partner=b, status=CoopShare.Status.PENDING_PARTNER).count(),
            },
        })

    def put(self, request):
        profile = get_profile(self.business)
        ser = ShareProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return self.get(request)


class OwnerShareVoucherViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """?direction=out (پیش‌فرض): کوپن‌هایی که مشتریان من گرفته‌اند | ?direction=in: کوپن‌های فروشگاه من"""
    pagination_class = StandardPagination

    def _incoming(self):
        return self.request.query_params.get('direction') == 'in'

    def get_serializer_class(self):
        return VoucherInSerializer if self._incoming() else VoucherOutSerializer

    def get_queryset(self):
        if self._incoming():
            qs = ShareVoucher.objects.filter(target=self.business).select_related('origin', 'used_purchase__customer')
        else:
            qs = ShareVoucher.objects.filter(origin=self.business).select_related('target')
        st = self.request.query_params.get('status')
        if st in ShareVoucher.Status.values:
            qs = qs.filter(status=st)
        return qs


# ====================================================================== فروشنده: اشتراک‌گذاری دستی
class OwnerCoopPartnersView(OwnerMixin, APIView):
    def get(self, request):
        return Response(coop_partners(self.business, (request.query_params.get('q') or '').strip()[:60]))


def _partner_from(request, requester):
    b = _business(request.data.get('partner'))
    if not b or b.pk == requester.pk:
        raise ShareError("فروشگاه همکار را انتخاب کنید.")
    return b


class OwnerCoopQuoteView(OwnerMixin, APIView):
    def post(self, request):
        try:
            partner = _partner_from(request, self.business)
            return Response(coop_quote(self.business, partner, request.data.get('text') or '',
                                       _int(request.data.get('max_recipients'))))
        except ShareError as exc:
            return _err(exc)


class OwnerCoopViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """?direction=out (درخواست‌های من) | ?direction=in (درخواست‌هایی که برای مشتریان من آمده)"""
    serializer_class = CoopShareSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ('create', 'accept'):
            return [IsAuthenticated(), IsVerifiedBusinessOwner()]
        return super().get_permissions()

    def get_queryset(self):
        b = self.business
        if self.action in ('accept', 'reject'):
            return CoopShare.objects.filter(partner=b)
        if self.action == 'cancel':
            return CoopShare.objects.filter(requester=b)
        if self.request.query_params.get('direction') == 'in':
            # تا قبل از پذیرش، فقط درخواست‌های در انتظار و پاسخ‌داده‌شده نمایش داده می‌شود
            return CoopShare.objects.filter(partner=b).exclude(status=CoopShare.Status.CANCELLED).select_related('requester', 'partner')
        return CoopShare.objects.filter(requester=b).select_related('requester', 'partner')

    def create(self, request, *args, **kwargs):
        try:
            partner = _partner_from(request, self.business)
            coop = create_coop(self.business, partner, request.data.get('title') or '', request.data.get('text') or '',
                               _int(request.data.get('max_recipients')), request.user)
        except ShareError as exc:
            return _err(exc)
        return Response(CoopShareSerializer(coop).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        try:
            cancel_coop(self.get_object(), self.business)
        except ShareError as exc:
            return _err(exc)
        return Response({"ok": True})

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        try:
            coop = partner_respond(self.get_object(), self.business, True, request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(CoopShareSerializer(coop).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            coop = partner_respond(self.get_object(), self.business, False, request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(CoopShareSerializer(coop).data)


# ====================================================================== فروشنده: کیف‌پول و برداشت
class OwnerWalletView(OwnerMixin, APIView):
    """کیف‌پول فروشنده: موجودی، درآمد قابل برداشت و جمع درآمد/هزینه‌ها"""

    def get(self, request):
        b = self.business
        wallet = get_wallet(b)
        cfg, sms_cfg = ShareSettings.get(), SmsSettings.get()
        month_ago = timezone.now() - datetime.timedelta(days=30)
        sums = SmsLedger.objects.filter(business=b, created_at__gte=month_ago).values('kind').annotate(s=Sum('amount'))
        by_kind = {r['kind']: r['s'] or 0 for r in sums}
        income_30d = by_kind.get('SHARE_IN', 0) + by_kind.get('COOP_IN', 0)
        sms_30d = -(by_kind.get('SEND', 0) + by_kind.get('REFUND', 0) + by_kind.get('COOP_SEND', 0))
        return Response({
            "balance": wallet.balance, "withdrawable": wallet.withdrawable,
            "card_info": sms_cfg.card_info, "min_withdraw": cfg.min_withdraw,
            "income_30d": income_30d, "share_fees_30d": -by_kind.get('SHARE_FEE', 0), "sms_30d": max(0, sms_30d),
            "pending_withdrawal": WithdrawalRequest.objects.filter(business=b, status=WithdrawalRequest.Status.PENDING).exists(),
            "level": level_info(b),
        })


class OwnerWithdrawalViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = WithdrawalSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsVerifiedBusinessOwner()]
        return super().get_permissions()

    def get_queryset(self):
        return WithdrawalRequest.objects.filter(business=self.business).select_related('business')

    def create(self, request, *args, **kwargs):
        d = request.data
        try:
            req = create_withdrawal(self.business, _int(d.get('amount')), d.get('sheba'), d.get('account_holder'),
                                    d.get('note'), request.user)
        except ShareError as exc:
            return _err(exc)
        return Response(WithdrawalSerializer(req).data, status=status.HTTP_201_CREATED)


# ====================================================================== ادمین سایت
class AdminShareSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        return Response(ShareSettingsSerializer(ShareSettings.get()).data)

    def put(self, request):
        ser = ShareSettingsSerializer(ShareSettings.get(), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class AdminShareOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        v = ShareVoucher.objects.aggregate(
            issued=Count('id'), used=Count('id', filter=Q(status=ShareVoucher.Status.USED)),
            fees=Sum('fee', filter=Q(status=ShareVoucher.Status.USED)),
            commission=Sum('commission', filter=Q(status=ShareVoucher.Status.USED)))
        done = CoopShare.objects.filter(status=CoopShare.Status.DONE)
        coop_commission = sum(c.sent_count * c.partner_price - c.partner_income for c in done.only('sent_count', 'partner_price', 'partner_income'))
        levels = dict(MerchantStatus.objects.values('level').annotate(n=Count('id')).values_list('level', 'n'))
        return Response({
            "vouchers_issued": v['issued'] or 0, "vouchers_used": v['used'] or 0,
            "voucher_fees": v['fees'] or 0, "voucher_commission": v['commission'] or 0,
            "coop_done": done.count(), "coop_commission": coop_commission,
            "pending_withdrawals": WithdrawalRequest.objects.filter(status=WithdrawalRequest.Status.PENDING).count(),
            "pending_coops": CoopShare.objects.filter(status=CoopShare.Status.PENDING_ADMIN).count(),
            "levels": {k: levels.get(k, 0) for k in MerchantStatus.Level.values},
            "participants": {
                "send": ShareProfile.objects.filter(send_enabled=True).count(),
                "receive": ShareProfile.objects.filter(receive_enabled=True).count(),
                "coop": ShareProfile.objects.filter(coop_enabled=True).count(),
            },
        })


class AdminWithdrawalViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = WithdrawalSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = WithdrawalRequest.objects.select_related('business')
        st = self.request.query_params.get('status')
        if st in WithdrawalRequest.Status.values:
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        try:
            req = review_withdrawal(self.get_object(), request.user, True, request.data.get('bank_ref') or '',
                                    request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(WithdrawalSerializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            req = review_withdrawal(self.get_object(), request.user, False, '', request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(WithdrawalSerializer(req).data)


class AdminCoopViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = CoopShareSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = CoopShare.objects.select_related('requester', 'partner')
        st = self.request.query_params.get('status')
        if st in CoopShare.Status.values:
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        try:
            coop = admin_review_coop(self.get_object(), request.user, True, request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(CoopShareSerializer(coop).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            coop = admin_review_coop(self.get_object(), request.user, False, request.data.get('note') or '')
        except ShareError as exc:
            return _err(exc)
        return Response(CoopShareSerializer(coop).data)


class AdminMerchantLevelView(APIView):
    """فهرست سطح فروشگاه‌ها + تعیین دستی سطح"""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        qs = Business.objects.filter(is_verified=True)
        if q:
            qs = qs.filter(name__icontains=q)
        statuses = {s.business_id: s for s in MerchantStatus.objects.filter(business__in=qs)}
        rows = []
        for b in qs.order_by('name')[:60]:
            s = statuses.get(b.pk)
            rows.append({"id": str(b.pk), "name": b.name, "level": s.level if s else 'BRONZE',
                         "level_label": s.get_level_display() if s else 'برنزی', "score": s.score if s else 0,
                         "manual": s.manual if s else False})
        return Response(rows)

    def post(self, request):
        b = _business(request.data.get('business'))
        if not b:
            return _err("کسب‌وکار را انتخاب کنید.")
        st, _ = MerchantStatus.objects.get_or_create(business=b)
        manual = bool(request.data.get('manual'))
        level = request.data.get('level')
        if manual:
            if level not in MerchantStatus.Level.values:
                return _err("سطح نامعتبر است.")
            st.level, st.manual = level, True
            st.save(update_fields=['level', 'manual'])
        else:
            st.manual = False
            st.save(update_fields=['manual'])
            st = refresh_level(b, force=True)
        return Response({"level": st.level, "level_label": st.get_level_display(), "score": st.score, "manual": st.manual})
