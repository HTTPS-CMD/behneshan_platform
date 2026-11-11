from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

User = get_user_model()


@receiver(post_save, sender=User)
def link_store_memberships(sender, instance, created, **kwargs):
    """کاربر تازه ثبت‌نام‌کرده به عضویت‌های قبلی‌اش در باشگاه فروشگاه‌ها وصل می‌شود."""
    if created and not kwargs.get('raw') and instance.phone_number:
        from .services import link_user_memberships
        link_user_memberships(instance)
