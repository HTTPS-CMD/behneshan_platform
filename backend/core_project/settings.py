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

# سامانه پیامکی (باشگاه مشتریان): console برای تست، یا kavenegar / smsir
SMS_PROVIDER = env('SMS_PROVIDER', default='console')
SMS_API_KEY = env('SMS_API_KEY', default='')
SMS_LINE_NUMBER = env('SMS_LINE_NUMBER', default='')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # باطل کردن refresh توکن‌ها هنگام خروج و چرخش (H6)
    'apps.identity', # ماژول جدید ما
    'apps.directory', # ماژول جدید ما
    'apps.taxonomy', # ماژول جدید ما
    'corsheaders',  # برای مدیریت CORS
    'apps.cms',  # ماژول CMS برای مدیریت تنظیمات سایت، منوها و بنرها
    'analytics',  # برای جمع‌آوری آمار بازدید و رفتار کاربران
    'apps.notifications',  # سیستم اعلان‌های پنل‌ها (زنگوله)
    'apps.loyalty',  # باشگاه مشتریان: کش‌بک، کیف‌پول، شعب و تراکنش‌ها
    'apps.seo',  # سئو: داده‌ی سایت‌مپ (و بعداً تنظیمات سئوی صفحات)
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
        'otp_request': '5/minute',   # درخواست کد پیامکی
        'otp_verify': '10/minute',   # بررسی کد پیامکی
        'token_refresh': '30/minute',  # تمدید نشست
    },
    # تعداد پروکسیِ مورد اعتماد جلوی جنگو؛ لوکال 0، روی سرور پشت Nginx باید 1 باشد
    'NUM_PROXIES': env.int('NUM_PROXIES', default=0),
}

SIMPLE_JWT = {
    # access کوتاه‌عمر است و فقط در حافظه‌ی مرورگر نگه داشته می‌شود؛ refresh در کوکی httpOnly می‌ماند (H6)
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # هر بار رفرش، refresh جدید ساخته و قبلی باطل می‌شود؛ refresh دزدیده‌شده بعد از اولین استفاده بی‌اثر است
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    # کلید امضا؛ باید با JWT_SIGNING_KEY در frontend/.env.local یکی باشد (proxy.ts امضا را بررسی می‌کند)
    'SIGNING_KEY': env('JWT_SIGNING_KEY', default=SECRET_KEY),
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

# پنل «سلامت و بکاپ»: پوشه‌هایی که agent.sh روی سرور می‌نویسد (داخل کانتینر mount می‌شوند)
OPS_DATA_DIR = env('OPS_DATA_DIR', default='/opsdata')
OPS_BACKUP_DIR = env('OPS_BACKUP_DIR', default='/backups')
