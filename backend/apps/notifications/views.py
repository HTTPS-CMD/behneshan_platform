from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Broadcast, Notification
from .serializers import BroadcastSerializer, NotificationSerializer

User = get_user_model()


class NotificationPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 50


class NotificationListView(generics.ListAPIView):
    """لیست اعلان‌های کاربر لاگین‌شده — ?unread=1 فقط نخوانده‌ها"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get('unread') in ('1', 'true'):
            qs = qs.filter(is_read=False)
        return qs


class UnreadCountView(APIView):
    """درخواست سبک برای زنگوله (هر ۳۰ ثانیه): تعداد نخوانده‌ها + آخرین اعلان نخوانده"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread = Notification.objects.filter(recipient=request.user, is_read=False)
        latest = unread.first()
        return Response({
            'unread': unread.count(),
            'latest': NotificationSerializer(latest).data if latest else None,
        })


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        updated = Notification.objects.filter(pk=pk, recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now())
        exists = updated or Notification.objects.filter(pk=pk, recipient=request.user).exists()
        if not exists:
            return Response({'error': 'اعلان یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'ok': True})


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now())
        return Response({'ok': True, 'updated': count})


class AdminBroadcastView(generics.ListCreateAPIView):
    """ادمین: تاریخچه و ارسال اعلان همگانی"""
    serializer_class = BroadcastSerializer
    permission_classes = [IsAdminUser]
    queryset = Broadcast.objects.select_related('sender').all()

    def perform_create(self, serializer):
        audience = serializer.validated_data.get('audience', Broadcast.Audience.ALL)
        users = User.objects.filter(is_active=True).exclude(Q(is_staff=True) | Q(role='ADMIN'))
        if audience == Broadcast.Audience.CLIENTS:
            users = users.filter(role='CLIENT')
        elif audience == Broadcast.Audience.OWNERS:
            users = users.filter(role='BUSINESS_OWNER')

        with transaction.atomic():
            broadcast = serializer.save(sender=self.request.user)
            d = serializer.validated_data
            rows = (
                Notification(recipient_id=uid, category=Notification.Category.BROADCAST,
                             title=d['title'], message=d.get('message', ''), link=d.get('link', ''),
                             broadcast=broadcast)
                for uid in users.values_list('pk', flat=True).iterator()
            )
            created = 0
            batch = []
            for row in rows:
                batch.append(row)
                if len(batch) >= 1000:
                    Notification.objects.bulk_create(batch)
                    created += len(batch)
                    batch = []
            if batch:
                Notification.objects.bulk_create(batch)
                created += len(batch)
            broadcast.recipients_count = created
            broadcast.save(update_fields=['recipients_count'])
