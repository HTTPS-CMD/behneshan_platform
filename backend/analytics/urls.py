from django.urls import path
from .views import RecordPageViewAPIView, AnalyticsDashboardAPIView

urlpatterns = [
    path('record-view/', RecordPageViewAPIView.as_view(), name='record-page-view'),
    path('dashboard-stats/', AnalyticsDashboardAPIView.as_view(), name='dashboard-stats'),
]