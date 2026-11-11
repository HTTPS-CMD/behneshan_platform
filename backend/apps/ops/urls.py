from django.urls import path

from .views import BackupDownloadView, BackupListView, BackupRunView, HealthView, LogsView

urlpatterns = [
    path('health/', HealthView.as_view(), name='ops-health'),
    path('backups/', BackupListView.as_view(), name='ops-backups'),
    path('backups/run/', BackupRunView.as_view(), name='ops-backup-run'),
    path('backups/<str:name>/download/', BackupDownloadView.as_view(), name='ops-backup-download'),
    path('logs/', LogsView.as_view(), name='ops-logs'),
]
