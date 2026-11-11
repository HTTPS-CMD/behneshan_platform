"""
محتوای پیش‌فرض صفحه‌ی لندینگ (/landing) — همان متن‌های قبلی صفحه.
ادمین از پنل هر بخش را ویرایش می‌کند؛ هر کلیدی که ذخیره نشده باشد از اینجا خوانده می‌شود.
"""
import copy

DEFAULT_LANDING = {
    "hero": {
        "visible": True,
        "badge": "جشنواره تخفیفات پاییزی چهارسوق آغاز شد!",
        "title": "چهارسوق؛ نبض بازار در دستان شما",
        "subtitle": "چه به دنبال بیشترین تخفیف‌ها برای خریدهای روزانه خود باشید و چه بخواهید فروش کسب‌وکارتان را چند برابر کنید، چهارسوق پلتفرم شماست.",
        "primary_text": "مشاهده تخفیف‌های امروز",
        "primary_link": "/daily-discounts",
        "secondary_text": "ثبت فروشگاه جدید",
        "secondary_link": "/register",
    },
    "promo": {
        "visible": True,
        "title": "شکار تخفیف‌های طلایی!",
        "text": "روزانه ده‌ها محصول و خدمات با تخفیف‌های شگفت‌انگیز در چهارسوق قرار می‌گیرد. فرصت را از دست ندهید و کدهای تخفیف اختصاصی خود را دریافت کنید.",
        "button_text": "ورود به جشنواره",
        "button_link": "/daily-discounts",
    },
    "vip": {
        "visible": True,
        "card_title": "کلوپ مشتریان VIP",
        "card_text": "با تهیه اشتراک چهارسوق، بدون نیاز به گشتن دنبال کد تخفیف، از تمامی فروشگاه‌های طرف قرارداد ما درصد تخفیف ثابت و بی‌قید و شرط بگیرید.",
        "bullets": [
            "تخفیف ثابت روی تمام خریدها",
            "بازگشت وجه (Cashback) بخشی از مبلغ",
            "دسترسی زودهنگام به حراجی‌ها",
        ],
        "button_text": "خرید و ارتقا به VIP",
        "button_link": "/dashboard/client/vip",
        "side_title": "چرا باید کاربر ویژه چهارسوق باشیم؟",
        "side_text": "ما در چهارسوق سیستمی طراحی کرده‌ایم که هر خرید برای شما یک سرمایه‌گذاری باشد. مشتریان وفادار ما نه تنها هزینه کمتری می‌پردازند، بلکه از معرفی دوستان خود نیز سود نقدی دریافت می‌کنند.",
    },
    "business": {
        "visible": True,
        "title": "صاحب کسب‌وکار هستید؟",
        "text": "به شبکه بزرگ چهارسوق بپیوندید، مشتریان جدید پیدا کنید و فروش خود را هوشمندانه مدیریت کنید.",
        "features": [
            {"title": "افزایش چشمگیر فروش", "desc": "محصولات و خدمات شما در معرض دید هزاران مشتری آماده به خرید قرار می‌گیرد."},
            {"title": "پنل مدیریت اختصاصی", "desc": "گزارشات دقیق فروش، مدیریت کدهای تخفیف و بررسی رفتار مشتریان در یک نگاه."},
            {"title": "اجرای کمپین‌های هدفمند", "desc": "امکان ارسال پیامک تبلیغاتی و قرارگیری در جایگاه‌های ویژه (نردبان) برای دیده شدن بیشتر."},
        ],
        "button_text": "ثبت رایگان کسب‌وکار",
        "button_link": "/register",
    },
}

# حداکثر طول هر متن (برای جلوگیری از ذخیره‌ی متن‌های بی‌نهایت بلند)
MAX_TEXT = 600


def _merge(default, stored):
    """مقادیر ذخیره‌شده را روی پیش‌فرض‌ها می‌نشاند؛ فقط کلیدهای شناخته‌شده و با نوع درست پذیرفته می‌شوند"""
    if isinstance(default, dict):
        stored = stored if isinstance(stored, dict) else {}
        return {k: _merge(v, stored.get(k)) for k, v in default.items()}
    if isinstance(default, list):
        if not isinstance(stored, list):
            return copy.deepcopy(default)
        # لیست‌ها دقیقاً هم‌اندازه‌ی پیش‌فرض‌اند (۳ مزیت، ۳ ویژگی)
        return [_merge(d, stored[i] if i < len(stored) else None) for i, d in enumerate(default)]
    if isinstance(default, bool):
        return stored if isinstance(stored, bool) else default
    if isinstance(default, str):
        return stored.strip()[:MAX_TEXT] if isinstance(stored, str) else default
    return default


def build_landing(stored):
    return _merge(DEFAULT_LANDING, stored or {})


def is_internal_link(value):
    return isinstance(value, str) and value.startswith('/') and not value.startswith('//')


def link_errors(content):
    """لیست خطای لینک‌ها: فقط لینک داخلی سایت مجاز است"""
    errors = []
    for section, data in content.items():
        for key, value in data.items():
            if key.endswith('_link') and value and not is_internal_link(value):
                errors.append(f"{section}.{key}")
    return errors
