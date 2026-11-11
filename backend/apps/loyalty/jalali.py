"""
تبدیل تاریخ شمسی و میلادی بدون وابستگی خارجی.
تاریخ‌ها همه‌جا به‌صورت میلادی در دیتابیس ذخیره می‌شوند؛ این فایل فقط برای ورودی/خروجی است.
"""
import datetime
import re

from django.utils import timezone

FA_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def gregorian_to_jalali(gy, gm, gd):
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]
    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return jy, jm, jd


def jalali_to_gregorian(jy, jm, jd):
    jy += 1595
    days = -355668 + (365 * jy) + ((jy // 33) * 8) + (((jy % 33) + 3) // 4) + jd
    days += (jm - 1) * 31 if jm < 7 else ((jm - 7) * 30) + 186
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    leap = (gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0
    month_days = [0, 31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    while gm < 13 and gd > month_days[gm]:
        gd -= month_days[gm]
        gm += 1
    return gy, gm, gd


def jalali_month_length(jy, jm):
    if jm <= 6:
        return 31
    if jm <= 11:
        return 30
    # اسفند: کبیسه اگر ۱ فروردین سال بعد ۳۰ اسفند را لازم داشته باشد
    g = jalali_to_gregorian(jy + 1, 1, 1)
    last = datetime.date(*g) - datetime.timedelta(days=1)
    return gregorian_to_jalali(last.year, last.month, last.day)[2]


def parse_jalali(value):
    """'1403/05/12' یا '۱۴۰۳-۰۵-۱۲' -> (1403, 5, 12) یا None"""
    if not value:
        return None
    text = str(value).strip().translate(FA_DIGITS)
    m = re.fullmatch(r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})', text)
    if not m:
        return None
    jy, jm, jd = (int(x) for x in m.groups())
    if not (1300 <= jy <= 1500 and 1 <= jm <= 12 and 1 <= jd <= jalali_month_length(jy, jm)):
        return None
    return jy, jm, jd


def jalali_to_date(value):
    parts = parse_jalali(value)
    if not parts:
        return None
    return datetime.date(*jalali_to_gregorian(*parts))


def parse_date_param(value):
    """تاریخ فیلتر: شمسی (1403/05/12) یا میلادی (2024-08-02)"""
    if not value:
        return None
    d = jalali_to_date(value)
    if d:
        return d
    try:
        return datetime.date.fromisoformat(str(value).strip())
    except ValueError:
        return None


def to_jalali_str(value):
    if not value:
        return ''
    if isinstance(value, datetime.datetime):
        value = timezone.localtime(value) if timezone.is_aware(value) else value
        value = value.date()
    jy, jm, jd = gregorian_to_jalali(value.year, value.month, value.day)
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def today_jalali():
    t = timezone.localdate()
    return gregorian_to_jalali(t.year, t.month, t.day)
