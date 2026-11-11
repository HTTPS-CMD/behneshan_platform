"""
آمار واقعی داشبورد صاحب کسب‌وکار.

- بازدید: از جدول PageView (اپ analytics) که با هر بار باز شدن صفحه‌ی /business/<slug> ثبت می‌شود.
- تعامل: مجموع نظرها، دریافت کد تخفیف و خریدهای ثبت‌شده (هر سه تاریخ دارند).
- آمار همه‌ی کسب‌وکارهای صاحب حساب با هم جمع می‌شود.
"""
from datetime import timedelta
from urllib.parse import quote

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from analytics.models import PageView

from .models import Business, CampaignUsage, Review, TransactionLog

ALLOWED_PERIODS = (7, 30, 90)


def _business_paths(businesses):
    paths = set()
    for slug in businesses.values_list('slug', flat=True):
        paths.add(f"/business/{slug}")
        paths.add(f"/business/{quote(slug, safe='')}")  # slug فارسی به‌صورت encode‌شده هم ثبت می‌شود
    return paths


def _daily_counts(qs, field):
    """{date: count} برای یک کوئری‌ست بر اساس فیلد تاریخ"""
    return {
        row['day']: row['n']
        for row in qs.annotate(day=TruncDate(field)).values('day').annotate(n=Count('id')).order_by()
    }


def _change(current, previous):
    """درصد تغییر نسبت به دوره‌ی قبل (None اگر دوره‌ی قبل صفر بوده)"""
    if not previous:
        return None
    return round((current - previous) * 100 / previous, 1)


def owner_analytics(user, days=30):
    days = days if days in ALLOWED_PERIODS else 30
    now = timezone.now()
    today = timezone.localdate()
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    businesses = Business.objects.filter(owner=user)
    biz_ids = list(businesses.values_list('id', flat=True))
    paths = _business_paths(businesses)

    views_qs = PageView.objects.filter(url__in=paths) if paths else PageView.objects.none()
    reviews_qs = Review.objects.filter(business_id__in=biz_ids)
    claims_qs = CampaignUsage.objects.filter(campaign__business_id__in=biz_ids)
    tx_qs = TransactionLog.objects.filter(business_id__in=biz_ids)

    def in_period(qs, field, a, b=None):
        q = Q(**{f"{field}__gte": a})
        if b is not None:
            q &= Q(**{f"{field}__lt": b})
        return qs.filter(q)

    views_now = in_period(views_qs, 'timestamp', start).count()
    views_prev = in_period(views_qs, 'timestamp', prev_start, start).count()
    eng_now = (in_period(reviews_qs, 'created_at', start).count()
               + in_period(claims_qs, 'claimed_at', start).count()
               + in_period(tx_qs, 'created_at', start).count())
    eng_prev = (in_period(reviews_qs, 'created_at', prev_start, start).count()
                + in_period(claims_qs, 'claimed_at', prev_start, start).count()
                + in_period(tx_qs, 'created_at', prev_start, start).count())

    # ---- نمودار روزانه (برای ۹۰ روز هفتگی) ----
    daily_views = _daily_counts(in_period(views_qs, 'timestamp', start), 'timestamp')
    daily_eng = {}
    for qs, field in ((reviews_qs, 'created_at'), (claims_qs, 'claimed_at'), (tx_qs, 'created_at')):
        for day, n in _daily_counts(in_period(qs, field, start), field).items():
            daily_eng[day] = daily_eng.get(day, 0) + n

    bucket = 7 if days == 90 else 1
    series = []
    first_day = today - timedelta(days=days - 1)
    for i in range(0, days, bucket):
        d0 = first_day + timedelta(days=i)
        span = [d0 + timedelta(days=k) for k in range(bucket) if d0 + timedelta(days=k) <= today]
        series.append({
            'date': d0.isoformat(),
            'views': sum(daily_views.get(d, 0) for d in span),
            'engagement': sum(daily_eng.get(d, 0) for d in span),
        })

    tx_period = in_period(tx_qs, 'created_at', start)
    rating = reviews_qs.aggregate(avg=Avg('rating'))['avg']
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        'period_days': days,
        'businesses_count': len(biz_ids),
        # کارت‌ها
        'total_views': views_qs.count(),
        'views_period': views_now,
        'views_change': _change(views_now, views_prev),
        'total_engagements': eng_now,
        'engagements_change': _change(eng_now, eng_prev),
        'campaign_uses': claims_qs.count(),
        'campaign_redeemed': claims_qs.filter(is_redeemed=True).count(),
        'average_rating': round(rating, 1) if rating else 0,
        'review_count': reviews_qs.count(),
        'followers_count': Business.followers.through.objects.filter(business_id__in=biz_ids).count(),
        # فروش (قبلاً endpoint جدای owner/sales-summary بود)
        'transactions_period': tx_period.count(),
        'sales_today': in_period(tx_qs, 'created_at', today_start).aggregate(s=Sum('final_amount'))['s'] or 0,
        'sales_period': tx_period.aggregate(s=Sum('final_amount'))['s'] or 0,
        # نمودار
        'series': series,
    }
