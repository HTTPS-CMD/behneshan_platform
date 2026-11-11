from django.apps import AppConfig


class LoyaltyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.loyalty'
    verbose_name = 'باشگاه مشتریان'

    def ready(self):
        from . import signals  # noqa: F401
