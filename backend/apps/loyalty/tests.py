import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from apps.directory.models import Business
from apps.identity.models import User
from .models import LoyaltySettings, Purchase, StoreCustomer


class PosPurchaseTests(TestCase):
    """ثبت خرید از کارت‌خوان: کش‌بک از تنظیمات باشگاه و بدون ثبت دوباره با client_ref یکسان."""

    def setUp(self):
        self.owner = User.objects.create_user('09120000001', role=User.RoleChoices.BUSINESS_OWNER)
        self.business = Business.objects.create(owner=self.owner, name='فروشگاه', slug='shop', is_verified=True)
        LoyaltySettings.objects.create(business=self.business, default_cashback_percent=5)
        self.client_api = APIClient()
        self.client_api.force_authenticate(self.owner)

    def _post(self, **extra):
        body = {'phone_number': '09121234567', 'amount': 200000, 'payment_method': 'POS', 'source': 'POS', **extra}
        return self.client_api.post('/api/v1/loyalty/owner/purchases/', body, format='json')

    def test_cashback_from_settings_and_source_pos(self):
        res = self._post(client_ref=str(uuid.uuid4()), pos_reference='RRN123')
        self.assertEqual(res.status_code, 201, res.data)
        p = Purchase.objects.get()
        self.assertEqual((p.cashback_amount, p.source, p.payment_method, p.pos_reference), (10000, 'POS', 'POS', 'RRN123'))
        self.assertEqual(StoreCustomer.objects.get().credit_balance, 10000)

    def test_same_client_ref_is_not_recorded_twice(self):
        ref = str(uuid.uuid4())
        first, second = self._post(client_ref=ref), self._post(client_ref=ref)
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(second.data['id'], first.data['id'])
        self.assertEqual(Purchase.objects.count(), 1)
        self.assertEqual(StoreCustomer.objects.get().credit_balance, 10000)

    def test_without_client_ref_still_works_and_bad_ref_rejected(self):
        self.assertEqual(self._post().status_code, 201)
        self.assertEqual(self._post(client_ref='nope').status_code, 400)

    def test_unverified_business_cannot_use(self):
        self.business.is_verified = False
        self.business.save()
        self.assertEqual(self._post().status_code, 403)
