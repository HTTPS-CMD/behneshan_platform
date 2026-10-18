from django.apps import AppConfig

class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics' # نام اپلیکیشن شما

    def ready(self):
        import analytics.signals # فراخوانی سیگنال‌ها