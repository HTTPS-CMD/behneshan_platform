"""
منطق سئو: متادیتای خودکار هر صفحه (باید با قوانین فرانت یکی باشد)، نمره‌ی سئو و تنظیمات کلی.
عنوان و توضیح خودکار در فرانت (business/[slug]/layout.tsx، category و location) هم ساخته می‌شوند؛
اگر قاعده‌ی آن‌ها عوض شد، همین‌جا هم باید عوض شود تا پیش‌نمایش و نمره دقیق بماند.
"""
import re

from django.conf import settings

from apps.cms.models import SiteSetting

SITE_NAME = 'چهارسوق'

# صفحه‌های ثابتی که از پنل قابل ویرایش‌اند؛ عنوان و توضیح پیش‌فرض همان مقادیر فعلی فرانت است
STATIC_PAGES = {
    '/': {
        'label': 'صفحه‌ی اصلی',
        'title': 'چهارسوق',
        'description': 'اولین پلتفرم جامع کسب‌وکارهای محلی',
    },
    '/daily-discounts': {
        'label': 'تخفیف‌های روزانه',
        'title': 'تخفیف‌های روزانه | چهارسوق',
        'description': 'تخفیف‌ها و فروش ویژه‌ی روزانه‌ی کسب‌وکارهای اصفهان را در چهارسوق ببینید و با کارت چهارسوق از آن‌ها استفاده کنید.',
    },
    '/about': {
        'label': 'درباره ما',
        'title': 'درباره چهارسوق | پلتفرم کسب‌وکارهای محلی اصفهان',
        'description': 'با چهارسوق، شبکه‌ی کاسبان اصفهان، آشنا شوید؛ ماموریت، داستان و راه‌های همکاری ما.',
    },
    '/contact': {
        'label': 'تماس با ما',
        'title': 'تماس با چهارسوق | ارتباط با شبکه کاسبان اصفهان',
        'description': 'برای ثبت‌نام کاسبان، خرید کارت چهارسوق، مشاوره‌ی تبلیغات و فروش یا ارسال پیشنهاد و انتقاد، با تیم چهارسوق در ارتباط باشید.',
    },
    '/terms/client': {
        'label': 'قوانین مشتریان',
        'title': 'قوانین و مقررات مشتریان | چهارسوق',
        'description': 'قوانین و شرایط استفاده از کارت، تخفیف‌ها و کش‌بک چهارسوق برای مشتریان.',
    },
    '/terms/business': {
        'label': 'قوانین کسب‌وکارها',
        'title': 'قوانین و مقررات کسب‌وکارها | چهارسوق',
        'description': 'شرایط عضویت، تعهدات و قوانین همکاری کاسبان با شبکه‌ی چهارسوق.',
    },
}

# کلیدهای تنظیمات کلی سئو (در همان جدول SiteSetting با پیشوند seo_)
GLOBAL_KEYS = [
    'seo_default_og_image',
    'seo_org_name',
    'seo_org_logo',
    'seo_org_phone',
    'seo_instagram',
    'seo_google_verification',
    'seo_bing_verification',
    'seo_robots_disallow',
]


def site_url() -> str:
    return getattr(settings, 'SEO_SITE_URL', 'https://4sogh.shop').rstrip('/')


def plain_text(value, max_len=160) -> str:
    t = re.sub(r'<[^>]*>', ' ', value or '')
    t = re.sub(r'\s+', ' ', t).strip()
    return t if len(t) <= max_len else t[:max_len - 1].strip() + '…'


# ---------- متادیتای خودکار ----------

def business_auto(b) -> dict:
    place = f' در {b.location.name}' if b.location_id else ''
    title = f'{b.name}{place} | {SITE_NAME}'
    cat = f'، {b.category.name}' if b.category_id else ''
    description = plain_text(b.description, 155) or (
        f'{b.name}{cat}{place}. آدرس، شماره تماس، تخفیف‌ها و نظرات مشتریان را در {SITE_NAME} ببینید.'
    )
    return {'title': title, 'description': description}


def category_auto(c) -> dict:
    return {
        'title': f'{c.name} در اصفهان | {SITE_NAME}',
        'description': f'فهرست {c.name} در اصفهان؛ آدرس، تماس، تخفیف و نظرات مشتریان کسب‌وکارهای عضو شبکه‌ی {SITE_NAME}.',
    }


def location_auto(loc) -> dict:
    return {
        'title': f'کسب‌وکارهای {loc.name} | {SITE_NAME}',
        'description': f'فهرست کسب‌وکارهای {loc.name} در شبکه‌ی {SITE_NAME}؛ آدرس، تماس، تخفیف و نظرات مشتریان.',
    }


# ---------- نمره‌ی سئو ----------

def _level_len(n, ok_range, warn_range):
    lo, hi = ok_range
    if lo <= n <= hi:
        return 'ok'
    wlo, whi = warn_range
    if wlo <= n <= whi:
        return 'warn'
    return 'bad'


def analyze(*, title, description, keyword='', noindex=False, has_image=False, extra=None) -> dict:
    """
    extra فقط برای کسب‌وکار پر می‌شود:
    {'description_len', 'has_address', 'has_phone', 'review_count'}
    خروجی: {score (۰ تا ۱۰۰ یا None برای noindex), status, checks[]}
    """
    checks = []

    def add(cid, level, message, weight):
        earned = {'ok': weight, 'warn': weight // 2, 'bad': 0}[level]
        checks.append({'id': cid, 'level': level, 'message': message, 'weight': weight, 'earned': earned})

    title = (title or '').strip()
    description = (description or '').strip()
    keyword = (keyword or '').strip()
    tn, dn = len(title), len(description)

    lvl = _level_len(tn, (30, 60), (15, 75))
    add('title', lvl, {
        'ok': f'طول عنوان مناسب است ({tn} نویسه).',
        'warn': f'طول عنوان بهینه نیست ({tn} نویسه)؛ بین ۳۰ تا ۶۰ نویسه بهتر است.',
        'bad': f'طول عنوان نامناسب است ({tn} نویسه)؛ بین ۳۰ تا ۶۰ نویسه بنویسید.',
    }[lvl], 20)

    lvl = _level_len(dn, (70, 160), (40, 200))
    add('description', lvl, {
        'ok': f'طول توضیح متا مناسب است ({dn} نویسه).',
        'warn': f'طول توضیح بهینه نیست ({dn} نویسه)؛ بین ۷۰ تا ۱۶۰ نویسه بهتر است.',
        'bad': f'طول توضیح نامناسب است ({dn} نویسه)؛ بین ۷۰ تا ۱۶۰ نویسه بنویسید.',
    }[lvl], 20)

    if keyword:
        add('keyword', 'ok', f'کلمه‌ی کلیدی تعیین شده است: «{keyword}».', 10)
        low = keyword.lower()
        add('keyword_title', 'ok' if low in title.lower() else 'bad',
            'کلمه‌ی کلیدی در عنوان آمده است.' if low in title.lower() else 'کلمه‌ی کلیدی در عنوان نیامده است.', 10)
        add('keyword_description', 'ok' if low in description.lower() else 'bad',
            'کلمه‌ی کلیدی در توضیح آمده است.' if low in description.lower() else 'کلمه‌ی کلیدی در توضیح نیامده است.', 10)
    else:
        add('keyword', 'bad', 'کلمه‌ی کلیدی اصلی تعیین نشده است.', 10)

    add('image', 'ok' if has_image else 'warn',
        'تصویر اشتراک‌گذاری دارد.' if has_image else 'تصویر اشتراک‌گذاری ندارد؛ یک تصویر مناسب اضافه کنید.', 10)

    if extra is not None:
        dl = extra.get('description_len', 0)
        lvl = 'ok' if dl >= 120 else 'warn' if dl >= 40 else 'bad'
        add('content', lvl, {
            'ok': f'توضیحات کسب‌وکار کافی است ({dl} نویسه).',
            'warn': f'توضیحات کسب‌وکار کوتاه است ({dl} نویسه)؛ حداقل ۱۲۰ نویسه بهتر است.',
            'bad': 'توضیحات کسب‌وکار تقریباً خالی است؛ متن بیشتر به رتبه کمک می‌کند.',
        }[lvl], 10)
        both = extra.get('has_address') and extra.get('has_phone')
        one = extra.get('has_address') or extra.get('has_phone')
        lvl = 'ok' if both else 'warn' if one else 'bad'
        add('contact', lvl, {
            'ok': 'آدرس و شماره تماس ثبت شده است.',
            'warn': 'فقط یکی از آدرس یا شماره تماس ثبت شده است.',
            'bad': 'آدرس و شماره تماس ثبت نشده است (برای سئوی محلی مهم است).',
        }[lvl], 10)
        has_reviews = extra.get('review_count', 0) > 0
        add('reviews', 'ok' if has_reviews else 'warn',
            'نظر مشتریان ثبت شده است.' if has_reviews else 'هنوز نظری ثبت نشده است.', 5)

    if noindex:
        return {
            'score': None, 'status': 'noindex',
            'checks': [{'id': 'noindex', 'level': 'warn', 'weight': 0, 'earned': 0,
                        'message': 'این صفحه noindex است و در گوگل نمایش داده نمی‌شود.'}] + checks,
        }

    total = sum(c['weight'] for c in checks)
    earned = sum(c['earned'] for c in checks)
    score = round(100 * earned / total) if total else 0
    status = 'good' if score >= 80 else 'warn' if score >= 50 else 'bad'
    return {'score': score, 'status': status, 'checks': checks}


# ---------- تنظیمات کلی (SiteSetting با پیشوند seo_) ----------

def read_global_settings() -> dict:
    stored = dict(SiteSetting.objects.filter(key__in=GLOBAL_KEYS).values_list('key', 'value'))
    return {k: stored.get(k, '') for k in GLOBAL_KEYS}


_META_CONTENT_RE = re.compile(r'content\s*=\s*["\']([^"\']+)["\']', re.I)
_CODE_RE = re.compile(r'^[A-Za-z0-9_\-]{10,120}$')
_URLISH_RE = re.compile(r'^(/|https?://)\S+$')
_PHONE_RE = re.compile(r'^[\d+\-\s()]{5,20}$')
_ROBOTS_PATH_RE = re.compile(r'^/[^\s]{1,99}$')


def clean_global_settings(data: dict):
    """مقادیر ورودی را اعتبارسنجی و تمیز می‌کند. خروجی: (cleaned, errors)"""
    cleaned, errors = {}, {}
    for key in GLOBAL_KEYS:
        if key not in data:
            continue
        v = str(data.get(key) or '').strip()

        if key in ('seo_default_og_image', 'seo_org_logo'):
            if v and not _URLISH_RE.match(v):
                errors[key] = 'آدرس تصویر باید با / یا https:// شروع شود.'
        elif key == 'seo_org_name':
            if len(v) > 100:
                errors[key] = 'نام سازمان حداکثر ۱۰۰ نویسه است.'
        elif key == 'seo_org_phone':
            if v and not _PHONE_RE.match(v):
                errors[key] = 'شماره تماس نامعتبر است.'
        elif key == 'seo_instagram':
            if v and not v.startswith('http'):
                v = 'https://instagram.com/' + v.strip('@/ ')
            if v and not _URLISH_RE.match(v):
                errors[key] = 'آدرس اینستاگرام نامعتبر است.'
        elif key in ('seo_google_verification', 'seo_bing_verification'):
            m = _META_CONTENT_RE.search(v)  # اگر کل تگ meta را چسبانده باشند، فقط مقدار content برداشته می‌شود
            if m:
                v = m.group(1).strip()
            if v and not _CODE_RE.match(v):
                errors[key] = 'کد تأیید نامعتبر است (فقط مقدار content را وارد کنید).'
        elif key == 'seo_robots_disallow':
            lines = [ln.strip() for ln in v.splitlines() if ln.strip()]
            bad = [ln for ln in lines if not _ROBOTS_PATH_RE.match(ln)]
            if len(lines) > 50:
                errors[key] = 'حداکثر ۵۰ مسیر مجاز است.'
            elif any(ln == '/' for ln in lines):
                errors[key] = 'بستن کل سایت (/) مجاز نیست؛ فقط مسیرهای مشخص را وارد کنید.'
            elif bad:
                errors[key] = f'هر خط باید یک مسیر با / در ابتدا باشد؛ نامعتبر: {bad[0]}'
            v = '\n'.join(lines)

        cleaned[key] = v
    return cleaned, errors
