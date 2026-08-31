from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .booking_lead import assert_slot_bookable_for_customer
from .booking_services import (
    _lock_slot,
    customer_can_book,
    customer_is_blocked,
    ensure_customer_membership,
    require_booking_contact,
    resolve_booking_service_address,
)
from .models import Booking, CustomerServiceInquiry, Service


def _parse_quote_amount(raw):
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({'amount': 'Enter a valid quote amount.'}) from exc
    if amount <= 0:
        raise ValidationError({'amount': 'Quote amount must be greater than zero.'})
    return amount


def _inquiry_open_for_quote(inquiry):
    return inquiry.status in (
        CustomerServiceInquiry.Status.PENDING,
        CustomerServiceInquiry.Status.ACTIVE,
    )


@transaction.atomic
def send_inquiry_quote(inquiry, *, staff_user, amount, message=''):
    if not _inquiry_open_for_quote(inquiry) and inquiry.status != CustomerServiceInquiry.Status.QUOTED:
        raise ValidationError({'status': 'This request cannot receive a quote in its current state.'})
    parsed = _parse_quote_amount(amount)
    inquiry.quote_amount = parsed
    inquiry.quote_message = (message or '').strip()[:4000]
    inquiry.quoted_at = timezone.now()
    if inquiry.status in (
        CustomerServiceInquiry.Status.PENDING,
        CustomerServiceInquiry.Status.ACTIVE,
    ):
        inquiry.status = CustomerServiceInquiry.Status.QUOTED
    inquiry.save(
        update_fields=[
            'quote_amount',
            'quote_message',
            'quoted_at',
            'status',
        ]
    )
    return inquiry


@transaction.atomic
def accept_inquiry_quote(inquiry, *, customer):
    if inquiry.status != CustomerServiceInquiry.Status.QUOTED:
        raise ValidationError({'status': 'Only quoted requests can be accepted.'})
    if inquiry.customer_id != customer.id:
        raise PermissionDenied('Only the customer can accept this quote.')
    if inquiry.quote_amount is None:
        raise ValidationError({'detail': 'This quote has no amount yet.'})
    inquiry.status = CustomerServiceInquiry.Status.QUOTE_ACCEPTED
    inquiry.quote_accepted_at = timezone.now()
    inquiry.save(update_fields=['status', 'quote_accepted_at'])
    ensure_customer_membership(inquiry.organization, customer, approve=True)
    return inquiry


@transaction.atomic
def cancel_inquiry_request(inquiry, *, customer):
    """Customer withdraws a quote request before a quote is sent."""
    if inquiry.status not in (
        CustomerServiceInquiry.Status.PENDING,
        CustomerServiceInquiry.Status.ACTIVE,
    ):
        raise ValidationError({'status': 'Only open requests can be cancelled.'})
    if inquiry.customer_id != customer.id:
        raise PermissionDenied('Only the customer can cancel this request.')
    inquiry.status = CustomerServiceInquiry.Status.CANCELLED
    inquiry.dismissed_at = timezone.now()
    inquiry.save(update_fields=['status', 'dismissed_at'])
    return inquiry


@transaction.atomic
def decline_inquiry_quote(inquiry, *, customer):
    if inquiry.status not in (
        CustomerServiceInquiry.Status.QUOTED,
        CustomerServiceInquiry.Status.QUOTE_ACCEPTED,
    ):
        raise ValidationError({'status': 'Only open quotes can be declined.'})
    if inquiry.customer_id != customer.id:
        raise PermissionDenied('Only the customer can decline this quote.')
    inquiry.status = CustomerServiceInquiry.Status.DECLINED
    inquiry.dismissed_at = timezone.now()
    inquiry.save(update_fields=['status', 'dismissed_at'])
    return inquiry


@transaction.atomic
def book_inquiry_slot(inquiry, *, customer, slot):
    if inquiry.status != CustomerServiceInquiry.Status.QUOTE_ACCEPTED:
        raise ValidationError({
            'status': 'Accept the quote before choosing an appointment time.',
        })
    if inquiry.customer_id != customer.id:
        raise PermissionDenied('Only the customer can book this request.')
    if inquiry.booking_id:
        raise ValidationError({'detail': 'This request already has a booking.'})
    if not inquiry.service_id:
        raise ValidationError({'service': 'This request is not linked to a bookable service.'})

    require_booking_contact(customer)
    org = inquiry.organization
    if customer_is_blocked(org, customer):
        raise PermissionDenied(
            'You cannot book with this business. Contact them if you think this is a mistake.'
        )
    if not customer_can_book(org, customer):
        raise PermissionDenied('You cannot book with this business.')

    slot = _lock_slot(slot)
    service = inquiry.service
    if slot.organization_id != org.id:
        raise ValidationError({'slot_id': 'This slot does not belong to the business.'})
    if slot.service_id and slot.service_id != service.id:
        raise ValidationError({'slot_id': 'This slot is for a different service.'})
    if not slot.is_bookable():
        raise ValidationError({'slot_id': 'This slot is no longer available.'})
    assert_slot_bookable_for_customer(slot)

    ensure_customer_membership(org, customer, approve=True)
    resolved_address = resolve_booking_service_address(
        service=service,
        customer_address=inquiry.service_address,
    )
    if (
        service.fulfillment_kind == Service.FulfillmentKind.MOBILE
        and not (inquiry.service_address or '').strip()
    ):
        raise ValidationError({
            'service_address': 'Enter the job location where the provider should come.',
        })

    booking = Booking(
        organization=org,
        service=service,
        customer=customer,
        availability_slot=slot,
        start_at=slot.start_at,
        end_at=slot.end_at,
        status=Booking.Status.CONFIRMED,
        source=Booking.Source.CUSTOMER_REQUEST,
        customer_notes=(inquiry.message or '').strip()[:4000],
        service_address=resolved_address,
        quote_amount=inquiry.quote_amount,
        quote_message=inquiry.quote_message or '',
        quoted_at=inquiry.quoted_at,
    )
    booking.save()
    slot.refresh_status(save=True)

    inquiry.booking = booking
    inquiry.status = CustomerServiceInquiry.Status.COMPLETED
    inquiry.save(update_fields=['booking', 'status'])

    from .message_services import ensure_booking_card

    ensure_booking_card(booking=booking, sender=customer)
    return booking
