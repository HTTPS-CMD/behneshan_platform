from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from ipware import get_client_ip
from .models import UserLoginLog

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    if request:
        # دریافت IP واقعی کاربر (حتی از پشت Nginx/Cloudflare)
        ip, is_routable = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]
        
        # ثبت در دیتابیس
        UserLoginLog.objects.create(
            user=user,
            ip_address=ip,
            user_agent=user_agent
        )