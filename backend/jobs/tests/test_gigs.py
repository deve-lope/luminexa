"""High-value tests for Gig Wall models, visibility, and API permissions."""

from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.gig_location import visible_gig_posts_for_organization
from businesses.models import (
    BusinessType,
    Organization,
    OrganizationLocation,
    OrganizationMembership,
)
from jobs.models import (
    CustomerNotification,
    CustomerServiceInquiry,
    GigComment,
    GigPost,
    GigQuote,
    ProviderNotification,
)

User = get_user_model()


def _png_bytes():
    from PIL import Image
    buf = BytesIO()
    Image.new('RGB', (2, 2), color=(255, 0, 0)).save(buf, format='PNG')
    return buf.getvalue()


class GigModelTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='gig-cust@test.local', password='password123', full_name='Gig Customer',
        )
        self.category = BusinessType.objects.create(
            name='Plumbing', slug='plumbing-gig-test', is_active=True,
        )
        self.org = Organization.objects.create(name='Plumb Co', slug='plumb-co-gig')

    def _post(self, **kwargs):
        defaults = dict(
            customer=self.customer,
            title='Fix leaky faucet',
            description='Kitchen faucet dripping',
            category=self.category,
            location_city='Toronto',
            location_state='ON',
            location_postal_code='M5V1A1',
            expires_at=timezone.now() + timedelta(days=30),
        )
        defaults.update(kwargs)
        return GigPost.objects.create(**defaults)

    def test_create_gig_post_defaults_open(self):
        post = self._post()
        self.assertEqual(post.status, GigPost.Status.OPEN)
        self.assertIn('Fix leaky', str(post))

    def test_quote_unique_per_org(self):
        post = self._post()
        GigQuote.objects.create(
            gig_post=post, organization=self.org,
            price=Decimal('100.00'), description='We can help',
        )
        with self.assertRaises(IntegrityError):
            GigQuote.objects.create(
                gig_post=post, organization=self.org,
                price=Decimal('150.00'), description='Again',
            )

    def test_quotes_ordered_lowest_price_first(self):
        post = self._post()
        org2 = Organization.objects.create(name='Org2', slug='org2-gig')
        org3 = Organization.objects.create(name='Org3', slug='org3-gig')
        GigQuote.objects.create(gig_post=post, organization=self.org, price=Decimal('200'), description='a')
        GigQuote.objects.create(gig_post=post, organization=org2, price=Decimal('100'), description='b')
        GigQuote.objects.create(gig_post=post, organization=org3, price=Decimal('150'), description='c')
        prices = list(post.quotes.values_list('price', flat=True))
        self.assertEqual(prices, [Decimal('100.00'), Decimal('150.00'), Decimal('200.00')])


class GigVisibilityTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='vis-cust@test.local', password='password123', full_name='Customer',
        )
        self.org = Organization.objects.create(name='Vis Org', slug='vis-org-gig')
        OrganizationLocation.objects.create(
            organization=self.org,
            is_primary=True,
            latitude=Decimal('43.653200'),
            longitude=Decimal('-79.383200'),
            radius_miles=Decimal('10.0'),
            is_active=True,
        )

    def _post(self, lat, lng, radius=25):
        return GigPost.objects.create(
            customer=self.customer,
            title='Job',
            description='Need help',
            location_latitude=Decimal(str(lat)),
            location_longitude=Decimal(str(lng)),
            search_radius_miles=Decimal(str(radius)),
            expires_at=timezone.now() + timedelta(days=30),
        )

    def test_within_both_radii_visible(self):
        # ~5 mi south of Toronto pin
        post = self._post(43.60, -79.40, radius=25)
        visible = visible_gig_posts_for_organization(self.org)
        self.assertIn(post, visible)

    def test_outside_provider_radius_hidden(self):
        # Far enough that provider 10mi radius fails even if customer allows 25
        post = self._post(43.40, -79.60, radius=25)
        visible = visible_gig_posts_for_organization(self.org)
        self.assertNotIn(post, visible)

    def test_outside_customer_radius_hidden(self):
        post = self._post(43.60, -79.40, radius=1)
        visible = visible_gig_posts_for_organization(self.org)
        self.assertNotIn(post, visible)

    def test_second_location_can_match(self):
        OrganizationLocation.objects.create(
            organization=self.org,
            latitude=Decimal('43.800000'),
            longitude=Decimal('-79.200000'),
            radius_miles=Decimal('10.0'),
            is_active=True,
        )
        post = self._post(43.75, -79.25, radius=10)
        visible = visible_gig_posts_for_organization(self.org)
        self.assertIn(post, visible)


@override_settings(MEDIA_ROOT='/tmp/luminexa_gig_test_media')
class GigAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='api-cust@test.local', password='password123',
            full_name='API Customer', phone='5551112222',
        )
        self.provider = User.objects.create_user(
            email='api-prov@test.local', password='password123', full_name='API Provider',
        )
        self.other = User.objects.create_user(
            email='api-other@test.local', password='password123', full_name='Other',
        )
        self.category = BusinessType.objects.create(
            name='Handyman', slug='handyman-gig-api', is_active=True,
        )
        self.org = Organization.objects.create(
            name='Handy Co', slug='handy-co-gig', profile_public=True, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.provider,
            role=OrganizationMembership.Role.OWNER,
        )
        OrganizationLocation.objects.create(
            organization=self.org,
            is_primary=True,
            latitude=Decimal('43.653200'),
            longitude=Decimal('-79.383200'),
            radius_miles=Decimal('25.0'),
            is_active=True,
            postal_code='M5V1A1',
        )

    def _create_post(self, user=None, **kwargs):
        defaults = dict(
            customer=user or self.customer,
            title='Need handyman',
            description='Shelf install',
            category=self.category,
            location_city='Toronto',
            location_state='ON',
            location_postal_code='M5V1A1',
            location_latitude=Decimal('43.650000'),
            location_longitude=Decimal('-79.380000'),
            search_radius_miles=Decimal('25.0'),
            expires_at=timezone.now() + timedelta(days=30),
        )
        defaults.update(kwargs)
        return GigPost.objects.create(**defaults)

    def test_customer_can_create_gig_post(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/gigs/',
            {
                'title': 'Need help today',
                'description': 'Please install a shelf',
                'category': self.category.id,
                'location_city': 'Toronto',
                'location_state': 'ON',
                'location_postal_code': 'M5V1A1',
                'search_radius_miles': 25,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['title'], 'Need help today')
        self.assertEqual(GigPost.objects.filter(customer=self.customer).count(), 1)

    def test_customer_can_create_gig_post_with_category_slug(self):
        """The create form sends BusinessType.slug (select values are strings)."""
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/gigs/',
            {
                'title': 'Need help today',
                'description': 'Please install a shelf',
                'category': self.category.slug,
                'location_city': 'Toronto',
                'location_state': 'ON',
                'location_postal_code': 'M5V1A1',
                'search_radius_miles': '25',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        post = GigPost.objects.get(id=res.data['id'])
        self.assertEqual(post.category_id, self.category.id)
        self.assertEqual(res.data.get('category_slug'), self.category.slug)

    def test_create_requires_city_and_postal(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/gigs/',
            {
                'title': 'Need help today',
                'description': 'Please install a shelf',
                'search_radius_miles': 25,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('location_city', res.data)
        self.assertIn('location_postal_code', res.data)

    def test_customer_can_delete_own_gig(self):
        post = self._create_post()
        self.client.force_authenticate(self.customer)
        res = self.client.delete(f'/api/v1/gigs/{post.id}/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(GigPost.objects.filter(id=post.id).exists())

    def test_other_customer_cannot_delete_gig(self):
        post = self._create_post(user=self.other)
        self.client.force_authenticate(self.customer)
        res = self.client.delete(f'/api/v1/gigs/{post.id}/', HTTP_HOST='localhost')
        self.assertIn(res.status_code, (403, 404))
        self.assertTrue(GigPost.objects.filter(id=post.id).exists())

    def test_owner_can_close_and_reopen_gig(self):
        post = self._create_post()
        self.client.force_authenticate(self.customer)
        closed = self.client.post(f'/api/v1/gigs/{post.id}/close/', HTTP_HOST='localhost')
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data['status'], GigPost.Status.CLOSED)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.CLOSED)
        self.assertTrue(GigPost.objects.filter(id=post.id).exists())

        reopened = self.client.post(f'/api/v1/gigs/{post.id}/reopen/', HTTP_HOST='localhost')
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(reopened.data['status'], GigPost.Status.OPEN)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.OPEN)

    def test_reopen_restores_quoted_when_quotes_exist(self):
        post = self._create_post(status=GigPost.Status.CLOSED)
        GigQuote.objects.create(
            gig_post=post, organization=self.org,
            price=Decimal('80.00'), description='We can do it',
        )
        self.client.force_authenticate(self.customer)
        res = self.client.post(f'/api/v1/gigs/{post.id}/reopen/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], GigPost.Status.QUOTED)

    def test_wall_quote_count_not_inflated_by_comments(self):
        """Annotating quotes + comments must use distinct counts (JOIN multiplication)."""
        post = self._create_post()
        GigQuote.objects.create(
            gig_post=post,
            organization=self.org,
            price=Decimal('90.00'),
            description='One bid',
        )
        GigComment.objects.create(
            gig_post=post, author=self.provider, organization=self.org, body='Q1?',
        )
        GigComment.objects.create(
            gig_post=post, author=self.customer, body='A1',
        )
        post.status = GigPost.Status.QUOTED
        post.save(update_fields=['status'])

        self.client.force_authenticate(self.customer)
        listed = self.client.get('/api/v1/gigs/', HTTP_HOST='localhost')
        self.assertEqual(listed.status_code, 200)
        results = listed.data['results'] if isinstance(listed.data, dict) else listed.data
        row = next(r for r in results if r['id'] == post.id)
        self.assertEqual(row['quote_count'], 1)
        self.assertEqual(row['comment_count'], 2)

        bids = self.client.get(f'/api/v1/gigs/{post.id}/quotes/', HTTP_HOST='localhost')
        self.assertEqual(bids.status_code, 200)
        self.assertEqual(len(bids.data), 1)

        self.client.force_authenticate(self.provider)
        wall = self.client.get('/api/v1/gigs-wall/?status=all', HTTP_HOST='localhost')
        self.assertEqual(wall.status_code, 200)
        wall_results = wall.data['results'] if isinstance(wall.data, dict) else wall.data
        wall_row = next(r for r in wall_results if r['id'] == post.id)
        self.assertEqual(wall_row['quote_count'], 1)

    def test_customer_reject_counter_and_message_bid(self):
        post = self._create_post()
        quote = GigQuote.objects.create(
            gig_post=post,
            organization=self.org,
            price=Decimal('120.00'),
            description='Full job',
        )
        post.status = GigPost.Status.QUOTED
        post.save(update_fields=['status'])

        self.client.force_authenticate(self.customer)
        detail = self.client.get(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['price'], '120.00')

        counter = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/counter/',
            {'price': '95.00', 'message': 'Can you do 95?'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(counter.status_code, 200, counter.data)
        self.assertEqual(counter.data['status'], GigQuote.Status.COUNTERED)
        self.assertEqual(counter.data['counter_price'], '95.00')

        self.client.force_authenticate(self.provider)
        accept_c = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/accept-counter/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept_c.status_code, 200, accept_c.data)
        self.assertEqual(accept_c.data['status'], GigQuote.Status.ACCEPTED)
        self.assertEqual(accept_c.data['price'], '95.00')
        self.assertTrue(
            CustomerServiceInquiry.objects.filter(
                organization=self.org,
                customer=self.customer,
                quote_amount=Decimal('95.00'),
            ).exists()
        )

    def test_decline_counter_keeps_original_bid(self):
        post = self._create_post()
        quote = GigQuote.objects.create(
            gig_post=post,
            organization=self.org,
            price=Decimal('150.00'),
            description='Job',
            status=GigQuote.Status.COUNTERED,
            counter_price=Decimal('100.00'),
        )
        self.client.force_authenticate(self.provider)
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/decline-counter/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], GigQuote.Status.SUBMITTED)
        self.assertIsNone(res.data['counter_price'])
        self.assertEqual(res.data['price'], '150.00')

    def test_reject_bid_and_open_conversation(self):
        post = self._create_post()
        quote = GigQuote.objects.create(
            gig_post=post,
            organization=self.org,
            price=Decimal('80.00'),
            description='Job',
        )
        post.status = GigPost.Status.QUOTED
        post.save(update_fields=['status'])

        self.client.force_authenticate(self.customer)
        rejected = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/reject/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data['status'], GigQuote.Status.REJECTED)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.OPEN)

        # Re-open chat is still allowed after reject (history)
        chat = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/conversation/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(chat.status_code, 200, chat.data)
        self.assertIn('conversation_id', chat.data)

    def test_closed_gig_leaves_public_and_provider_wall(self):
        post = self._create_post()
        self.client.force_authenticate(self.customer)
        self.client.post(f'/api/v1/gigs/{post.id}/close/', HTTP_HOST='localhost')

        self.client.force_authenticate(self.other)
        listed = self.client.get('/api/v1/gigs/', HTTP_HOST='localhost')
        self.assertEqual(listed.status_code, 200)
        results = listed.data['results'] if isinstance(listed.data, dict) else listed.data
        self.assertNotIn(post.id, [r['id'] for r in results])
        retrieve = self.client.get(f'/api/v1/gigs/{post.id}/', HTTP_HOST='localhost')
        self.assertIn(retrieve.status_code, (403, 404))

        self.client.force_authenticate(self.provider)
        wall = self.client.get('/api/v1/gigs-wall/?status=all', HTTP_HOST='localhost')
        self.assertEqual(wall.status_code, 200)
        wall_results = wall.data['results'] if isinstance(wall.data, dict) else wall.data
        self.assertNotIn(post.id, [r['id'] for r in wall_results])
        detail = self.client.get(f'/api/v1/gigs-wall/{post.id}/', HTTP_HOST='localhost')
        self.assertEqual(detail.status_code, 403)
        quote = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/',
            {'price': '50.00', 'description': 'Too late'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(quote.status_code, 403)

        self.client.force_authenticate(self.customer)
        mine = self.client.get('/api/v1/gigs/', HTTP_HOST='localhost')
        mine_results = mine.data['results'] if isinstance(mine.data, dict) else mine.data
        self.assertIn(post.id, [r['id'] for r in mine_results])

    def test_cannot_close_accepted_gig(self):
        post = self._create_post(status=GigPost.Status.ACCEPTED)
        self.client.force_authenticate(self.customer)
        res = self.client.post(f'/api/v1/gigs/{post.id}/close/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 400)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.ACCEPTED)

    def test_other_customer_cannot_close_gig(self):
        post = self._create_post(user=self.other)
        self.client.force_authenticate(self.customer)
        res = self.client.post(f'/api/v1/gigs/{post.id}/close/', HTTP_HOST='localhost')
        self.assertIn(res.status_code, (403, 404))
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.OPEN)

    def test_reopen_extends_expired_window(self):
        post = self._create_post(
            status=GigPost.Status.CLOSED,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.client.force_authenticate(self.customer)
        res = self.client.post(f'/api/v1/gigs/{post.id}/reopen/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200, res.data)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.OPEN)
        self.assertGreater(post.expires_at, timezone.now())

    def test_customer_wall_shows_all_posts_own_first(self):
        mine = self._create_post(user=self.customer, title='My request')
        other = self._create_post(user=self.other, title='Other job')
        self.client.force_authenticate(self.customer)
        res = self.client.get('/api/v1/gigs/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        results = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = [r['id'] for r in results]
        self.assertIn(mine.id, ids)
        self.assertIn(other.id, ids)
        # Own posts first
        self.assertEqual(results[0]['id'], mine.id)
        self.assertTrue(results[0]['is_mine'])
        other_row = next(r for r in results if r['id'] == other.id)
        self.assertFalse(other_row['is_mine'])
        self.assertEqual(other_row['location_address'], '')

    def test_provider_sees_visible_wall(self):
        post = self._create_post()
        self.client.force_authenticate(self.provider)
        res = self.client.get('/api/v1/gigs-wall/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        results = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = [r['id'] for r in results]
        self.assertIn(post.id, ids)

    def test_provider_does_not_see_far_post(self):
        far = self._create_post(
            location_latitude=Decimal('45.000000'),
            location_longitude=Decimal('-75.000000'),
            search_radius_miles=Decimal('5.0'),
            title='Far job',
        )
        self.client.force_authenticate(self.provider)
        res = self.client.get('/api/v1/gigs-wall/', HTTP_HOST='localhost')
        results = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertNotIn(far.id, [r['id'] for r in results])

    def test_provider_can_comment_and_customer_can_reply(self):
        post = self._create_post()
        self.client.force_authenticate(self.provider)
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/comments/',
            {'body': 'What size shelf?'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(res.data['is_customer_comment'])

        self.client.force_authenticate(self.customer)
        res2 = self.client.post(
            f'/api/v1/gigs/{post.id}/comments/',
            {'body': 'About 3 feet'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)
        self.assertTrue(res2.data['is_customer_comment'])

    def test_other_customer_cannot_comment(self):
        post = self._create_post()
        self.client.force_authenticate(self.other)
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/comments/',
            {'body': 'Hi'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)

    def test_provider_can_quote_sorted_and_accept_creates_inquiry(self):
        post = self._create_post()
        org2 = Organization.objects.create(name='Cheap Co', slug='cheap-co-gig')
        OrganizationMembership.objects.create(
            organization=org2, user=self.other, role=OrganizationMembership.Role.OWNER,
        )
        OrganizationLocation.objects.create(
            organization=org2,
            is_primary=True,
            latitude=Decimal('43.653200'),
            longitude=Decimal('-79.383200'),
            radius_miles=Decimal('25.0'),
            is_active=True,
        )

        self.client.force_authenticate(self.provider)
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/',
            {'price': '200.00', 'description': 'Full install'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)

        self.client.force_authenticate(self.other)
        res2 = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/',
            {'price': '100.00', 'description': 'Budget install'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)

        self.client.force_authenticate(self.customer)
        listed = self.client.get(f'/api/v1/gigs/{post.id}/quotes/', HTTP_HOST='localhost')
        self.assertEqual(listed.status_code, 200)
        prices = [Decimal(q['price']) for q in listed.data]
        self.assertEqual(prices, [Decimal('100.00'), Decimal('200.00')])

        cheap_id = listed.data[0]['id']
        accept = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{cheap_id}/accept/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept.status_code, 200, accept.data)
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.ACCEPTED)
        self.assertTrue(
            CustomerServiceInquiry.objects.filter(
                customer=self.customer,
                organization=org2,
                quote_amount=Decimal('100.00'),
            ).exists()
        )
        self.assertTrue(
            ProviderNotification.objects.filter(
                organization=org2,
                kind=ProviderNotification.Kind.GIG_QUOTE_ACCEPTED,
            ).exists()
        )

    def test_accept_bid_then_book_open_slot_from_quotes(self):
        """After accepting a gig bid, Quotes inquiry can pick any open provider slot."""
        from jobs.inquiry_services import CUSTOM_JOB_SERVICE_NAME
        from jobs.models import AvailabilitySlot, Booking, Service

        post = self._create_post(location_address='12 Queen St W, Toronto')
        other_service = Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=60,
            base_price=Decimal('49.00'),
            is_active=True,
        )
        self.client.force_authenticate(self.provider)
        quote_res = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/',
            {'price': '175.00', 'description': 'Full install'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(quote_res.status_code, 201, quote_res.data)
        quote_id = quote_res.data['id']

        start = timezone.now() + timedelta(days=3)
        # Slot tagged to a different catalog service — must not become the booking's job.
        slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=other_service,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=AvailabilitySlot.Status.OPEN,
        )

        self.client.force_authenticate(self.customer)
        accept = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote_id}/accept/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept.status_code, 200, accept.data)

        inquiry = CustomerServiceInquiry.objects.get(
            customer=self.customer,
            organization=self.org,
            status=CustomerServiceInquiry.Status.QUOTE_ACCEPTED,
        )
        self.assertIsNone(inquiry.service_id)
        self.assertEqual(inquiry.gig_quote_id, quote_id)
        self.assertEqual(inquiry.service_label, post.title)

        cal = self.client.get(
            f'/api/v1/public/providers/{self.org.slug}/calendar/',
            {'year': start.year, 'month': start.month},
            HTTP_HOST='localhost',
        )
        self.assertEqual(cal.status_code, 200, cal.data)
        day_key = start.astimezone().strftime('%Y-%m-%d')
        day_slots = cal.data['slots_by_day'].get(day_key) or []
        self.assertTrue(any(s['id'] == slot.id and s['available'] for s in day_slots))

        booked = self.client.post(
            f'/api/v1/me/service-inquiries/{inquiry.id}/book-slot/',
            {'slot_id': slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(booked.status_code, 200, booked.data)
        self.assertEqual(booked.data['inquiry']['status'], CustomerServiceInquiry.Status.COMPLETED)
        self.assertEqual(booked.data['booking']['status'], Booking.Status.CONFIRMED)
        self.assertEqual(str(booked.data['booking']['quote_amount']), '175.00')
        self.assertEqual(booked.data['booking']['job_title'], post.title)
        self.assertEqual(booked.data['booking']['service_name'], post.title)
        self.assertNotEqual(booked.data['booking']['service'], other_service.id)

        inquiry.refresh_from_db()
        self.assertIsNotNone(inquiry.booking_id)
        self.assertEqual(inquiry.booking.start_at, slot.start_at)
        self.assertEqual(inquiry.booking.job_title, post.title)
        self.assertEqual(inquiry.booking.service.name, CUSTOM_JOB_SERVICE_NAME)
        self.assertNotEqual(inquiry.booking.service_id, other_service.id)

    def test_customer_cannot_accept_others_quote(self):
        post = self._create_post(user=self.other)
        quote = GigQuote.objects.create(
            gig_post=post, organization=self.org,
            price=Decimal('50.00'), description='x',
        )
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/quotes/{quote.id}/accept/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)

    def test_image_upload_max_two(self):
        post = self._create_post()
        self.client.force_authenticate(self.customer)
        for i in range(2):
            upload = SimpleUploadedFile(
                f'photo{i}.png', _png_bytes(), content_type='image/png',
            )
            res = self.client.post(
                f'/api/v1/gigs/{post.id}/images/',
                {'image': upload},
                format='multipart',
                HTTP_HOST='localhost',
            )
            self.assertEqual(res.status_code, 201, res.data)
            image_url = res.data.get('image') or ''
            self.assertTrue(
                str(image_url).startswith('/media/'),
                f'Expected same-origin /media/ URL, got {image_url!r}',
            )
        upload = SimpleUploadedFile('photo3.png', _png_bytes(), content_type='image/png')
        res = self.client.post(
            f'/api/v1/gigs/{post.id}/images/',
            {'image': upload},
            format='multipart',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)

    def test_expire_gigs_command(self):
        post = self._create_post(expires_at=timezone.now() - timedelta(hours=1))
        call_command('expire_gigs')
        post.refresh_from_db()
        self.assertEqual(post.status, GigPost.Status.CLOSED)
        self.assertTrue(
            CustomerNotification.objects.filter(
                customer=self.customer,
                kind=CustomerNotification.Kind.GIG_EXPIRED,
            ).exists()
        )
