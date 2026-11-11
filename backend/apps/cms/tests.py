from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.identity.models import User

from .models import ContactMessage, SiteSetting

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'cms-tests'}}
VALID = {
    "name": "علی رضایی", "phone": "09121234567", "role": "merchant",
    "subject": "merchant_signup", "message": "می‌خواهم کسب‌وکارم را ثبت کنم.",
}


class _SyncThread:
    """thread را هم‌زمان اجرا می‌کند تا تست قطعی باشد"""
    def __init__(self, target=None, daemon=None, **kw):
        self._target = target

    def start(self):
        self._target()


@override_settings(CACHES=LOCMEM)
class ContactFormTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _post(self, **extra):
        return self.client.post('/api/v1/cms/contact/', {**VALID, **extra}, format='json')

    def test_valid_message_is_saved(self):
        r = self._post()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)
        self.assertFalse(ContactMessage.objects.get().is_read)

    def test_persian_digits_are_normalised(self):
        r = self._post(phone="۰۹۱۲۱۲۳۴۵۶۷")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ContactMessage.objects.get().phone, "09121234567")

    def test_invalid_input_rejected(self):
        self.assertEqual(self._post(phone="12345").status_code, 400)
        self.assertEqual(self._post(name=" ").status_code, 400)
        self.assertEqual(self._post(message="سلام").status_code, 400)
        self.assertEqual(self._post(subject="hack").status_code, 400)
        self.assertEqual(self._post(message="x" * 2001).status_code, 400)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_honeypot_looks_successful_but_saves_nothing(self):
        r = self._post(website="http://spam.example")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_same_phone_cooldown(self):
        self.assertEqual(self._post().status_code, 201)
        self.assertEqual(self._post().status_code, 429)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_ip_throttle_after_five_per_hour(self):
        codes = [self._post(phone=f"0912123456{i}").status_code for i in range(6)]
        self.assertEqual(codes[:5], [201] * 5)
        self.assertEqual(codes[5], 429)

    def test_invalid_token_does_not_block_form(self):
        r = self.client.post('/api/v1/cms/contact/', VALID, format='json', HTTP_AUTHORIZATION='Bearer expired.token.value')
        self.assertEqual(r.status_code, 201)

    def test_admin_sms_sent_only_when_phone_configured(self):
        provider = mock.Mock()
        provider.send.return_value = (True, '1', '')
        with mock.patch('apps.cms.views.threading.Thread', _SyncThread), \
                mock.patch('apps.loyalty.sms.get_provider', return_value=provider):
            self._post(phone="09121111111")
            provider.send.assert_not_called()          # شماره‌ی مدیر هنوز تنظیم نشده

            SiteSetting.objects.create(key='private_contact_notify_phone', value='09350000000')
            self._post(phone="09122222222")
            provider.send.assert_called_once()
            self.assertEqual(provider.send.call_args[0][0], '09350000000')
            self.assertNotIn('09122222222', provider.send.call_args[0][1])  # شماره‌ی کاربر در پیامک نمی‌آید

    def test_private_settings_are_not_public(self):
        SiteSetting.objects.create(key='private_contact_notify_phone', value='09350000000')
        SiteSetting.objects.create(key='contact_phone', value='031-0000')
        data = APIClient().get('/api/v1/cms/data/').data['settings']
        self.assertIn('contact_phone', data)
        self.assertNotIn('private_contact_notify_phone', data)

    def test_sms_hourly_cap(self):
        SiteSetting.objects.create(key='private_contact_notify_phone', value='09350000000')
        provider = mock.Mock()
        provider.send.return_value = (True, '1', '')
        with mock.patch('apps.cms.views.threading.Thread', _SyncThread), \
                mock.patch('apps.loyalty.sms.get_provider', return_value=provider):
            for i in range(12):
                cache.delete('contact_cooldown_09121234567')
                # throttle را دور می‌زنیم؛ فقط سقف پیامک مهم است
                with mock.patch('apps.cms.views.ContactThrottle.allow_request', return_value=True):
                    self._post()
        self.assertEqual(provider.send.call_count, 10)


@override_settings(CACHES=LOCMEM)
class ContactAdminApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user(phone_number="09120000001", password="x", is_staff=True, role="ADMIN")
        self.user = User.objects.create_user(phone_number="09120000002", password="x")
        self.msg = ContactMessage.objects.create(name="الف", phone="09121234567", subject="card", message="سلام دنیا!")
        ContactMessage.objects.create(name="ب", phone="09121234568", subject="ads", message="پیام دوم", is_read=True)

    def _as(self, user):
        c = APIClient()
        if user:
            c.force_authenticate(user)
        return c

    def test_permissions(self):
        self.assertEqual(self._as(None).get('/api/v1/cms/admin/contact-messages/').status_code, 401)
        self.assertEqual(self._as(self.user).get('/api/v1/cms/admin/contact-messages/').status_code, 403)
        self.assertEqual(self._as(self.staff).get('/api/v1/cms/admin/contact-messages/').status_code, 200)

    def test_list_counts_and_filter(self):
        r = self._as(self.staff).get('/api/v1/cms/admin/contact-messages/')
        self.assertEqual((r.data['count'], r.data['unread'], len(r.data['results'])), (2, 1, 2))
        r = self._as(self.staff).get('/api/v1/cms/admin/contact-messages/?is_read=false')
        self.assertEqual([m['name'] for m in r.data['results']], ["الف"])
        self.assertEqual(r.data['results'][0]['subject_label'], 'خرید و ارتقای کارت')

    def test_only_is_read_is_editable_and_no_delete(self):
        c = self._as(self.staff)
        r = c.patch(f'/api/v1/cms/admin/contact-messages/{self.msg.pk}/', {"is_read": True, "message": "تغییر"}, format='json')
        self.assertEqual(r.status_code, 200)
        self.msg.refresh_from_db()
        self.assertTrue(self.msg.is_read)
        self.assertEqual(self.msg.message, "سلام دنیا!")
        self.assertEqual(c.delete(f'/api/v1/cms/admin/contact-messages/{self.msg.pk}/').status_code, 405)
        self.assertEqual(c.put(f'/api/v1/cms/admin/contact-messages/{self.msg.pk}/', {}, format='json').status_code, 405)
