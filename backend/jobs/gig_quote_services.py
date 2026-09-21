"""Gig bid accept / reject / counter helpers."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .gig_notifications import (
    notify_counter_declined,
    notify_quote_accepted,
    notify_quote_countered,
    notify_quote_rejected,
)
from .models import CustomerServiceInquiry, GigPost, GigQuote


def refresh_gig_post_quote_status(post):
    """Keep OPEN vs QUOTED in sync with active bids (submitted / countered)."""
    if post.status in (GigPost.Status.ACCEPTED, GigPost.Status.CLOSED):
        return post
    has_active = post.quotes.filter(status__in=GigQuote.active_statuses()).exists()
    desired = GigPost.Status.QUOTED if has_active else GigPost.Status.OPEN
    if post.status != desired:
        post.status = desired
        post.save(update_fields=['status', 'updated_at'])
    return post


@transaction.atomic
def accept_gig_quote(quote, *, customer, price=None):
    """Accept a bid (original or counter). Creates a Quotes-tab inquiry."""
    post = quote.gig_post
    if post.customer_id != customer.id:
        raise PermissionDenied('You can only accept bids on your own posts.')
    if quote.status not in (GigQuote.Status.SUBMITTED, GigQuote.Status.COUNTERED):
        raise ValidationError({'detail': 'This bid cannot be accepted.'})

    if price is not None:
        final_price = Decimal(str(price))
    elif quote.status == GigQuote.Status.COUNTERED and quote.counter_price is not None:
        # Customer accepting while a counter is pending → still accept provider's original
        # unless they meant the counter. Customer accept uses original price.
        final_price = quote.price
    else:
        final_price = quote.price

    if final_price < Decimal('0.01'):
        raise ValidationError({'detail': 'Invalid accept price.'})

    quote.price = final_price
    quote.status = GigQuote.Status.ACCEPTED
    quote.counter_price = None
    quote.counter_message = ''
    quote.countered_at = None
    quote.save(
        update_fields=[
            'price',
            'status',
            'counter_price',
            'counter_message',
            'countered_at',
            'updated_at',
        ]
    )

    post.status = GigPost.Status.ACCEPTED
    post.save(update_fields=['status', 'updated_at'])

    post.quotes.filter(status__in=GigQuote.active_statuses()).exclude(pk=quote.pk).update(
        status=GigQuote.Status.WITHDRAWN
    )

    from .booking_services import ensure_customer_membership

    # Approved membership so Quotes can show the provider schedule and book a slot.
    ensure_customer_membership(quote.organization, customer, approve=True)

    address = (post.location_address or '').strip()
    if not address:
        parts = [
            (post.location_city or '').strip(),
            (post.location_state or '').strip(),
            (post.location_postal_code or '').strip(),
        ]
        address = ', '.join(p for p in parts if p)

    CustomerServiceInquiry.objects.create(
        organization=quote.organization,
        customer=customer,
        service_label=post.title[:200],
        message=f'Accepted bid from gig post: {post.title}\n\n{quote.description}',
        service_address=address,
        status=CustomerServiceInquiry.Status.QUOTE_ACCEPTED,
        quote_amount=final_price,
        quote_message=quote.description,
        quoted_at=timezone.now(),
        gig_quote=quote,
    )

    notify_quote_accepted(quote)
    return quote


@transaction.atomic
def reject_gig_quote(quote, *, customer):
    post = quote.gig_post
    if post.customer_id != customer.id:
        raise PermissionDenied('You can only reject bids on your own posts.')
    if quote.status not in (GigQuote.Status.SUBMITTED, GigQuote.Status.COUNTERED):
        raise ValidationError({'detail': 'This bid cannot be rejected.'})

    quote.status = GigQuote.Status.REJECTED
    quote.counter_price = None
    quote.counter_message = ''
    quote.countered_at = None
    quote.save(
        update_fields=[
            'status',
            'counter_price',
            'counter_message',
            'countered_at',
            'updated_at',
        ]
    )
    refresh_gig_post_quote_status(post)
    notify_quote_rejected(quote)
    return quote


@transaction.atomic
def counter_gig_quote(quote, *, customer, price, message=''):
    post = quote.gig_post
    if post.customer_id != customer.id:
        raise PermissionDenied('You can only negotiate on your own posts.')
    if quote.status not in (GigQuote.Status.SUBMITTED, GigQuote.Status.COUNTERED):
        raise ValidationError({'detail': 'You can only negotiate on an open bid.'})
    if post.status not in (GigPost.Status.OPEN, GigPost.Status.QUOTED):
        raise ValidationError({'detail': 'This gig is no longer open for negotiation.'})

    try:
        amount = Decimal(str(price))
    except Exception as exc:
        raise ValidationError({'price': 'Enter a valid price.'}) from exc
    if amount < Decimal('0.01'):
        raise ValidationError({'price': 'Price must be at least 0.01.'})

    note = (message or '').strip()
    if len(note) > 1000:
        raise ValidationError({'message': 'Message must be 1000 characters or fewer.'})

    quote.counter_price = amount
    quote.counter_message = note
    quote.countered_at = timezone.now()
    quote.status = GigQuote.Status.COUNTERED
    quote.save(
        update_fields=[
            'counter_price',
            'counter_message',
            'countered_at',
            'status',
            'updated_at',
        ]
    )
    refresh_gig_post_quote_status(post)
    notify_quote_countered(quote)
    return quote


@transaction.atomic
def accept_gig_quote_counter(quote, *, organization):
    """Provider accepts the customer's counter-price."""
    if quote.organization_id != organization.id:
        raise PermissionDenied('This bid is not yours.')
    if quote.status != GigQuote.Status.COUNTERED or quote.counter_price is None:
        raise ValidationError({'detail': 'There is no counter-offer to accept.'})

    return accept_gig_quote(
        quote,
        customer=quote.gig_post.customer,
        price=quote.counter_price,
    )


@transaction.atomic
def decline_gig_quote_counter(quote, *, organization):
    """Provider declines counter — bid stays open at the original price."""
    if quote.organization_id != organization.id:
        raise PermissionDenied('This bid is not yours.')
    if quote.status != GigQuote.Status.COUNTERED:
        raise ValidationError({'detail': 'There is no counter-offer to decline.'})

    quote.status = GigQuote.Status.SUBMITTED
    quote.counter_price = None
    quote.counter_message = ''
    quote.countered_at = None
    quote.save(
        update_fields=[
            'status',
            'counter_price',
            'counter_message',
            'countered_at',
            'updated_at',
        ]
    )
    notify_counter_declined(quote)
    return quote
