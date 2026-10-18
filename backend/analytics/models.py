from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class UserLoginLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_logs', verbose_name='کاربر')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user_agent = models.CharField(max_length=255, null=True, blank=True, verbose_name='مرورگر/دستگاه')
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='زمان ورود')

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'لاگ ورود'
        verbose_name_plural = 'لاگ‌های ورود'

    def __str__(self):
        return f"{self.user.phone_number} - {self.ip_address}"


class PageView(models.Model):
    url = models.CharField(max_length=255, verbose_name='آدرس صفحه')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='کاربر (در صورت لاگین)')
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='زمان بازدید')

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'بازدید صفحه'
        verbose_name_plural = 'بازدیدهای صفحات'

    def __str__(self):
        return f"{self.url} - {self.ip_address}"