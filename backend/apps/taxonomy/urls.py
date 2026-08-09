from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminLocationViewSet, CategoryListView, LocationListView, AdminCategoryViewSet

router = DefaultRouter()
router.register(r'admin/categories', AdminCategoryViewSet, basename='admin-category')
router.register(r'admin/locations', AdminLocationViewSet, basename='admin-location')

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('locations/', LocationListView.as_view(), name='location-list'),
    path('', include(router.urls)),
]