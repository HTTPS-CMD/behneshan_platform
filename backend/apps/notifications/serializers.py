from rest_framework import serializers

from .models import Broadcast, Notification
from .services import safe_link


class NotificationSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'category', 'category_display', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = fields


class BroadcastSerializer(serializers.ModelSerializer):
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Broadcast
        fields = ['id', 'audience', 'audience_display', 'title', 'message', 'link',
                  'recipients_count', 'sender_name', 'created_at']
        read_only_fields = ['id', 'recipients_count', 'sender_name', 'created_at']

    def get_sender_name(self, obj):
        return getattr(obj.sender, 'full_name', None) or 'مدیریت'

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError('عنوان خیلی کوتاه است.')
        return value

    def validate_link(self, value):
        if value and not safe_link(value):
            raise serializers.ValidationError('فقط لینک داخلی سایت مجاز است؛ مثلاً /daily-discounts')
        return safe_link(value)
