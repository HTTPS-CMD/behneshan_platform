from django.urls import path

from .views import AdminBroadcastView, MarkAllReadView, MarkReadView, NotificationListView, UnreadCountView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('read-all/', MarkAllReadView.as_view(), name='notification-read-all'),
    path('<int:pk>/read/', MarkReadView.as_view(), name='notification-read'),
    path('admin/broadcasts/', AdminBroadcastView.as_view(), name='notification-admin-broadcasts'),
]
