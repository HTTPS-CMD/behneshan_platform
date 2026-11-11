import uuid

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.directory.crm import IsVerifiedBusinessOwner, check_purchase_code, normalize_phone
from apps.directory.utils import get_owner_business

from . import excel
from .jalali import parse_date_param
from .incentives import run_daily_once, run_incentives
from .share import issue_vouchers
from .sms import send_purchase_sms
from .models import Branch, CustomerLabel, CustomerReward, IncentivePlan, Purchase, SalesLine, StoreCustomer
from .serializers import (
    BranchSerializer, ClientWalletSerializer, CustomerLabelSerializer, CustomerRewardSerializer,
    IncentivePlanSerializer, LoyaltySettingsSerializer,
    PurchaseSerializer, SalesLineSerializer, StoreCustomerSerializer, WalletEntrySerializer,
    verified_customer_payload,
)
from .services import (
    LoyaltyError, claim_verification, create_verification, current_balance, expire_due_credit,
    get_or_create_customer, get_settings, gift_credit, link_user_memberships, peek_verification,
    preview_purchase, record_purchase,
)

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class IsOwnerWithBusiness(permissions.BasePermission):
    message = "این بخش فقط برای صاحبان کسب‌وکار است. ابتدا کسب‌وکار خود را ثبت کنید."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, 'role', None) == 'BUSINESS_OWNER'
            and get_owner_business(user)
        )


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class OwnerMixin:
    permission_classes = [IsAuthenticated, IsOwnerWithBusiness]

    @property
    def business(self):
        if not hasattr(self, '_business'):
            self._business = get_owner_business(self.request.user)
        return self._business

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['business'] = self.business
        return ctx


def _error(exc):
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------------------------------------------ تنظیمات
class LoyaltySettingsView(OwnerMixin, APIView):
    def get(self, request):
        return Response(LoyaltySettingsSerializer(get_settings(self.business)).data)

    def put(self, request):
        obj = get_settings(self.business)
        ser = LoyaltySettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    patch = put


# ------------------------------------------------------------------ شعب و بخش‌ها
class BranchViewSet(OwnerMixin, viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    pagination_class = None

    def get_queryset(self):
        return Branch.objects.filter(business=self.business).prefetch_related('lines')

    def perform_create(self, serializer):
        serializer.save(business=self.business)


class SalesLineViewSet(OwnerMixin, viewsets.ModelViewSet):
    serializer_class = SalesLineSerializer
    pagination_class = None

    def get_queryset(self):
        qs = SalesLine.objects.filter(branch__business=self.business).select_related('branch')
        branch = self.request.query_params.get('branch')
        return qs.filter(branch_id=branch) if branch else qs


# ------------------------------------------------------------------ برچسب‌ها
class CustomerLabelViewSet(OwnerMixin, viewsets.ModelViewSet):
    serializer_class = CustomerLabelSerializer
    pagination_class = None

    def get_queryset(self):
        return CustomerLabel.objects.filter(business=self.business).annotate(customers_count=Count('customers'))

    def perform_create(self, serializer):
        serializer.save(business=self.business)


# ------------------------------------------------------------------ مشتریان
class StoreCustomerViewSet(OwnerMixin, viewsets.ModelViewSet):
    serializer_class = StoreCustomerSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = StoreCustomer.objects.filter(business=self.business).prefetch_related('labels')
        p = self.request.query_params
        q = (p.get('q') or '').strip()
        if q:
            cond = Q(full_name__icontains=q) | Q(phone_number__contains=q.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')))
            if q.isdigit():
                cond |= Q(membership_no=int(q))
            qs = qs.filter(cond)
        if (p.get('label') or '').isdigit():
            qs = qs.filter(labels__id=int(p['label']))
        if p.get('marital_status') in ('SINGLE', 'MARRIED'):
            qs = qs.filter(marital_status=p['marital_status'])
        if (p.get('birth_month') or '').isdigit():
            qs = qs.filter(birth_month=int(p['birth_month']))
        if p.get('has_credit') == '1':
            qs = qs.filter(credit_balance__gt=0)
        if p.get('has_account') in ('0', '1'):
            qs = qs.filter(user__isnull=p['has_account'] == '0')
        if p.get('segment'):
            from .segments import apply_segment
            qs = apply_segment(qs, p['segment'], self.business)
        ordering = {
            'newest': '-created_at', 'credit': '-credit_balance', 'purchases': '-total_purchase_amount',
            'recent': '-last_purchase_at', 'membership': 'membership_no',
        }.get(p.get('ordering'), '-created_at')
        return qs.order_by(ordering).distinct()

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        labels = data.pop('labels', None)
        phone = data.pop('phone_number')
        try:
            customer, _ = get_or_create_customer(self.business, phone, data.pop('full_name', ''), StoreCustomer.Source.MANUAL)
        except LoyaltyError as exc:
            return _error(exc)
        for key, value in data.items():
            setattr(customer, key, value)
        customer.save()
        if labels is not None:
            customer.labels.set(labels)
        return Response(self.get_serializer(customer).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        if customer.purchase_count or customer.credit_balance:
            return Response({"error": "مشتری‌ای که خرید یا اعتبار دارد قابل حذف نیست."}, status=status.HTTP_400_BAD_REQUEST)
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        customer = self.get_object()
        balance = current_balance(customer)
        purchases = customer.purchases.select_related('branch', 'line')[:50]
        entries = customer.wallet_entries.all()[:100]
        rewards = customer.rewards.all()[:50]
        from .segments import segment_of
        return Response({
            "credit_balance": balance,
            "segment": segment_of(self.business, customer.pk),
            "purchases": PurchaseSerializer(purchases, many=True).data,
            "wallet": WalletEntrySerializer(entries, many=True).data,
            "rewards": CustomerRewardSerializer(rewards, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='gift-credit',
            permission_classes=[IsAuthenticated, IsVerifiedBusinessOwner])
    def gift_credit(self, request, pk=None):
        customer = self.get_object()
        try:
            amount = int(request.data.get('amount') or 0)
        except (TypeError, ValueError):
            amount = 0
        try:
            customer = gift_credit(customer, amount, (request.data.get('note') or '')[:300], request.user)
        except LoyaltyError as exc:
            return _error(exc)
        return Response({"credit_balance": customer.credit_balance})


# ------------------------------------------------------------------ تأیید مشتری با کد خرید
class VerifyStoreCustomerView(OwnerMixin, APIView):
    """
    کد خرید ۶ رقمی (از پنل مشتری یا پیامک) را بررسی می‌کند. بعد از تأیید، فروشنده تا ۱۰ دقیقه
    می‌تواند برای این مشتری یک خرید با تخفیف VIP/کمپین و خرج اعتبار ثبت کند.
    """
    permission_classes = [IsAuthenticated, IsVerifiedBusinessOwner]

    def post(self, request):
        phone, error = check_purchase_code(request.user, request.data.get('phone_number'), request.data.get('purchase_code'))
        if error:
            return error
        try:
            customer, _ = get_or_create_customer(self.business, phone)
        except LoyaltyError as exc:
            return _error(exc)
        balance = current_balance(customer)
        customer.credit_balance = balance
        token = create_verification(customer)
        payload = verified_customer_payload(customer, token)
        # تخفیف‌های مشتری در این فروشگاه (فقط برای نمایش)
        calc = preview_purchase(self.business, customer, 100, None, 0, verified=True)
        payload['discount_percent'] = calc['discount_percent']
        payload['discount_source'] = calc['discount_source']
        return Response(payload)


# ------------------------------------------------------------------ تراکنش‌ها
class PurchaseViewSet(OwnerMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = PurchaseSerializer
    pagination_class = StandardPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ('create', 'import_file', 'preview'):
            return [IsAuthenticated(), IsVerifiedBusinessOwner()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Purchase.objects.filter(business=self.business).select_related('customer', 'branch', 'line')
        p = self.request.query_params
        d_from, d_to = parse_date_param(p.get('date_from')), parse_date_param(p.get('date_to'))
        if d_from:
            qs = qs.filter(purchased_at__date__gte=d_from)
        if d_to:
            qs = qs.filter(purchased_at__date__lte=d_to)
        for key in ('branch', 'line'):
            if (p.get(key) or '').isdigit():
                qs = qs.filter(**{f'{key}_id': int(p[key])})
        if p.get('payment_method') in Purchase.PaymentMethod.values:
            qs = qs.filter(payment_method=p['payment_method'])
        if p.get('customer'):
            try:
                qs = qs.filter(customer_id=uuid.UUID(str(p['customer'])))
            except ValueError:
                return qs.none()
        if p.get('credit') == 'used':
            qs = qs.filter(credit_used__gt=0)
        q = (p.get('q') or '').strip()
        if q:
            q_digits = q.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789'))
            qs = qs.filter(Q(customer__full_name__icontains=q) | Q(customer__phone_number__contains=q_digits))
        return qs

    def list(self, request, *args, **kwargs):
        run_daily_once(self.business)  # صدور هدیه‌های تولد/سالگرد/فراموشی امروز (روزی یک بار)
        qs = self.filter_queryset(self.get_queryset())
        totals = qs.aggregate(
            count=Count('id'), original=Sum('original_amount'), final=Sum('final_amount'),
            discount=Sum('discount_amount'), credit_used=Sum('credit_used'), cashback=Sum('cashback_amount'),
        )
        page = self.paginate_queryset(qs)
        response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        response.data['totals'] = {k: v or 0 for k, v in totals.items()}
        return response

    # ---- ورودی مشترک ثبت و پیش‌نمایش
    def _resolve_input(self, request):
        data = request.data
        token = data.get('verification_token')
        verified = False
        if token:
            customer = peek_verification(token, self.business)
            if not customer:
                raise LoyaltyError("تأیید مشتری منقضی شده است. دوباره کد خرید را از مشتری بگیرید.")
            verified = True
        else:
            phone = normalize_phone(data.get('phone_number'))
            if not phone:
                raise LoyaltyError("شماره موبایل مشتری معتبر نیست.")
            existing = StoreCustomer.objects.filter(business=self.business, phone_number=phone).first()
            customer = existing or StoreCustomer(business=self.business, phone_number=phone, credit_balance=0)

        try:
            amount = int(str(data.get('amount') or '0').replace(',', ''))
            use_credit = int(str(data.get('use_credit') or '0').replace(',', ''))
        except ValueError:
            raise LoyaltyError("مبلغ نامعتبر است.")
        if amount <= 0:
            raise LoyaltyError("مبلغ فاکتور باید بیشتر از صفر باشد.")
        if use_credit < 0:
            raise LoyaltyError("مبلغ اعتبار نامعتبر است.")

        branch = line = None
        if data.get('line'):
            line = SalesLine.objects.filter(
                pk=data['line'], branch__business=self.business, is_active=True, branch__is_active=True,
            ).select_related('branch').first() if str(data['line']).isdigit() else None
            if not line:
                raise LoyaltyError("بخش فروش نامعتبر است.")
            branch = line.branch
        elif data.get('branch'):
            branch = Branch.objects.filter(
                pk=data['branch'], business=self.business, is_active=True,
            ).first() if str(data['branch']).isdigit() else None
            if not branch:
                raise LoyaltyError("شعبه نامعتبر است.")

        payment = data.get('payment_method') or Purchase.PaymentMethod.CASH
        if payment not in Purchase.PaymentMethod.values:
            raise LoyaltyError("روش پرداخت نامعتبر است.")
        return customer, verified, token, amount, use_credit, branch, line, payment

    @action(detail=False, methods=['post'])
    def preview(self, request):
        try:
            customer, verified, _, amount, use_credit, _, line, _ = self._resolve_input(request)
        except LoyaltyError as exc:
            return _error(exc)
        calc = preview_purchase(self.business, customer, amount, line, use_credit, verified)
        for k in ('campaign_id', 'first_plan_id', 'reward_id', 'share_voucher_id'):
            calc.pop(k, None)
        calc['credit_balance'] = customer.credit_balance
        return Response(calc)

    def create(self, request, *args, **kwargs):
        try:
            customer, verified, token, amount, use_credit, branch, line, payment = self._resolve_input(request)
        except LoyaltyError as exc:
            return _error(exc)
        # توکن تأیید قبل از ثبت «برداشته» می‌شود تا دو درخواست هم‌زمان نتوانند با یک تأیید دو خرید ثبت کنند
        if token and not claim_verification(token):
            return _error(LoyaltyError("تأیید مشتری منقضی شده است. دوباره کد خرید را از مشتری بگیرید."))
        try:
            if not verified:
                # مشتری با شماره پیدا یا ساخته می‌شود (فقط کش‌بک، بدون خرج اعتبار)
                customer, _ = get_or_create_customer(
                    self.business, customer.phone_number, (request.data.get('customer_name') or '').strip(),
                )
            purchase = record_purchase(
                business=self.business, customer=customer, amount=amount, branch=branch, line=line,
                payment_method=payment, use_credit=use_credit, verified=verified, created_by=request.user,
                note=(request.data.get('note') or '').strip(),
                gift_reward_ids=request.data.get('gift_reward_ids') or None,
            )
        except LoyaltyError as exc:
            if token:
                create_verification(customer, token)  # خطای فرم؛ تأیید برای تلاش دوباره برمی‌گردد
            return _error(exc)
        purchase.customer.refresh_from_db()
        send_purchase_sms(purchase)  # پیامک خودکار بعد از خرید (اگر فعال و موجودی کافی باشد)
        vouchers = issue_vouchers(purchase)  # کوپن فروشگاه‌های همکار برای مشتری (ShareClub)
        data = self.get_serializer(purchase).data
        data['customer_credit_balance'] = purchase.customer.credit_balance
        data['share_vouchers_issued'] = len(vouchers)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def export(self, request):
        try:
            content = excel.export_purchases(self.filter_queryset(self.get_queryset()))
        except RuntimeError as exc:
            return _error(exc)
        resp = HttpResponse(content, content_type=XLSX)
        resp['Content-Disposition'] = 'attachment; filename="transactions.xlsx"'
        return resp

    @action(detail=False, methods=['get'], url_path='import-template')
    def import_template(self, request):
        try:
            content = excel.import_template()
        except RuntimeError as exc:
            return _error(exc)
        resp = HttpResponse(content, content_type=XLSX)
        resp['Content-Disposition'] = 'attachment; filename="transactions-template.xlsx"'
        return resp

    @action(detail=False, methods=['post'], url_path='import')
    def import_file(self, request):
        f = request.FILES.get('file')
        if not f:
            return Response({"error": "فایل اکسل را انتخاب کنید."}, status=status.HTTP_400_BAD_REQUEST)
        if f.size > 5 * 1024 * 1024 or not f.name.lower().endswith('.xlsx'):
            return Response({"error": "فقط فایل xlsx تا ۵ مگابایت پذیرفته می‌شود."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows, errors = excel.parse_import(f, self.business)
        except RuntimeError as exc:
            return _error(exc)
        if errors:
            return Response({"error": "فایل خطا دارد و هیچ ردیفی ثبت نشد.", "row_errors": errors[:200]},
                            status=status.HTTP_400_BAD_REQUEST)
        total_cashback = 0
        try:
            with transaction.atomic():  # یا همه ردیف‌ها ثبت می‌شوند یا هیچ‌کدام
                for row in rows:
                    customer, _ = get_or_create_customer(self.business, row['phone'], row['name'], StoreCustomer.Source.IMPORT)
                    purchase = record_purchase(
                        business=self.business, customer=customer, amount=row['amount'], branch=row['branch'],
                        line=row['line'], payment_method=row['payment_method'], created_by=request.user,
                        source=Purchase.Source.IMPORT, note=row['note'], purchased_at=row['purchased_at'],
                        apply_incentives=False,  # خریدهای قدیمی اکسل طرح تشویقی نمی‌گیرند
                    )
                    total_cashback += purchase.cashback_amount
        except LoyaltyError as exc:
            return _error(exc)
        return Response({"imported": len(rows), "total_cashback": total_cashback}, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------ سمت مشتری
class ClientWalletsView(APIView):
    """اعتبار مشتری در فروشگاه‌های مختلف"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        link_user_memberships(request.user)
        memberships = StoreCustomer.objects.filter(user=request.user).select_related('business')
        for m in memberships:
            run_daily_once(m.business)
            with transaction.atomic():
                locked = StoreCustomer.objects.select_for_update().get(pk=m.pk)
                expire_due_credit(locked)
        memberships = (StoreCustomer.objects.filter(user=request.user)
                       .select_related('business').order_by('-credit_balance', '-last_purchase_at'))
        data = ClientWalletSerializer(memberships, many=True, context={'request': request}).data
        # کوپن‌های فروشگاه‌های همکار (ShareClub) که با شماره‌ی این کاربر صادر شده‌اند
        vouchers = []
        phone = getattr(request.user, 'phone_number', None)
        if phone:
            from .models import ShareVoucher
            from .share_serializers import ClientVoucherSerializer
            qs = (ShareVoucher.objects.filter(phone=phone, status=ShareVoucher.Status.ISSUED, valid_until__gte=timezone.now())
                  .select_related('target', 'origin').order_by('valid_until'))
            vouchers = ClientVoucherSerializer(qs, many=True, context={'request': request}).data
        return Response({
            "total_credit": sum(m['credit_balance'] for m in data),
            "wallets": data,
            "share_vouchers": vouchers,
        })


# ------------------------------------------------------------------ طرح‌های تشویقی
class IncentivePlanViewSet(OwnerMixin, viewsets.ModelViewSet):
    serializer_class = IncentivePlanSerializer
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        return (IncentivePlan.objects.filter(business=self.business)
                .annotate(
                    used_count=Count('rewards', filter=Q(rewards__status=CustomerReward.Status.USED)),
                    active_count=Count('rewards', filter=Q(rewards__status=CustomerReward.Status.ACTIVE)
                                       & (Q(rewards__valid_until__isnull=True) | Q(rewards__valid_until__gt=now))),
                ))

    def list(self, request, *args, **kwargs):
        run_daily_once(self.business)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(business=self.business)

    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        if plan.rewards.exists():
            # طرحی که هدیه داده فقط غیرفعال می‌شود تا با ساخت طرح مشابه، هدیه‌ی تکراری صادر نشود
            plan.is_active = False
            plan.save(update_fields=['is_active', 'updated_at'])
            return Response({"deactivated": True}, status=status.HTTP_200_OK)
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def run(self, request):
        """اجرای فوری طرح‌های تولد، سالگرد و فراموشی"""
        result = run_incentives(self.business)
        return Response({"issued": result, "total": sum(result.values())})


class CustomerRewardViewSet(OwnerMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = CustomerRewardSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = CustomerReward.objects.filter(customer__business=self.business).select_related('customer')
        p = self.request.query_params
        if p.get('kind') in IncentivePlan.Kind.values:
            qs = qs.filter(kind=p['kind'])
        if (p.get('plan') or '').isdigit():
            qs = qs.filter(plan_id=int(p['plan']))
        status_q = p.get('status')
        now = timezone.now()
        if status_q == 'active':
            qs = qs.filter(status=CustomerReward.Status.ACTIVE).filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        elif status_q == 'used':
            qs = qs.filter(status=CustomerReward.Status.USED)
        elif status_q == 'expired':
            qs = qs.filter(status=CustomerReward.Status.ACTIVE, valid_until__lte=now)
        return qs

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reward = self.get_object()
        n = CustomerReward.objects.filter(pk=reward.pk, status=CustomerReward.Status.ACTIVE).update(
            status=CustomerReward.Status.CANCELLED)
        if not n:
            return Response({"error": "فقط هدیه‌ی فعال قابل لغو است."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": CustomerReward.Status.CANCELLED})



# ------------------------------------------------------------------ دیتای هوشمند
class InsightsView(OwnerMixin, APIView):
    """بخش‌بندی RFM، شاخص‌های رفتار خرید، زمان‌های پرفروش و مشتریان برتر"""

    def get(self, request):
        from .segments import insights
        return Response(insights(self.business))


class SegmentListView(OwnerMixin, APIView):
    """فهرست بخش‌ها با تعداد (برای انتخاب مخاطب پیامک و فیلتر مشتریان)"""

    def get(self, request):
        from .segments import SEGMENTS, compute
        data = compute(self.business)
        counts = {}
        for v in data.values():
            counts[v[3]] = counts.get(v[3], 0) + 1
        return Response([{"key": k, "label": label, "count": counts.get(k, 0)} for k, label, *_ in SEGMENTS])
