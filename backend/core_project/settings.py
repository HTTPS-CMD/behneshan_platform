import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-your-secret-key-here'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'apps.identity', # ماژول جدید ما
    'apps.directory', # ماژول جدید ما
    'apps.taxonomy', # ماژول جدید ما
    'corsheaders',  # برای مدیریت CORS
    'apps.cms',  # ماژول CMS برای مدیریت تنظیمات سایت، منوها و بنرها
]

# معرفی مدل کاربر اختصاصی به جنگو
AUTH_USER_MODEL = 'identity.User'

# تنظیمات اتصال به دیتابیس PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'behneshan_db',
        'USER': 'behneshan_user',
        'PASSWORD': '@12345Bb',
        'HOST': '127.0.0.1',
        'PORT': '5432',
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}

# تنظیمات فریم‌ورک API و امنیت JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'AUTH_COOKIE': 'access_token',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# بقیه کدهای پایین فایل (MIDDLEWARE, TEMPLATES و...) را تغییر ندهید.

# ==========================================
# تنظیمات پیش‌فرض جنگو که پاک شده بودند
# ==========================================

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # اضافه شده برای CORS
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core_project.wsgi.application'


# ==========================================
# تنظیمات CORS
# ==========================================
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# این گزینه اجازه می‌دهد کوکی‌های امنیتی (مثل توکن لاگین) بین فرانت و بک رد و بدل شوند
CORS_ALLOW_CREDENTIALS = True


# تنظیمات زبان و زمان
LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

# مسیر فایل‌های استاتیک (مثل CSS های پنل ادمین)
STATIC_URL = 'static/'
# Media files (Uploads)
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')