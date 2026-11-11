import math

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cms.models import SiteSetting
from apps.directory.models import Business
from apps.taxonomy.models import Category, Location

from .analysis import (
    STATIC_PAGES, analyze, business_auto, category_auto, clean_global_settings,
    location_auto, read_global_settings, site_url,
)
from .models import SeoPage
from .serializers import SeoPageWriteSerializer

TYPE_PATH = {
    SeoPage.TYPE_BUSINESS: '/business/',
    SeoPage.TYPE_CATEGORY: '/category/',
    SeoPage.TYPE_LOCATION: '/location/',
}
VALID_TYPES = {t for t, _ in SeoPage.TYPES}


class IsAdminReader(permissions.BasePermission):
    message = 'این بخش فقط برای مدیر سایت است.'

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) == 'ADMIN'))


# ---------- ساخت اطلاعات هر صفحه ----------

def _path(page_type, key):
    return key if page_type == SeoPage.TYPE_STATIC else f'{TYPE_PATH[page_type]}{key}'


def _info_static(key):
    meta = STATIC_PAGES[key]
    return {'type': SeoPage.TYPE_STATIC, 'key': key, 'label': meta['label'],
            'auto': {'title': meta['title'], 'description': meta['description']}, 'image': '', 'extra': None}


def _info_business(b):
    return {
        'type': SeoPage.TYPE_BUSINESS, 'key': b.slug, 'label': b.name, 'auto': business_auto(b),
        'image': (b.banner.url if b.banner else '') or (b.logo.url if b.logo else ''),
        'extra': {
            'description_len': len((b.description or '').strip()),
            'has_address': bool((b.address or '').strip()),
            'has_phone': bool((b.public_phone or '').strip()),
            'review_count': b.review_count or 0,
        },
    }


def _info_category(c):
    return {'type': SeoPage.TYPE_CATEGORY, 'key': c.slug, 'label': c.name, 'auto': category_auto(c), 'image': '', 'extra': None}


def _info_location(loc):
    return {'type': SeoPage.TYPE_LOCATION, 'key': loc.slug, 'label': loc.name, 'auto': location_auto(loc), 'image': '', 'extra': None}


def resolve_info(page_type, key):
    """اطلاعات یک صفحه؛ اگر وجود نداشته باشد None"""
    if page_type == SeoPage.TYPE_STATIC:
        return _info_static(key) if key in STATIC_PAGES else None
    if page_type == SeoPage.TYPE_BUSINESS:
        b = Business.objects.select_related('category', 'location').filter(slug=key).first()
        return _info_business(b) if b else None
    if page_type == SeoPage.TYPE_CATEGORY:
        c = Category.objects.filter(slug=key).first()
        return _info_category(c) if c else None
    if page_type == SeoPage.TYPE_LOCATION:
        loc = Location.objects.filter(slug=key).first()
        return _info_location(loc) if loc else None
    return None


def iter_infos(types):
    """همه‌ی صفحه‌های قابل مدیریت (دسته و محله‌ی بدون کسب‌وکار مثل سایت‌مپ نمی‌آیند)"""
    if SeoPage.TYPE_STATIC in types:
        for key in STATIC_PAGES:
            yield _info_static(key)
    if SeoPage.TYPE_CATEGORY in types:
        for c in Category.objects.filter(businesses__isnull=False).distinct():
            yield _info_category(c)
    if SeoPage.TYPE_LOCATION in types:
        for loc in Location.objects.filter(businesses__isnull=False).distinct():
            yield _info_location(loc)
    if SeoPage.TYPE_BUSINESS in types:
        qs = Business.objects.select_related('category', 'location').only(
            'slug', 'name', 'description', 'address', 'public_phone', 'logo', 'banner',
            'review_count', 'category__name', 'location__name',
        ).order_by('name')
        for b in qs[:5000]:
            yield _info_business(b)


def _custom(row):
    return {
        'title': row.title if row else '',
        'description': row.description if row else '',
        'focus_keyword': row.focus_keyword if row else '',
        'canonical': row.canonical if row else '',
        'og_image': row.og_image if row else '',
        'noindex': row.noindex if row else False,
    }


def compose(info, custom):
    """اطلاعات صفحه + تنظیمات ادمین → عنوان و توضیح مؤثر + نمره"""
    title = custom['title'] or info['auto']['title']
    description = custom['description'] or info['auto']['description']
    image = custom['og_image'] or info['image']
    analysis = analyze(
        title=title, description=description, keyword=custom['focus_keyword'],
        noindex=custom['noindex'], has_image=bool(image), extra=info['extra'],
    )
    path = _path(info['type'], info['key'])
    canonical = custom['canonical'] or path
    if canonical.startswith('/'):
        canonical = site_url() + canonical
    return {
        'type': info['type'], 'key': info['key'], 'label': info['label'], 'path': path,
        'url': site_url() + path,
        'custom': custom,
        'auto': info['auto'],
        'effective': {'title': title, 'description': description, 'canonical': canonical, 'og_image': image},
        'analysis': analysis,
        'customized': any([custom['title'], custom['description'], custom['focus_keyword'],
                           custom['canonical'], custom['og_image'], custom['noindex']]),
    }


def _page_or_404(page_type, key):
    if page_type not in VALID_TYPES or not key:
        return None, Response({'detail': 'نوع یا کلید صفحه نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
    info = resolve_info(page_type, key)
    if not info:
        return None, Response({'detail': 'صفحه پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
    return info, None


# ---------- API عمومی (بدون محدودیت نرخ: فرانت سمت سرور از یک IP صدا می‌زند و داده‌ی خصوصی ندارد) ----------

class SitemapDataView(APIView):
    """
    داده‌ی سبک و عمومی برای ساخت sitemap.xml در فرانت.
    صفحه‌های noindex و دسته/محله‌ی بدون کسب‌وکار نمی‌آیند.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        noindex = set(SeoPage.objects.filter(noindex=True).values_list('page_type', 'page_key'))
        businesses = [
            b for b in Business.objects.exclude(slug='').order_by('-updated_at').values('slug', 'updated_at')[:5000]
            if (SeoPage.TYPE_BUSINESS, b['slug']) not in noindex
        ]
        categories = [
            c for c in Category.objects.filter(businesses__isnull=False).exclude(slug='').distinct().values('slug', 'name')
            if (SeoPage.TYPE_CATEGORY, c['slug']) not in noindex
        ]
        locations = [
            loc for loc in Location.objects.filter(businesses__isnull=False).exclude(slug='').distinct().values('slug', 'name')
            if (SeoPage.TYPE_LOCATION, loc['slug']) not in noindex
        ]
        return Response({
            'businesses': businesses,
            'categories': categories,
            'locations': locations,
            'noindex_static': sorted(k for t, k in noindex if t == SeoPage.TYPE_STATIC),
        })


class PublicSeoSettingsView(APIView):
    """تنظیمات کلی سئو برای فرانت (همه عمومی‌اند: کد تأیید و لوگو در HTML سایت هم دیده می‌شوند)"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        return Response(read_global_settings())


class PublicSeoPageView(APIView):
    """مقادیر دستی ادمین برای یک صفحه؛ فیلد خالی یعنی «خودکار»"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        page_type = request.query_params.get('type', '')
        key = request.query_params.get('key', '')
        row = None
        if page_type in VALID_TYPES and key:
            row = SeoPage.objects.filter(page_type=page_type, page_key=key).first()
        c = _custom(row)
        return Response({k: c[k] for k in ('title', 'description', 'canonical', 'og_image', 'noindex')})


# ---------- API ادمین ----------

class AdminPageListView(APIView):
    permission_classes = [IsAdminReader]

    def get(self, request):
        q = request.query_params
        type_filter = q.get('type', 'all')
        types = VALID_TYPES if type_filter == 'all' else ({type_filter} & VALID_TYPES)
        search = (q.get('q') or '').strip().lower()
        status_filter = q.get('status', '')
        try:
            page = max(1, int(q.get('page', 1)))
            page_size = min(50, max(1, int(q.get('page_size', 20))))
        except ValueError:
            page, page_size = 1, 20

        rows = {(r.page_type, r.page_key): r for r in SeoPage.objects.all()}
        items = []
        for info in iter_infos(types):
            if search and search not in info['label'].lower() and search not in info['key'].lower():
                continue
            c = compose(info, _custom(rows.get((info['type'], info['key']))))
            items.append({
                'type': c['type'], 'key': c['key'], 'label': c['label'], 'path': c['path'],
                'title': c['effective']['title'], 'description': c['effective']['description'],
                'score': c['analysis']['score'], 'status': c['analysis']['status'], 'customized': c['customized'],
            })

        scored = [i['score'] for i in items if i['score'] is not None]
        summary = {
            'total': len(items),
            'avg_score': round(sum(scored) / len(scored)) if scored else None,
            'good': sum(1 for i in items if i['status'] == 'good'),
            'warn': sum(1 for i in items if i['status'] == 'warn'),
            'bad': sum(1 for i in items if i['status'] == 'bad'),
            'noindex': sum(1 for i in items if i['status'] == 'noindex'),
            'customized': sum(1 for i in items if i['customized']),
        }

        if status_filter == 'customized':
            items = [i for i in items if i['customized']]
        elif status_filter in ('good', 'warn', 'bad', 'noindex'):
            items = [i for i in items if i['status'] == status_filter]

        # ضعیف‌ترین صفحه‌ها اول؛ noindex آخر
        items.sort(key=lambda i: (i['score'] is None, i['score'] if i['score'] is not None else 0, i['label']))
        count = len(items)
        start = (page - 1) * page_size
        return Response({
            'count': count, 'page': page, 'pages': max(1, math.ceil(count / page_size)),
            'results': items[start:start + page_size], 'summary': summary,
        })


class AdminPageDetailView(APIView):
    permission_classes = [IsAdminReader]

    def _detail(self, info):
        row = SeoPage.objects.filter(page_type=info['type'], page_key=info['key']).first()
        return compose(info, _custom(row))

    def get(self, request):
        info, err = _page_or_404(request.query_params.get('type', ''), request.query_params.get('key', ''))
        return err or Response(self._detail(info))

    def put(self, request):
        info, err = _page_or_404(request.query_params.get('type', ''), request.query_params.get('key', ''))
        if err:
            return err
        ser = SeoPageWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        # عنوان پیش‌فرض کل سایت از همین صفحه می‌آید؛ کانونیکال و noindex آن روی همه‌ی صفحه‌ها اثر می‌گذاشت
        if info['type'] == SeoPage.TYPE_STATIC and info['key'] == '/' and (d['canonical'] or d['noindex']):
            return Response({'detail': 'کانونیکال و noindex برای صفحه‌ی اصلی قابل تنظیم نیست.'},
                            status=status.HTTP_400_BAD_REQUEST)
        empty = not any([d['title'], d['description'], d['focus_keyword'], d['canonical'], d['og_image'], d['noindex']])
        if empty:
            SeoPage.objects.filter(page_type=info['type'], page_key=info['key']).delete()
        else:
            SeoPage.objects.update_or_create(page_type=info['type'], page_key=info['key'], defaults=d)
        return Response(self._detail(info))

    def delete(self, request):
        info, err = _page_or_404(request.query_params.get('type', ''), request.query_params.get('key', ''))
        if err:
            return err
        SeoPage.objects.filter(page_type=info['type'], page_key=info['key']).delete()
        return Response(self._detail(info))


class AdminAnalyzeView(APIView):
    """تحلیل زنده‌ی پیش‌نویس (ذخیره نمی‌کند)؛ برای نمایش نمره هنگام تایپ"""
    permission_classes = [IsAdminReader]

    def post(self, request):
        info, err = _page_or_404(str(request.data.get('type', '')), str(request.data.get('key', '')))
        if err:
            return err
        ser = SeoPageWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(compose(info, ser.validated_data))


class AdminSeoSettingsView(APIView):
    permission_classes = [IsAdminReader]

    def get(self, request):
        return Response(read_global_settings())

    def put(self, request):
        cleaned, errors = clean_global_settings(request.data if isinstance(request.data, dict) else {})
        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)
        for key, value in cleaned.items():
            if value:
                SiteSetting.objects.update_or_create(key=key, defaults={'value': value, 'description': 'تنظیمات سئو'})
            else:
                SiteSetting.objects.filter(key=key).delete()
        return Response(read_global_settings())
