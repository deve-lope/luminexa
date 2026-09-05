from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import Booking, CustomerServiceInquiry, Service
from jobs.quote_cleanup_services import purge_stale_quotes


class QuoteCleanupTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='quote-cleanup@test.local',
            password='pass12345',
            full_name='Cleanup Customer',
            phone='5550000200',
        )
        self.org = Organization.objects.create(
            name='Cleanup Co',
            slug='cleanup-co',
            profile_public=True,
            is_active=True,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Quote service',
            duration_minutes=60,
            pricing_type=Service.PricingType.QUOTE,
            base_price='0',
            is_active=True,
            allow_request=True,
        )

    def test_purge_deletes_old_open_inquiries(self):
        old = timezone.now() - timedelta(days=400)
        inquiry = CustomerServiceInquiry.objects.create(
            organization=self.org,
            customer=self.customer,
            service=self.service,
            message='Old quote',
            status=CustomerServiceInquiry.Status.QUOTED,
            quote_amount='100.00',
        )
        CustomerServiceInquiry.objects.filter(pk=inquiry.pk).update(created_at=old)

        result = purge_stale_quotes(older_than_days=365)
        self.assertGreaterEqual(result['inquiries_deleted'], 1)
        self.assertFalse(CustomerServiceInquiry.objects.filter(pk=inquiry.pk).exists())

    def test_purge_keeps_completed_inquiries(self):
        old = timezone.now() - timedelta(days=400)
        inquiry = CustomerServiceInquiry.objects.create(
            organization=self.org,
            customer=self.customer,
            service=self.service,
            message='Booked quote',
            status=CustomerServiceInquiry.Status.COMPLETED,
        )
        CustomerServiceInquiry.objects.filter(pk=inquiry.pk).update(created_at=old)

        purge_stale_quotes(older_than_days=365)
        self.assertTrue(CustomerServiceInquiry.objects.filter(pk=inquiry.pk).exists())

    def test_purge_deletes_old_unconfirmed_quote_bookings(self):
        old = timezone.now() - timedelta(days=400)
        start = timezone.now() + timedelta(days=2)
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.QUOTED,
            quote_amount='50.00',
        )
        Booking.objects.filter(pk=booking.pk).update(created_at=old)

        result = purge_stale_quotes(older_than_days=365)
        self.assertEqual(result['bookings_deleted'], 1)
        self.assertFalse(Booking.objects.filter(pk=booking.pk).exists())
