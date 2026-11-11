from rest_framework import serializers
import re

from .models import ContactMessage, SiteSetting, Menu, Banner

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


_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    """ورودی فرم عمومی «تماس با ما»"""
    website = serializers.CharField(write_only=True, required=False, allow_blank=True)  # تله‌ی ضدربات (باید خالی بماند)

    class Meta:
        model = ContactMessage
        fields = ['name', 'phone', 'role', 'subject', 'message', 'website']
        extra_kwargs = {'role': {'required': False, 'allow_blank': True}, 'subject': {'required': False}}

    def validate_name(self, value):
        value = ' '.join(str(value).split())
        if len(value) < 2:
            raise serializers.ValidationError('نام و نام خانوادگی را وارد کنید.')
        return value

    def validate_phone(self, value):
        value = str(value).translate(_DIGITS).strip()
        if not re.fullmatch(r'09\d{9}', value):
            raise serializers.ValidationError('شماره موبایل معتبر نیست.')
        return value

    def validate_message(self, value):
        value = str(value).strip()
        if len(value) < 5:
            raise serializers.ValidationError('متن پیام خیلی کوتاه است.')
        if len(value) > 2000:
            raise serializers.ValidationError('متن پیام حداکثر ۲۰۰۰ کاراکتر باشد.')
        return value


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    """نمایش پیام در صندوق ادمین؛ فقط is_read قابل تغییر است"""
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    subject_label = serializers.CharField(source='get_subject_display', read_only=True)

    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'phone', 'role', 'role_label', 'subject', 'subject_label', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'name', 'phone', 'role', 'subject', 'message', 'created_at']
