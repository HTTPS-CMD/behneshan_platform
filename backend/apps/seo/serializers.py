import re

from rest_framework import serializers

_URLISH = re.compile(r'^(/|https?://)\S+$')


class SeoPageWriteSerializer(serializers.Serializer):
    """ورودی ویرایش سئوی یک صفحه؛ فیلد خالی یعنی «خودکار»"""
    title = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    description = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')
    focus_keyword = serializers.CharField(max_length=120, allow_blank=True, required=False, default='')
    canonical = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')
    og_image = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')
    noindex = serializers.BooleanField(required=False, default=False)

    def _url_or_blank(self, value, message):
        if value and not _URLISH.match(value):
            raise serializers.ValidationError(message)
        return value

    def validate_canonical(self, value):
        return self._url_or_blank(value, 'آدرس باید با / یا https:// شروع شود و فاصله نداشته باشد.')

    def validate_og_image(self, value):
        return self._url_or_blank(value, 'آدرس تصویر باید با / یا https:// شروع شود و فاصله نداشته باشد.')
