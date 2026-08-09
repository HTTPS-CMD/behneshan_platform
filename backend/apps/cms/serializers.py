from rest_framework import serializers
from .models import SiteSetting, Menu, Banner

class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ['id','key', 'value', 'description']

class MenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = Menu
        fields = ['id','title', 'url', 'icon', 'position', 'order', 'is_active']

class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ['id','title', 'image', 'url', 'position', 'order']