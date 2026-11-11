import json
import logging
import re
import threading

from django.core.cache import cache
from rest_framework import mixins, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.directory.serializers import IMAGE_EXTS, MAX_IMAGE_MB, validate_upload

from .landing import build_landing, link_errors
from .models import Banner, ContactMessage, LandingPage, Menu, SiteSetting
from .serializers import (
    BannerSerializer, ContactMessageAdminSerializer, ContactMessageCreateSerializer, MenuSerializer, SiteSettingSerializer,
)

logger = logging.getLogger(__name__)

class CMSDataView(APIView):
    # این API عمومی است (نیاز به لاگین ندارد) تا سایت بتواند منوها و بنرها را به همه نشان دهد
    permission_classes = [] 

    def get(self, request):
        # کلیدهایی که با private_ شروع می‌شوند (مثل شماره‌ی مدیر) هرگز در API عمومی نمایش داده نمی‌شوند
        settings = SiteSetting.objects.exclude(key__startswith='private_')
        menus = Menu.objects.filter(is_active=True)
        banners = Banner.objects.filter(is_active=True)

        # تبدیل تنظیمات به یک دیکشنری ساده برای استفاده راحت‌تر در فرانت‌اند
        settings_dict = {item.key: item.value for item in settings}

        return Response({
            "settings": settings_dict,
            "menus": MenuSerializer(menus, many=True).data,
            "banners": BannerSerializer(banners, many=True).data,
        })
        
        
class AdminSiteSettingViewSet(viewsets.ModelViewSet):
    queryset = SiteSetting.objects.all()
    serializer_class = SiteSettingSerializer
    permission_classes = [IsAdminUser] # فقط ادمین‌ها دسترسی دارند

class AdminMenuViewSet(viewsets.ModelViewSet):
    queryset = Menu.objects.all()
    serializer_class = MenuSerializer
    permission_classes = [IsAdminUser]

class AdminBannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.all()
    serializer_class = BannerSerializer
    permission_classes = [IsAdminUser]


# ------------------------------------------------------------------
# صفحه‌ی لندینگ
# ------------------------------------------------------------------


def _landing_payload(page):
    return {
        "content": build_landing(page.content),
        # مسیر نسبی (/media/...)؛ فرانت آدرس کامل را با NEXT_PUBLIC_MEDIA_URL می‌سازد
        "hero_image": page.hero_image.url if page.hero_image else None,
        "updated_at": page.updated_at,
    }


class PublicLandingView(APIView):
    """محتوای عمومی صفحه‌ی لندینگ"""
    permission_classes = []

    def get(self, request):
        return Response(_landing_payload(LandingPage.load()))


class AdminLandingView(APIView):
    """ادمین: خواندن و ویرایش لندینگ — content به‌صورت JSON و hero_image به‌صورت فایل"""
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(_landing_payload(LandingPage.load()))

    def put(self, request):
        page = LandingPage.load()
        raw = request.data.get('content')
        if raw is not None:
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except ValueError:
                    return Response({"error": "فرمت محتوا نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)
            content = build_landing(raw)
            bad = link_errors(content)
            if bad:
                return Response({"error": "فقط لینک داخلی سایت مجاز است (با / شروع شود).", "fields": bad},
                                status=status.HTTP_400_BAD_REQUEST)
            page.content = content

        image = request.FILES.get('hero_image')
        if image:
            try:
                validate_upload(image, IMAGE_EXTS, MAX_IMAGE_MB)
            except Exception as exc:  # ValidationError سریالایزر
                detail = getattr(exc, 'detail', None)
                return Response({"error": detail[0] if isinstance(detail, list) else "تصویر نامعتبر است."},
                                status=status.HTTP_400_BAD_REQUEST)
            if page.hero_image:
                page.hero_image.delete(save=False)
            page.hero_image = image
        elif str(request.data.get('remove_hero_image', '')).lower() in ('1', 'true'):
            if page.hero_image:
                page.hero_image.delete(save=False)
            page.hero_image = None

        page.save()
        return Response(_landing_payload(page))


# ------------------------------------------------------------------
# فرم «تماس با ما»
# ------------------------------------------------------------------
class ContactThrottle(AnonRateThrottle):
    scope = 'contact'
    rate = '5/hour'  # هر IP حداکثر ۵ پیام در ساعت


def _admin_sms_phone():
    """شماره‌ی دریافت پیامک اعلان؛ از تنظیم private_contact_notify_phone (عمومی نمی‌شود) (قابل ویرایش در پنل). خالی = بدون پیامک"""
    row = SiteSetting.objects.filter(key='private_contact_notify_phone').first()
    phone = str(row.value if row else '').translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')).strip()
    return phone if re.fullmatch(r'09\d{9}', phone) else ''


def _notify_new_contact(msg):
    """اعلان داخل سایت + پیامک به مدیر. هیچ‌وقت ثبت پیام را خراب نمی‌کند"""
    try:
        from apps.notifications.services import notify_admins
        notify_admins('SYSTEM', 'پیام جدید از فرم تماس', f"{msg.name} — {msg.get_subject_display()}", '/admin-panel/messages')
    except Exception:
        logger.exception("contact: in-app notification failed")

    try:
        phone = _admin_sms_phone()
        if not phone:
            return
        # سقف ۱۰ پیامک در ساعت برای کل سایت (جلوگیری از مصرف شارژ با اسپم)
        if not cache.add('contact_sms_hour', 1, timeout=3600):
            try:
                if cache.incr('contact_sms_hour') > 10:
                    return
            except ValueError:
                cache.set('contact_sms_hour', 1, timeout=3600)
        text = f"پیام جدید در فرم تماس چهارسوق\n{msg.name} - {msg.get_subject_display()}"

        def _send():
            try:
                from apps.loyalty.sms import get_provider
                ok, _mid, err = get_provider().send(phone, text)
                if not ok:
                    logger.error("contact: admin sms failed: %s", err)
            except Exception:
                logger.exception("contact: admin sms failed")

        threading.Thread(target=_send, daemon=True).start()
    except Exception:
        logger.exception("contact: sms notification failed")


class ContactCreateView(APIView):
    """ثبت پیام از فرم عمومی تماس با ما (بدون لاگین)"""
    permission_classes = [AllowAny]
    authentication_classes = []  # توکن منقضی کاربر نباید مانع ارسال فرم شود
    throttle_classes = [ContactThrottle]

    def post(self, request):
        # تله‌ی ضدربات: ربات‌ها فیلد مخفی را پر می‌کنند؛ ظاهراً موفق جواب می‌دهیم ولی چیزی ذخیره نمی‌شود
        if request.data.get('website'):
            return Response({"ok": True}, status=status.HTTP_201_CREATED)

        serializer = ContactMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop('website', None)

        # هر شماره در ۶۰ ثانیه فقط یک پیام (جلوگیری از دوبار کلیک و ارسال پشت‌سرهم)
        if not cache.add(f"contact_cooldown_{data['phone']}", 1, timeout=60):
            return Response({"error": "پیام شما قبلاً ثبت شده است. لطفاً کمی بعد دوباره تلاش کنید."},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)

        msg = ContactMessage.objects.create(**data)
        _notify_new_contact(msg)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class AdminContactMessageViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                                 viewsets.GenericViewSet):
    """صندوق پیام‌های تماس (ادمین): فقط خواندن و علامت خوانده‌شده؛ حذف ندارد"""
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageAdminSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        flag = self.request.query_params.get('is_read')
        if flag in ('true', 'false'):
            qs = qs.filter(is_read=(flag == 'true'))
        return qs

    def list(self, request, *args, **kwargs):
        rows = self.get_queryset()[:200]
        return Response({
            "results": ContactMessageAdminSerializer(rows, many=True).data,
            "count": ContactMessage.objects.count(),
            "unread": ContactMessage.objects.filter(is_read=False).count(),
        })
