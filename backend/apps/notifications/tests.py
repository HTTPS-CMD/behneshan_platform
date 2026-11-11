"""
تست‌های سیستم اعلان — اجرا:  python manage.py test apps.notifications
(کاربر دیتابیس باید اجازه‌ی ساخت دیتابیس تست را داشته باشد: ALTER USER behneshan_user CREATEDB;)
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.directory.models import Business, BusinessRequest, CampaignUsage, DiscountCampaign, Review, TransactionLog

from .models import Notification

User = get_user_model()


class NotificationSignalsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('09120000000', is_staff=True, role='ADMIN')
        self.owner = User.objects.create_user('09120000001', role='BUSINESS_OWNER')
        self.client_user = User.objects.create_user('09120000002', role='CLIENT')
        self.biz = Business.objects.create(owner=self.owner, name='کافه تست', slug='test-cafe')
        Notification.objects.all().delete()

    def run_commit_hooks(self, fn):
        with self.captureOnCommitCallbacks(execute=True):
            fn()

    def titles(self, user):
        return list(Notification.objects.filter(recipient=user).values_list('category', flat=True))

    def test_new_user_gets_welcome_and_admin_is_notified(self):
        self.run_commit_hooks(lambda: User.objects.create_user('09121111111'))
        new_user = User.objects.get(phone_number='09121111111')
        self.assertEqual(self.titles(new_user), ['WELCOME'])
        self.assertIn('USER', self.titles(self.admin))

    def test_verify_business_notifies_owner(self):
        self.biz.is_verified = True
        self.run_commit_hooks(self.biz.save)
        self.assertEqual(self.titles(self.owner), ['BUSINESS'])

    def test_review_and_reply(self):
        review = Review(business=self.biz, user=self.client_user, rating=1, comment='بد بود')
        self.run_commit_hooks(review.save)
        self.assertIn('REVIEW', self.titles(self.owner))
        self.assertIn('REVIEW', self.titles(self.admin))  # امتیاز ۱
        review.owner_reply = 'عذرخواهی می‌کنیم'
        self.run_commit_hooks(review.save)
        self.assertEqual(self.titles(self.client_user), ['REPLY'])

    def test_follow(self):
        self.run_commit_hooks(lambda: self.biz.followers.add(self.client_user))
        self.assertEqual(self.titles(self.owner), ['FOLLOW'])

    def test_campaign_claim_full_and_redeem(self):
        camp = DiscountCampaign.objects.create(business=self.biz, code='T10', discount_percent=10, max_usage=1)
        usage = CampaignUsage(client=self.client_user, campaign=camp)
        self.run_commit_hooks(usage.save)
        camp.current_usage = 1
        self.run_commit_hooks(camp.save)
        self.assertEqual(sorted(self.titles(self.owner)), ['CAMPAIGN', 'CAMPAIGN'])  # دریافت + تکمیل ظرفیت
        usage.is_redeemed = True
        self.run_commit_hooks(usage.save)
        self.assertEqual(self.titles(self.client_user), ['CAMPAIGN', 'CAMPAIGN'])  # دریافت + استفاده

    def test_transaction_notifies_customer(self):
        self.run_commit_hooks(lambda: TransactionLog.objects.create(
            business=self.biz, customer=self.client_user, original_amount=100000,
            applied_discount_percentage=10, discount_source='NONE', final_amount=90000))
        self.assertEqual(self.titles(self.client_user), ['TRANSACTION'])

    def test_business_request_flow(self):
        req = BusinessRequest(business=self.biz, request_type='LADDER')
        self.run_commit_hooks(req.save)
        self.assertIn('REQUEST', self.titles(self.admin))
        req.is_approved = True
        self.run_commit_hooks(req.save)
        self.assertEqual(self.titles(self.owner), ['REQUEST'])


class NotificationApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('09123333333')
        self.other = User.objects.create_user('09124444444')
        self.admin = User.objects.create_user('09125555555', is_staff=True, role='ADMIN')
        Notification.objects.all().delete()
        self.n1 = Notification.objects.create(recipient=self.user, title='یک')
        self.n2 = Notification.objects.create(recipient=self.user, title='دو')
        self.foreign = Notification.objects.create(recipient=self.other, title='مال دیگری')
        self.api = APIClient()

    def test_requires_login(self):
        self.assertEqual(self.api.get('/api/v1/notifications/').status_code, 401)

    def test_list_count_and_read(self):
        self.api.force_authenticate(self.user)
        res = self.api.get('/api/v1/notifications/')
        self.assertEqual(res.data['count'], 2)  # اعلان کاربر دیگر دیده نمی‌شود
        self.assertEqual(self.api.get('/api/v1/notifications/unread-count/').data['unread'], 2)
        self.api.post(f'/api/v1/notifications/{self.n1.id}/read/')
        self.assertEqual(self.api.get('/api/v1/notifications/unread-count/').data['unread'], 1)
        self.api.post('/api/v1/notifications/read-all/')
        self.assertEqual(self.api.get('/api/v1/notifications/unread-count/').data['unread'], 0)

    def test_cannot_read_others_notification(self):
        self.api.force_authenticate(self.user)
        self.assertEqual(self.api.post(f'/api/v1/notifications/{self.foreign.id}/read/').status_code, 404)

    def test_broadcast_admin_only_and_internal_links(self):
        self.api.force_authenticate(self.user)
        self.assertEqual(self.api.post('/api/v1/notifications/admin/broadcasts/', {'title': 'سلام'}).status_code, 403)
        self.api.force_authenticate(self.admin)
        bad = self.api.post('/api/v1/notifications/admin/broadcasts/', {'title': 'سلام دنیا', 'link': 'https://evil.com'})
        self.assertEqual(bad.status_code, 400)
        ok = self.api.post('/api/v1/notifications/admin/broadcasts/', {'title': 'سلام دنیا', 'link': '/daily-discounts'})
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(ok.data['recipients_count'], 2)  # ادمین‌ها گیرنده نیستند
