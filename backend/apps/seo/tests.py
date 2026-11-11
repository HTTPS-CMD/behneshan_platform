from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.cms.models import SiteSetting
from apps.directory.models import Business
from apps.identity.models import User
from apps.taxonomy.models import Category, Location

from .analysis import analyze, clean_global_settings
from .models import SeoPage


def make_data():
    cat = Category.objects.create(name="رستوران", slug="restaurant")
    Category.objects.create(name="خالی", slug="khali")
    loc = Location.objects.create(name="چهارباغ", slug="chaharbagh")
    Location.objects.create(name="بی‌کسب‌وکار", slug="empty-loc")
    biz = Business.objects.create(name="کباب‌سرا", slug="kababsara", category=cat, location=loc)
    return cat, loc, biz


class SitemapDataTests(TestCase):
    def setUp(self):
        make_data()

    def test_public_and_lists_only_used_taxonomy(self):
        r = APIClient().get("/api/v1/seo/sitemap/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([b["slug"] for b in r.data["businesses"]], ["kababsara"])
        self.assertEqual([c["slug"] for c in r.data["categories"]], ["restaurant"])
        self.assertEqual([l["slug"] for l in r.data["locations"]], ["chaharbagh"])

    def test_no_private_fields(self):
        r = APIClient().get("/api/v1/seo/sitemap/")
        self.assertEqual(set(r.data["businesses"][0].keys()), {"slug", "updated_at"})

    def test_write_methods_not_allowed(self):
        self.assertEqual(APIClient().post("/api/v1/seo/sitemap/", {}).status_code, 405)

    def test_noindex_pages_are_left_out(self):
        SeoPage.objects.create(page_type="business", page_key="kababsara", noindex=True)
        SeoPage.objects.create(page_type="category", page_key="restaurant", noindex=True)
        SeoPage.objects.create(page_type="static", page_key="/about", noindex=True)
        r = APIClient().get("/api/v1/seo/sitemap/")
        self.assertEqual(r.data["businesses"], [])
        self.assertEqual(r.data["categories"], [])
        self.assertEqual(r.data["noindex_static"], ["/about"])


class AnalysisTests(SimpleTestCase):
    def test_good_title_and_description(self):
        r = analyze(title="کباب‌سرا در چهارباغ | چهارسوق، بهترین کباب", keyword="کباب",
                    description="کباب‌سرا در چهارباغ اصفهان؛ آدرس، شماره تماس، تخفیف‌ها و نظرات مشتریان را در چهارسوق ببینید و سفارش بدهید.",
                    has_image=True)
        self.assertEqual(r["status"], "good")
        self.assertGreaterEqual(r["score"], 90)

    def test_short_title_is_bad_and_keyword_missing(self):
        r = analyze(title="کباب", description="", keyword="")
        levels = {c["id"]: c["level"] for c in r["checks"]}
        self.assertEqual(levels["title"], "bad")
        self.assertEqual(levels["description"], "bad")
        self.assertEqual(levels["keyword"], "bad")
        self.assertEqual(r["status"], "bad")

    def test_keyword_must_appear_in_title(self):
        r = analyze(title="عنوان خیلی خوب و مناسب برای صفحه‌ی ما در چهارسوق", description="x" * 100, keyword="پیتزا")
        levels = {c["id"]: c["level"] for c in r["checks"]}
        self.assertEqual(levels["keyword_title"], "bad")
        self.assertEqual(levels["keyword_description"], "bad")

    def test_noindex_has_no_score(self):
        r = analyze(title="t", description="d", noindex=True)
        self.assertIsNone(r["score"])
        self.assertEqual(r["status"], "noindex")

    def test_business_extra_checks(self):
        r = analyze(title="a" * 40, description="b" * 100, extra={
            "description_len": 0, "has_address": False, "has_phone": False, "review_count": 0})
        ids = {c["id"] for c in r["checks"]}
        self.assertTrue({"content", "contact", "reviews"} <= ids)

    def test_clean_settings_rules(self):
        cleaned, errors = clean_global_settings({
            "seo_google_verification": '<meta name="google-site-verification" content="abcDEF123456_-xyz" />',
            "seo_instagram": "@4soghtalk",
            "seo_robots_disallow": "/private\n\n/tmp/",
        })
        self.assertEqual(errors, {})
        self.assertEqual(cleaned["seo_google_verification"], "abcDEF123456_-xyz")
        self.assertEqual(cleaned["seo_instagram"], "https://instagram.com/4soghtalk")
        self.assertEqual(cleaned["seo_robots_disallow"], "/private\n/tmp/")
        _, errors = clean_global_settings({"seo_robots_disallow": "/"})
        self.assertIn("seo_robots_disallow", errors)
        _, errors = clean_global_settings({"seo_robots_disallow": "admin"})
        self.assertIn("seo_robots_disallow", errors)
        _, errors = clean_global_settings({"seo_default_og_image": "javascript:alert(1)"})
        self.assertIn("seo_default_og_image", errors)


class AdminSeoApiTests(TestCase):
    def setUp(self):
        make_data()
        mk = lambda phone, **kw: User.objects.create_user(phone_number=phone, password="x", **kw)
        self.admin = mk("09120000002", role="ADMIN")
        self.client_user = mk("09120000003", role="CLIENT")
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_permissions(self):
        for url in ("/api/v1/seo/admin/pages/", "/api/v1/seo/admin/settings/"):
            self.assertEqual(APIClient().get(url).status_code, 401)
            c = APIClient()
            c.force_authenticate(self.client_user)
            self.assertEqual(c.get(url).status_code, 403)

    def test_list_contains_all_page_kinds_and_summary(self):
        r = self.api.get("/api/v1/seo/admin/pages/")
        self.assertEqual(r.status_code, 200)
        types = {i["type"] for i in r.data["results"]}
        self.assertEqual(types, {"static", "business", "category", "location"})
        # ۶ صفحه‌ی ثابت + ۱ کسب‌وکار + ۱ دسته‌ی دارای کسب‌وکار + ۱ محله‌ی دارای کسب‌وکار
        self.assertEqual(r.data["summary"]["total"], 9)
        self.assertNotIn("khali", [i["key"] for i in r.data["results"]])

    def test_list_filters(self):
        r = self.api.get("/api/v1/seo/admin/pages/", {"type": "business"})
        self.assertEqual([i["key"] for i in r.data["results"]], ["kababsara"])
        r = self.api.get("/api/v1/seo/admin/pages/", {"q": "درباره"})
        self.assertEqual([i["key"] for i in r.data["results"]], ["/about"])

    def test_detail_shows_auto_values(self):
        r = self.api.get("/api/v1/seo/admin/pages/detail/", {"type": "business", "key": "kababsara"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["auto"]["title"], "کباب‌سرا در چهارباغ | چهارسوق")
        self.assertEqual(r.data["effective"]["title"], r.data["auto"]["title"])
        self.assertFalse(r.data["customized"])

    def test_unknown_and_invalid(self):
        self.assertEqual(self.api.get("/api/v1/seo/admin/pages/detail/", {"type": "business", "key": "nope"}).status_code, 404)
        self.assertEqual(self.api.get("/api/v1/seo/admin/pages/detail/", {"type": "zzz", "key": "x"}).status_code, 400)
        self.assertEqual(self.api.get("/api/v1/seo/admin/pages/detail/", {"type": "static", "key": "/nope"}).status_code, 404)

    def test_save_public_reset_cycle(self):
        url = "/api/v1/seo/admin/pages/detail/?type=static&key=/about"
        r = self.api.put(url, {"title": "عنوان دستی درباره‌ی چهارسوق برای تست", "focus_keyword": "چهارسوق"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["effective"]["title"], "عنوان دستی درباره‌ی چهارسوق برای تست")
        self.assertTrue(r.data["customized"])

        pub = APIClient().get("/api/v1/seo/public/page/", {"type": "static", "key": "/about"})
        self.assertEqual(pub.data["title"], "عنوان دستی درباره‌ی چهارسوق برای تست")
        self.assertNotIn("focus_keyword", pub.data)  # کلمه‌ی کلیدی داخلی است و عمومی نمی‌شود

        r = self.api.delete(url)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["customized"])
        self.assertFalse(SeoPage.objects.exists())

    def test_empty_put_deletes_row(self):
        url = "/api/v1/seo/admin/pages/detail/?type=category&key=restaurant"
        self.api.put(url, {"title": "x"}, format="json")
        self.assertEqual(SeoPage.objects.count(), 1)
        self.api.put(url, {}, format="json")
        self.assertEqual(SeoPage.objects.count(), 0)

    def test_validation(self):
        url = "/api/v1/seo/admin/pages/detail/?type=static&key=/about"
        self.assertEqual(self.api.put(url, {"canonical": "javascript:alert(1)"}, format="json").status_code, 400)
        self.assertEqual(self.api.put(url, {"og_image": "ftp://x/y.png"}, format="json").status_code, 400)
        self.assertEqual(self.api.put(url, {"title": "x" * 300}, format="json").status_code, 400)
        self.assertFalse(SeoPage.objects.exists())

    def test_home_cannot_set_canonical_or_noindex(self):
        url = "/api/v1/seo/admin/pages/detail/?type=static&key=/"
        self.assertEqual(self.api.put(url, {"noindex": True}, format="json").status_code, 400)
        self.assertEqual(self.api.put(url, {"canonical": "/x"}, format="json").status_code, 400)
        self.assertEqual(self.api.put(url, {"title": "عنوان دستی صفحه‌ی اصلی چهارسوق برای تست"}, format="json").status_code, 200)

    def test_noindex_flow(self):
        url = "/api/v1/seo/admin/pages/detail/?type=business&key=kababsara"
        r = self.api.put(url, {"noindex": True}, format="json")
        self.assertEqual(r.data["analysis"]["status"], "noindex")
        self.assertIsNone(r.data["analysis"]["score"])
        lst = self.api.get("/api/v1/seo/admin/pages/", {"status": "noindex"})
        self.assertEqual([i["key"] for i in lst.data["results"]], ["kababsara"])

    def test_analyze_does_not_save(self):
        r = self.api.post("/api/v1/seo/admin/analyze/", {
            "type": "static", "key": "/about", "title": "کوتاه", "focus_keyword": "کلمه"}, format="json")
        self.assertEqual(r.status_code, 200)
        levels = {c["id"]: c["level"] for c in r.data["analysis"]["checks"]}
        self.assertEqual(levels["title"], "bad")
        self.assertFalse(SeoPage.objects.exists())

    def test_settings_roundtrip_and_public(self):
        url = "/api/v1/seo/admin/settings/"
        r = self.api.put(url, {"seo_org_name": "چهارسوق", "seo_robots_disallow": "/tmp"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["seo_org_name"], "چهارسوق")
        pub = APIClient().get("/api/v1/seo/public/settings/")
        self.assertEqual(pub.data["seo_robots_disallow"], "/tmp")
        # خالی کردن، ردیف را حذف می‌کند
        self.api.put(url, {"seo_org_name": ""}, format="json")
        self.assertFalse(SiteSetting.objects.filter(key="seo_org_name").exists())
        # ورودی نامعتبر هیچ‌چیز را عوض نمی‌کند
        bad = self.api.put(url, {"seo_org_name": "ok", "seo_robots_disallow": "/"}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertFalse(SiteSetting.objects.filter(key="seo_org_name").exists())

    def test_non_seo_settings_are_ignored(self):
        self.api.put("/api/v1/seo/admin/settings/", {"contact_phone": "123", "seo_org_name": "x"}, format="json")
        self.assertFalse(SiteSetting.objects.filter(key="contact_phone").exists())
