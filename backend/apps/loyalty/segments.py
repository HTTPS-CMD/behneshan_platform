"""
دیتای هوشمند: بخش‌بندی مشتریان هر فروشگاه با مدل RFM
  R (Recency)  : چند روز از آخرین خرید گذشته
  F (Frequency): تعداد خرید
  M (Monetary) : جمع مبلغ خرید (نسبت به بقیه‌ی مشتریان همین فروشگاه)
هر شاخص امتیاز ۱ تا ۵ می‌گیرد و مشتری در یکی از گروه‌های زیر قرار می‌گیرد.
فقط داده‌های مشتریان خود فروشگاه استفاده می‌شود.
"""
import bisect
import datetime

from django.core.cache import cache
from django.db.models import Count, Sum
from django.db.models.functions import ExtractHour, ExtractWeekDay
from django.utils import timezone

from .models import Purchase, StoreCustomer

CACHE_SECONDS = 600

SEGMENTS = [
    # key, label, color, description, suggested action
    ('champions', 'مشتریان طلایی', 'saffron',
     'اخیراً، زیاد و با مبلغ بالا خرید کرده‌اند.',
     'از آن‌ها قدردانی کنید (اعتبار هدیه یا پیشنهاد ویژه) و بخواهید شما را به دوستانشان معرفی کنند.'),
    ('loyal', 'مشتریان وفادار', 'brand',
     'به‌طور منظم از شما خرید می‌کنند.',
     'با کش‌بک بیشتر در بخش‌های پرفروش و اطلاع‌رسانی محصولات جدید نگهشان دارید.'),
    ('potential', 'در مسیر وفاداری', 'emerald',
     'اخیراً خرید کرده‌اند و چند بار برگشته‌اند.',
     'با یک پیشنهاد محدود زمانی، خرید بعدی‌شان را جلو بیندازید.'),
    ('new', 'تازه‌واردها', 'sky',
     'اولین خریدشان را به‌تازگی انجام داده‌اند.',
     'یک پیامک خوش‌آمد و هدیه‌ی خرید دوم بفرستید تا دوباره برگردند.'),
    ('at_risk', 'در خطر ریزش', 'rose',
     'قبلاً زیاد خرید می‌کردند ولی مدتی است نیامده‌اند.',
     'هدیه‌ی بازگشت (طرح فراموشی) و پیامک شخصی بفرستید.'),
    ('cant_lose', 'نباید از دست بروند', 'violet',
     'از پرخریدترین مشتریان بوده‌اند ولی خیلی وقت است خرید نکرده‌اند.',
     'تماس یا پیشنهاد اختصاصی و پررنگ؛ ارزش برگرداندنشان بالاست.'),
    ('hibernating', 'خواب‌رفته', 'slate',
     'کم و قدیمی خرید کرده‌اند.',
     'با تخفیف عمومی یا جشنواره دوباره فعالشان کنید؛ هزینه‌ی زیاد نکنید.'),
    ('lost', 'از دست‌رفته', 'slate',
     'فقط یک بار و خیلی وقت پیش خرید کرده‌اند.',
     'فقط در کمپین‌های بزرگ و ارزان (مثلاً پیامک جشنواره) شاملشان کنید.'),
    ('no_purchase', 'بدون خرید', 'slate',
     'ثبت شده‌اند ولی هنوز خریدی نداشته‌اند.',
     'طرح «اولین خرید» تعریف کنید و برایشان پیامک بفرستید.'),
]
SEGMENT_KEYS = [s[0] for s in SEGMENTS]
SEGMENT_LABELS = {s[0]: s[1] for s in SEGMENTS}


def _r_score(days):
    if days <= 30:
        return 5
    if days <= 60:
        return 4
    if days <= 90:
        return 3
    if days <= 180:
        return 2
    return 1


def _f_score(count):
    if count >= 10:
        return 5
    if count >= 6:
        return 4
    if count >= 3:
        return 3
    if count == 2:
        return 2
    return 1


def _segment(r, f, m, count):
    if count == 0:
        return 'no_purchase'
    if r >= 4 and f >= 4 and m >= 4:
        return 'champions'
    if r == 1 and m >= 4:
        return 'cant_lose'
    if r <= 2 and f >= 3:
        return 'at_risk'
    if f >= 4 and r >= 3:
        return 'loyal'
    if count == 1 and r >= 4:
        return 'new'
    if r >= 3 and f >= 2:
        return 'potential'
    if r == 1 and f == 1:
        return 'lost'
    return 'hibernating'


def compute(business, use_cache=True):
    """خروجی: {customer_id: (r, f, m, segment)}"""
    key = f"loyalty_rfm_{business.pk}"
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return cached
    rows = list(StoreCustomer.objects.filter(business=business)
                .values_list('pk', 'last_purchase_at', 'purchase_count', 'total_purchase_amount'))
    amounts = sorted(a for _, _, c, a in rows if c > 0)
    now = timezone.now()

    def m_score(amount):
        if not amounts:
            return 1
        # صدک مبلغ خرید نسبت به بقیه‌ی مشتریان همین فروشگاه
        pct = bisect.bisect_right(amounts, amount) / len(amounts)
        return min(5, max(1, int(pct * 5 + 0.9999)))

    result = {}
    for pk, last, count, amount in rows:
        if not count:
            result[str(pk)] = (0, 0, 0, 'no_purchase')
            continue
        days = (now - last).days if last else 9999
        r, f, m = _r_score(days), _f_score(count), m_score(amount)
        result[str(pk)] = (r, f, m, _segment(r, f, m, count))
    cache.set(key, result, CACHE_SECONDS)
    return result


def invalidate(business):
    cache.delete(f"loyalty_rfm_{business.pk}")


def ids_for(business, segment):
    data = compute(business)
    return [cid for cid, v in data.items() if v[3] == segment]


def apply_segment(qs, segment, business=None):
    """محدود کردن queryset مشتریان به یک بخش (برای فهرست مشتریان و ارسال پیامک)"""
    if segment not in SEGMENT_KEYS:
        return qs
    if business is None:
        first = qs.values_list('business_id', flat=True).first()
        if not first:
            return qs
        from apps.directory.models import Business
        business = Business.objects.get(pk=first)
    return qs.filter(pk__in=ids_for(business, segment))


def segment_of(business, customer_id):
    v = compute(business).get(str(customer_id))
    if not v:
        return None
    r, f, m, seg = v
    return {"key": seg, "label": SEGMENT_LABELS[seg], "r": r, "f": f, "m": m}


# ------------------------------------------------------------------ داشبورد دیتای هوشمند
def insights(business):
    data = compute(business, use_cache=False)
    customers = {str(c['pk']): c for c in StoreCustomer.objects.filter(business=business)
                 .values('pk', 'full_name', 'phone_number', 'purchase_count', 'total_purchase_amount', 'credit_balance',
                         'first_purchase_at', 'last_purchase_at')}
    total_customers = len(customers)
    total_revenue = sum(c['total_purchase_amount'] for c in customers.values()) or 0

    seg_stats = {k: {"count": 0, "revenue": 0} for k in SEGMENT_KEYS}
    for cid, (_, _, _, seg) in data.items():
        c = customers.get(cid)
        if not c:
            continue
        seg_stats[seg]["count"] += 1
        seg_stats[seg]["revenue"] += c['total_purchase_amount']

    segments = []
    for key, label, color, desc, action in SEGMENTS:
        st = seg_stats[key]
        segments.append({
            "key": key, "label": label, "color": color, "description": desc, "action": action,
            "count": st["count"],
            "share": round(st["count"] * 100 / total_customers, 1) if total_customers else 0,
            "revenue": st["revenue"],
            "revenue_share": round(st["revenue"] * 100 / total_revenue, 1) if total_revenue else 0,
            "avg_spend": st["revenue"] // st["count"] if st["count"] else 0,
        })

    buyers = [c for c in customers.values() if c['purchase_count'] > 0]
    repeaters = [c for c in buyers if c['purchase_count'] > 1]
    now = timezone.now()
    active_90 = sum(1 for c in buyers if c['last_purchase_at'] and (now - c['last_purchase_at']).days <= 90)

    purchases = Purchase.objects.filter(business=business)
    agg = purchases.aggregate(n=Count('id'), s=Sum('final_amount'))
    # فاصله‌ی میانگین بین خریدها برای مشتریان تکراری
    intervals = []
    for c in repeaters:
        first = c['first_purchase_at']
        if first and c['last_purchase_at']:
            intervals.append((c['last_purchase_at'] - first).days / (c['purchase_count'] - 1))

    # زمان‌های پرفروش (۹۰ روز اخیر): روز هفته × ساعت
    since = now - datetime.timedelta(days=90)
    heat = (purchases.filter(purchased_at__gte=since)
            .annotate(wd=ExtractWeekDay('purchased_at'), hr=ExtractHour('purchased_at'))
            .values('wd', 'hr').annotate(n=Count('id')))
    # ExtractWeekDay: ۱=یکشنبه ... ۷=شنبه  ->  ۰=شنبه ... ۶=جمعه
    grid = [[0] * 24 for _ in range(7)]
    for row in heat:
        day = row['wd'] % 7
        grid[day][row['hr']] += row['n']

    top = sorted(buyers, key=lambda c: c['total_purchase_amount'], reverse=True)[:10]
    return {
        "kpis": {
            "customers": total_customers,
            "buyers": len(buyers),
            "repeat_rate": round(len(repeaters) * 100 / len(buyers), 1) if buyers else 0,
            "active_90d": active_90,
            "avg_basket": (agg['s'] or 0) // agg['n'] if agg['n'] else 0,
            "avg_interval_days": round(sum(intervals) / len(intervals)) if intervals else None,
            "revenue": total_revenue,
        },
        "segments": segments,
        "heatmap": grid,
        "top_customers": [
            {"id": str(c['pk']), "name": c['full_name'], "phone": c['phone_number'], "purchases": c['purchase_count'],
             "total": c['total_purchase_amount'], "segment": SEGMENT_LABELS[data.get(str(c['pk']), (0, 0, 0, 'no_purchase'))[3]]}
            for c in top
        ],
    }
