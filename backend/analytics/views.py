from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, AllowAny
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta
from ipware import get_client_ip
from .models import PageView, UserLoginLog

User = get_user_model()

# 1. API ثبت بازدید (برای استفاده عمومی توسط Next.js)
class RecordPageViewAPIView(APIView):
    permission_classes = [AllowAny] # همه می‌توانند بازدید ثبت کنند

    def post(self, request):
        url = request.data.get('url')
        if not url:
            return Response({"error": "آدرس صفحه الزامی است."}, status=400)
            
        ip, _ = get_client_ip(request)
        
        PageView.objects.create(
            url=url,
            ip_address=ip,
            user=request.user if request.user.is_authenticated else None
        )
        return Response({"status": "بازدید ثبت شد."}, status=201)

# 2. API دریافت آمار برای داشبورد (فقط برای ادمین)
class AnalyticsDashboardAPIView(APIView):
    permission_classes = [IsAdminUser] # فقط ادمین‌های سایت

    def get(self, request):
        today = timezone.now().date()
        thirty_days_ago = timezone.now() - timedelta(days=30)

        # آمار کاربران
        total_users = User.objects.count()
        new_users_30d = User.objects.filter(created_at__gte=thirty_days_ago).count()

        # آمار بازدیدها
        total_views = PageView.objects.count()
        today_views = PageView.objects.filter(timestamp__date=today).count()
        
        # 5 صفحه پربازدید سایت
        top_pages = PageView.objects.values('url').annotate(
            views=Count('id')
        ).order_by('-views')[:5]

        # 10 لاگین اخیر سایت با IP
        recent_logins = UserLoginLog.objects.select_related('user').order_by('-timestamp')[:10]
        recent_logins_data = [
            {
                "username": getattr(log.user, 'full_name', None) or getattr(log.user, 'phone_number', 'کاربر'),
                "ip_address": log.ip_address or "نامشخص",
                "timestamp": log.timestamp,
                "user_agent": log.user_agent or "نامشخص"
            } for log in recent_logins
        ]

        return Response({
            "users": {
                "total": total_users,
                "new_last_30_days": new_users_30d
            },
            "page_views": {
                "total": total_views,
                "today": today_views,
                "top_pages": list(top_pages)
            },
            "recent_logins": recent_logins_data
        })