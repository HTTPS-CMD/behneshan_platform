"""
ساخت توکن‌های JWT با claim نقش کاربر (role).
فرانت (proxy.ts) امضای refresh توکن را با JWT_SIGNING_KEY بررسی می‌کند و نقش را از همین claim می‌خواند،
پس نقش دیگر از یک کوکی قابل‌دستکاری خوانده نمی‌شود.
"""
from rest_framework_simplejwt.tokens import RefreshToken


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    role = getattr(user, 'role', 'CLIENT') or 'CLIENT'
    refresh['role'] = role  # access توکن ساخته‌شده از refresh هم این claim را دارد
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': role,
    }
