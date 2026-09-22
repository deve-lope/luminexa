"""Tests for Gig Wall public SEO pages and contact-info blocking."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import BusinessType
from jobs.gig_public import (
    CONTACT_INFO_ERROR,
    mask_customer_name,
    public_area_label,
    public_gig_path,
    scrub_contact_info,
    slugify_gig_title,
    text_contains_contact_info,
)
from jobs.gig_serializers import GigQuoteWriteSerializer
from jobs.models import GigPost

User = get_user_model()


class ContactInfoDetectionTests(TestCase):
    def test_detects_email_and_phone(self):
        self.assertTrue(text_contains_contact_info('Reach me at alwin@example.com please'))
        self.assertTrue(text_contains_contact_info('Call (613) 555-1234 anytime'))
        self.assertTrue(text_contains_contact_info('Text +1-416-555-9876'))
        self.assertTrue(text_contains_contact_info('My number is 6135551234'))

    def test_detects_spaced_and_messy_phones(self):
        self.assertTrue(text_contains_contact_info('Call me at 613 555 1234'))
        self.assertTrue(text_contains_contact_info('Call me at 613  555  1234'))
        self.assertTrue(text_contains_contact_info('My cell: 6 1 3 5 5 5 1 2 3 4'))
        self.assertTrue(text_contains_contact_info('Reach me 613.555.1234 thanks'))
        self.assertTrue(text_contains_contact_info('WhatsApp +1 416 555 0199'))
        self.assertTrue(text_contains_contact_info('Text 613/555/1234'))
        self.assertTrue(text_contains_contact_info('Call 613•555•1234'))
        self.assertTrue(text_contains_contact_info('Phone: 613_555_1234'))

    def test_detects_obfuscated_emails(self):
        self.assertTrue(text_contains_contact_info('Email me@home.com'))
        self.assertTrue(text_contains_contact_info('Email me @ home.com'))
        self.assertTrue(text_contains_contact_info('Email me@home . com'))
        self.assertTrue(text_contains_contact_info('Write me (at) home (dot) com'))
        self.assertTrue(text_contains_contact_info('Reach alwin[at]gmail[dot]com'))
        self.assertTrue(text_contains_contact_info('Contact alwin AT gmail DOT com'))

    def test_allows_normal_gig_copy(self):
        self.assertFalse(text_contains_contact_info('Fix leaky Moen kitchen sink in Westboro'))
        self.assertFalse(text_contains_contact_info('Need help for the 2024-2025 season'))
        self.assertFalse(text_contains_contact_info('Apartment 12 needs paint'))
        self.assertFalse(text_contains_contact_info('Budget is around 400 to 500 dollars'))
        self.assertFalse(text_contains_contact_info('Meet me at the park near home'))

    def test_scrub_replaces_contact(self):
        scrubbed = scrub_contact_info('Email me@test.com or call 613-555-1212')
        self.assertIn('[Contact info hidden]', scrubbed)
        self.assertNotIn('me@test.com', scrubbed)
        self.assertNotIn('613-555-1212', scrubbed)

    def test_mask_name_and_area(self):
        self.assertEqual(mask_customer_name('Alwin Fernando'), 'Alwin F.')
        self.assertEqual(mask_customer_name('Alwin'), 'Alwin')
        self.assertEqual(mask_customer_name(''), 'A Luminexa customer')
        self.assertEqual(
            public_area_label(city='Ottawa', postal_code='K1Z 7M5'),
            'K1Z area, Ottawa',
        )


@override_settings(PUBLIC_APP_URL='https://app.luminex-a.com')
class GigContactBlockAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='seo-cust@test.local', password='password123', full_name='Alwin Fernando',
        )
        self.category = BusinessType.objects.create(
            name='Plumbing', slug='plumbing', is_active=True,
        )
        self.client.force_authenticate(self.customer)

    def _payload(self, **overrides):
        data = {
            'title': 'Fix leaky sink',
            'description': 'Kitchen faucet keeps dripping',
            'category': 'plumbing',
            'location_city': 'Ottawa',
            'location_state': 'ON',
            'location_postal_code': 'K1Z7M5',
            'search_radius_miles': 25,
        }
        data.update(overrides)
        return data

    def test_create_rejects_phone_in_description(self):
        res = self.client.post('/api/v1/gigs/', self._payload(
            description='Call me at 613-555-1234',
        ), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn(CONTACT_INFO_ERROR.split('.')[0], str(res.data))

    def test_create_rejects_email_in_title(self):
        res = self.client.post('/api/v1/gigs/', self._payload(
            title='Help me@home.com with sink',
        ), format='json')
        self.assertEqual(res.status_code, 400)

    def test_create_allows_clean_text(self):
        res = self.client.post('/api/v1/gigs/', self._payload(), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['title'], 'Fix leaky sink')

    def test_comment_rejects_phone(self):
        post = GigPost.objects.create(
            customer=self.customer,
            title='Yard work',
            description='Need lawn mowed',
            category=self.category,
            location_city='Ottawa',
            location_postal_code='K1Z7M5',
            expires_at=timezone.now() + timedelta(days=30),
        )
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/comments/',
            {'body': 'My email is hello@example.com'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_quote_rejects_phone(self):
        ser = GigQuoteWriteSerializer(data={
            'price': '50.00',
            'description': 'I can do it, call 6135559999',
        })
        self.assertFalse(ser.is_valid())
        self.assertIn('description', ser.errors)
        self.assertIn(CONTACT_INFO_ERROR.split('.')[0], str(ser.errors))


@override_settings(PUBLIC_APP_URL='https://app.luminex-a.com')
class PublicGigSEOTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='public-gig@test.local', password='password123', full_name='Alwin Fernando',
        )
        self.category = BusinessType.objects.create(
            name='Plumbing', slug='plumbing', is_active=True,
        )
        self.post = GigPost.objects.create(
            customer=self.customer,
            title='Fix leaky Moen kitchen sink',
            description='Drip under the sink near Westboro. Email old@example.com for details.',
            category=self.category,
            location_address='123 Secret Street',
            location_city='Ottawa',
            location_state='ON',
            location_postal_code='K1Z7M5',
            location_latitude=Decimal('45.390000'),
            location_longitude=Decimal('-75.750000'),
            expires_at=timezone.now() + timedelta(days=30),
        )

    def test_public_api_sanitizes_and_allows_anonymous(self):
        res = self.client.get(f'/api/v1/public/gigs/{self.post.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['title'], 'Fix leaky Moen kitchen sink')
        self.assertEqual(res.data['customer_name'], 'Alwin F.')
        self.assertEqual(res.data['area_label'], 'K1Z area, Ottawa')
        self.assertNotIn('123 Secret', str(res.data))
        self.assertNotIn('old@example.com', res.data['description'])
        self.assertIn('[Contact info hidden]', res.data['description'])
        self.assertNotIn('location_address', res.data)
        self.assertTrue(res.data['accepting_bids'])

    def test_html_open_shows_bid_cta(self):
        path = public_gig_path(self.post)
        res = self.client.get(path)
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn('Fix leaky Moen kitchen sink', body)
        self.assertIn('Are you a local pro? Bid on this gig.', body)
        self.assertIn('Need similar help? Post your own gig.', body)
        self.assertIn('application/ld+json', body)
        self.assertNotIn('123 Secret', body)
        self.assertNotIn('old@example.com', body)

    def test_html_closed_never_404_and_hides_bid_cta(self):
        self.post.status = GigPost.Status.CLOSED
        self.post.save(update_fields=['status', 'updated_at'])
        path = public_gig_path(self.post)
        res = self.client.get(path)
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn('has been completed', body)
        self.assertNotIn('Bid on this gig', body)
        self.assertIn('Post your own gig', body)

    def test_wrong_slug_301_to_canonical(self):
        wrong = f'/ottawa/gigs/plumbing/wrong-title-{self.post.id}/'
        res = self.client.get(wrong)
        self.assertEqual(res.status_code, 301)
        self.assertEqual(res['Location'], public_gig_path(self.post))

    def test_sitemap_includes_gig(self):
        res = self.client.get('/sitemap.xml')
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn('https://app.luminex-a.com/ottawa/', body)
        self.assertIn(public_gig_path(self.post).rstrip('/'), body)
        self.assertIn('<changefreq>daily</changefreq>', body)

        self.post.status = GigPost.Status.ACCEPTED
        self.post.save(update_fields=['status', 'updated_at'])
        res2 = self.client.get('/sitemap.xml')
        self.assertIn('<changefreq>yearly</changefreq>', res2.content.decode())

    def test_slugify_helper(self):
        self.assertEqual(
            slugify_gig_title('Fix Leaky Kitchen Sink!'),
            'fix-leaky-kitchen-sink',
        )
