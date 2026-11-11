from django.urls import path

from .views import (
    AdminAnalyzeView, AdminPageDetailView, AdminPageListView, AdminSeoSettingsView,
    PublicSeoPageView, PublicSeoSettingsView, SitemapDataView,
)

urlpatterns = [
    path('sitemap/', SitemapDataView.as_view(), name='seo-sitemap'),
    path('public/settings/', PublicSeoSettingsView.as_view(), name='seo-public-settings'),
    path('public/page/', PublicSeoPageView.as_view(), name='seo-public-page'),
    path('admin/pages/', AdminPageListView.as_view(), name='seo-admin-pages'),
    path('admin/pages/detail/', AdminPageDetailView.as_view(), name='seo-admin-page-detail'),
    path('admin/analyze/', AdminAnalyzeView.as_view(), name='seo-admin-analyze'),
    path('admin/settings/', AdminSeoSettingsView.as_view(), name='seo-admin-settings'),
]
