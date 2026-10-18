import os
from pathlib import Path
from datetime import timedelta
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# ==========================================
# خواندن تنظیمات حساس از فایل backend/.env
# ==========================================
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# کلید سرویس api.ir (شاهکار و پیامک)
API_IR_KEY = env('API_IR_KEY')
# رمز پاکسازی کش فرانت (باید با REVALIDATION_SECRET در frontend/.env.local یکی باشد)
REVALIDATION_SECRET = env('REVALIDATION_SECRET')
FRONTEND_REVALIDATE_URL = env('FRONTEND_REVALIDATE_URL', default='http://localhost:3000/api/revalidate')

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
    'analytics',  # برای جمع‌آوری آمار بازدید و رفتار کاربران
]

# معرفی مدل کاربر اختصاصی به جنگو
AUTH_USER_MODEL = 'identity.User'

# تنظیمات اتصال به دیتابیس PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='behneshan_db'),
        'USER': env('DB_USER', default='behneshan_user'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='127.0.0.1'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

# کش (برای OTP و محدودیت درخواست‌ها) روی Redis
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://127.0.0.1:6379/1'),
    }
}

# تنظیمات فریم‌ورک API و امنیت JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # محدودیت کلی تعداد درخواست
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/minute',
        'user': '300/minute',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_COOKIE': 'access_token',
    'AUTH_HEADER_TYPES': ('Bearer',),
}


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
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=CORS_ALLOWED_ORIGINS)

# اگر Nginx جلوی جنگو است، IP و پروتکل واقعی را از هدرها بخوان
USE_X_FORWARDED_HOST = env.bool('USE_X_FORWARDED_HOST', default=False)

# محدودیت حجم آپلود (۲۰ مگابایت)
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# این گزینه اجازه می‌دهد کوکی‌های امنیتی (مثل توکن لاگین) بین فرانت و بک رد و بدل شوند
CORS_ALLOW_CREDENTIALS = True


# تنظیمات زبان و زمان
LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

# مسیر فایل‌های استاتیک (مثل CSS های پنل ادمین)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
# Media files (Uploads)
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')