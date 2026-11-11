from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'
    verbose_name = 'اعلان‌ها'

    def ready(self):
        # ثبت سیگنال‌هایی که اعلان‌ها را خودکار می‌سازند
        from . import signals  # noqa: F401
