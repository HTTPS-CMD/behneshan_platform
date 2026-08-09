from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """
    بررسی می‌کند که آیا کاربر درخواست‌دهنده، مالک (Owner) آبجکت است یا خیر.
    """
    def has_object_permission(self, request, view, obj):
        # فرض بر این است که مدل دارای فیلد owner می‌باشد
        return obj.owner == request.user

class IsSuperAdminRole(permissions.BasePermission):
    """
    دسترسی فقط برای مدیران کل سایت.
    """
    message = "شما دسترسی لازم برای مشاهده این بخش را به عنوان مدیر کل ندارید."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role in ['BUSINESS_OWNER', 'ADMIN', 'superadmin']
        )

class IsBusinessOwnerRole(permissions.BasePermission):
    """
    دسترسی فقط برای صاحبان کسب‌وکار.
    """
    message = "این بخش فقط برای صاحبان کسب‌وکار در دسترس است."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role == 'BUSINESS_OWNER'
        )

class IsClientRole(permissions.BasePermission):
    """
    دسترسی برای مشتریان عادی پلتفرم.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role == 'CLIENT'
        )