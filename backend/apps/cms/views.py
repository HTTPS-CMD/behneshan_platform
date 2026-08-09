from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import SiteSetting, Menu, Banner
from .serializers import MenuSerializer, BannerSerializer, SiteSettingSerializer
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

class CMSDataView(APIView):
    # این API عمومی است (نیاز به لاگین ندارد) تا سایت بتواند منوها و بنرها را به همه نشان دهد
    permission_classes = [] 

    def get(self, request):
        settings = SiteSetting.objects.all()
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