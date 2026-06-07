from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.models import Organization, OrganizationMembership

from .models import AvailabilitySlot, Booking, Service


def require_booking_contact(customer):
    if not customer.email:
        raise ValidationError({'detail': 'Email is required before you can book.'})
    if not (customer.phone or '').strip():
        raise ValidationError({
            'detail': 'Mobile number is required before you can book.',
            'code': 'phone_required',
        })


def _default_customer_status(org):
    if org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY:
        return OrganizationMembership.CustomerStatus.PENDING
    return OrganizationMembership.CustomerStatus.APPROVED


def ensure_customer_membership(org, customer, *, approve=False):
    status = OrganizationMembership.CustomerStatus.APPROVED if approve else _default_customer_status(org)
    membership, created = OrganizationMembership.objects.get_or_create(
        organization=org,
        user=customer,
        defaults={
            'role': OrganizationMembership.Role.CUSTOMER,
            'customer_status': status,
        },
    )
    if not created and approve and membership.role == OrganizationMembership.Role.CUSTOMER:
        if membership.customer_status != OrganizationMembership.CustomerStatus.APPROVED:
            membership.customer_status = OrganizationMembership.CustomerStatus.APPROVED
            membership.save(update_fields=['customer_status'])
    return membership


def customer_can_book(org, customer):
    """Whether this customer may submit a booking request at this organization."""
    if org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY:
        return OrganizationMembership.objects.filter(
            organization=org,
            user=customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        ).exists()
    return True


def customer_can_view_calendar(org, customer):
    """Logged-in users may view the calendar for any public active org."""
    return org.profile_public and org.is_active


def booking_policy_meta(org, customer):
    """Frontend hints for slot UI."""
    can_book = customer_can_book(org, customer) if customer and customer.is_authenticated else False
    can_view = customer_can_view_calendar(org, customer) if customer and customer.is_authenticated else False
    membership = None
    if customer and customer.is_authenticated:
        membership = OrganizationMembership.objects.filter(
            organization=org, user=customer, role=OrganizationMembership.Role.CUSTOMER,
        ).first()

    return {
        'scheduling_mode': org.scheduling_mode,
        'schedule_valid_from': org.schedule_valid_from,
        'schedule_valid_until': org.schedule_valid_until,
        'booking_policy': org.booking_policy,
        'requires_approval': org.booking_policy == Organization.BookingPolicy.APPROVAL,
        'instant_confirm': org.booking_policy == Organization.BookingPolicy.INSTANT,
        'clients_only': org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY,
        'can_book': can_book and (customer.has_booking_contact if customer else False),
        'can_view_calendar': can_view,
        'customer_status': membership.customer_status if membership else None,
        'needs_contact_info': bool(customer and not customer.has_booking_contact),
    }


def release_slot(slot):
    if not slot:
        return
    slot.status = AvailabilitySlot.Status.OPEN
    slot.save(update_fields=['status', 'updated_at'])


@transaction.atomic
def provider_book_customer(
    *, org, service, customer, start_at, end_at, staff_user, slot=None, notes='', service_address='',
):
    if service.organization_id != org.id:
        raise ValidationError({'service': 'Service does not belong to this organization.'})
    ensure_customer_membership(org, customer, approve=True)
    if slot:
        if slot.organization_id != org.id:
            raise ValidationError({'slot_id': 'Slot does not match organization.'})
        if slot.service_id and slot.service_id != service.id:
            raise ValidationError({'slot_id': 'Slot does not match the selected service.'})
        if slot.status != AvailabilitySlot.Status.OPEN:
            raise ValidationError({'slot_id': 'This slot is not available.'})
        if slot.start_at != start_at or slot.end_at != end_at:
            raise ValidationError({'slot_id': 'Slot times must match the booking times.'})

    booking = Booking.objects.create(
        organization=org,
        service=service,
        customer=customer,
        availability_slot=slot,
        start_at=start_at,
        end_at=end_at,
        status=Booking.Status.CONFIRMED,
        source=Booking.Source.PROVIDER_DIRECT,
        booked_by=staff_user,
        customer_notes=notes or '',
        service_address=(service_address or '').strip(),
    )
    if slot:
        slot.status = AvailabilitySlot.Status.BOOKED
        slot.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def customer_request_slot(*, slot, customer, notes='', service_address='', service=None):
    org = slot.organization
    require_booking_contact(customer)

    if slot.status != AvailabilitySlot.Status.OPEN:
        raise ValidationError({'slot_id': 'This slot is no longer available.'})
    if slot.start_at <= timezone.now():
        raise ValidationError({'slot_id': 'This slot is in the past.'})

    if not customer_can_book(org, customer):
        if org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY:
            membership = OrganizationMembership.objects.filter(
                organization=org, user=customer, role=OrganizationMembership.Role.CUSTOMER,
            ).first()
            if not membership:
                raise PermissionDenied(
                    'This business reviews customers before booking. '
                    'Send an access request and book after they approve you.'
                )
            if membership.customer_status == OrganizationMembership.CustomerStatus.PENDING:
                raise PermissionDenied(
                    'Your access request is pending. You can view the calendar '
                    'but cannot book until the business approves you.'
                )
        raise PermissionDenied('You cannot book with this business.')

    if org.booking_policy != Organization.BookingPolicy.CLIENTS_ONLY:
        ensure_customer_membership(org, customer)

    if org.booking_policy == Organization.BookingPolicy.INSTANT:
        booking_status = Booking.Status.CONFIRMED
        slot_status = AvailabilitySlot.Status.BOOKED
    else:
        booking_status = Booking.Status.REQUESTED
        slot_status = AvailabilitySlot.Status.PENDING

    book_service = slot.service or service
    if not book_service:
        raise ValidationError({'service': 'Service is required for this booking.'})
    if book_service.organization_id != org.id:
        raise ValidationError({'service': 'Service does not belong to this organization.'})

    booking = Booking.objects.create(
        organization=org,
        service=book_service,
        customer=customer,
        availability_slot=slot,
        start_at=slot.start_at,
        end_at=slot.end_at,
        status=booking_status,
        source=Booking.Source.CUSTOMER_REQUEST,
        customer_notes=notes or '',
        service_address=(service_address or '').strip(),
    )
    slot.status = slot_status
    slot.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def accept_booking_request(booking, staff_user):
    if booking.status != Booking.Status.REQUESTED:
        raise ValidationError({'status': 'Only requested bookings can be accepted.'})
    booking.status = Booking.Status.CONFIRMED
    booking.booked_by = staff_user
    booking.save(update_fields=['status', 'booked_by', 'updated_at'])
    if booking.availability_slot_id:
        slot = booking.availability_slot
        slot.status = AvailabilitySlot.Status.BOOKED
        slot.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def decline_booking_request(booking):
    if booking.status != Booking.Status.REQUESTED:
        raise ValidationError({'status': 'Only requested bookings can be declined.'})
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=['status', 'updated_at'])
    if booking.availability_slot_id:
        release_slot(booking.availability_slot)
    return booking


@transaction.atomic
def cancel_booking(booking, *, by_user):
    if booking.status in (Booking.Status.CANCELLED, Booking.Status.COMPLETED):
        raise ValidationError({'status': 'This booking cannot be cancelled.'})
    if booking.start_at <= timezone.now() and booking.status == Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Past appointments cannot be cancelled here.'})
    is_customer = booking.customer_id == by_user.id
    is_staff = OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=by_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists()
    if not is_customer and not is_staff:
        raise PermissionDenied('You cannot cancel this booking.')
    if is_customer and booking.status not in (
        Booking.Status.REQUESTED,
        Booking.Status.CONFIRMED,
    ):
        raise ValidationError({'status': 'You cannot cancel this booking in its current state.'})
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=['status', 'updated_at'])
    if booking.availability_slot_id:
        release_slot(booking.availability_slot)
    return booking


@transaction.atomic
def complete_booking(booking, *, staff_user):
    if booking.status not in (Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS):
        raise ValidationError({'status': 'Only confirmed bookings can be marked complete.'})
    if not OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=staff_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied('Only staff can complete bookings.')
    booking.status = Booking.Status.COMPLETED
    booking.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def reschedule_booking(booking, *, new_slot, by_user):
    if booking.status not in (Booking.Status.REQUESTED, Booking.Status.CONFIRMED):
        raise ValidationError({'status': 'Only active bookings can be rescheduled.'})
    if new_slot.status != AvailabilitySlot.Status.OPEN:
        raise ValidationError({'slot_id': 'The new slot is not available.'})
    if new_slot.organization_id != booking.organization_id:
        raise ValidationError({'slot_id': 'Slot must belong to the same business.'})
    if new_slot.service_id != booking.service_id:
        raise ValidationError({'slot_id': 'Slot must be for the same service.'})
    if new_slot.start_at <= timezone.now():
        raise ValidationError({'slot_id': 'Cannot reschedule to a past slot.'})
    is_customer = booking.customer_id == by_user.id
    is_staff = OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=by_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists()
    if not is_customer and not is_staff:
        raise PermissionDenied('You cannot reschedule this booking.')
    old_slot = booking.availability_slot
    if old_slot:
        release_slot(old_slot)
    booking.availability_slot = new_slot
    booking.start_at = new_slot.start_at
    booking.end_at = new_slot.end_at
    booking.reminder_sent_at = None
    if booking.organization.booking_policy == Organization.BookingPolicy.INSTANT:
        booking.status = Booking.Status.CONFIRMED
        new_slot.status = AvailabilitySlot.Status.BOOKED
    else:
        booking.status = Booking.Status.REQUESTED
        new_slot.status = AvailabilitySlot.Status.PENDING
    booking.save(update_fields=[
        'availability_slot', 'start_at', 'end_at', 'status', 'reminder_sent_at', 'updated_at',
    ])
    new_slot.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def mark_booking_no_show(booking, *, staff_user):
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Only confirmed bookings can be marked no-show.'})
    if not OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=staff_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied('Only staff can mark no-show.')
    booking.status = Booking.Status.CANCELLED
    booking.customer_notes = (booking.customer_notes or '').strip()
    if booking.customer_notes:
        booking.customer_notes += '\n'
    booking.customer_notes += '[Marked no-show by provider]'
    booking.save(update_fields=['status', 'customer_notes', 'updated_at'])
    if booking.availability_slot_id:
        release_slot(booking.availability_slot)
    return booking
