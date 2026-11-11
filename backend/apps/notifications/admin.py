from django.contrib import admin

from .models import Broadcast, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'recipient', 'category', 'is_read', 'created_at')
    list_filter = ('category', 'is_read', 'created_at')
    search_fields = ('title', 'recipient__phone_number', 'recipient__full_name')
    raw_id_fields = ('recipient', 'broadcast')


@admin.register(Broadcast)
class BroadcastAdmin(admin.ModelAdmin):
    list_display = ('title', 'audience', 'recipients_count', 'sender', 'created_at')
    readonly_fields = ('recipients_count', 'sender', 'created_at')
