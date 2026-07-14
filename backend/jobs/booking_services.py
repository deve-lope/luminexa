from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.models import Organization, OrganizationMembership

from .booking_lead import assert_slot_bookable_for_customer
from .models import AvailabilitySlot, Booking, Service


def resolve_booking_service_address(*, service, customer_address=''):
    """
    Job location stored on the booking.
    Mobile → customer address. Shop → business shop address.
    """
    from businesses.utils import organization_location_full

    customer_address = (customer_address or '').strip()
    if not service:
        return customer_address
    if service.fulfillment_kind == Service.FulfillmentKind.SHOP:
        shop = organization_location_full(service.organization)
        return shop or 'Shop location (confirm with business)'
    return customer_address


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
        if membership.customer_status == OrganizationMembership.CustomerStatus.BLOCKED:
            raise ValidationError({
                'customer': 'This customer is blocked. Unblock them before booking.',
            })
        if membership.customer_status != OrganizationMembership.CustomerStatus.APPROVED:
            membership.customer_status = OrganizationMembership.CustomerStatus.APPROVED
            membership.save(update_fields=['customer_status'])
    return membership


def customer_is_blocked(org, customer):
    if not customer or not getattr(customer, 'is_authenticated', False):
        return False
    return OrganizationMembership.objects.filter(
        organization=org,
        user=customer,
        role=OrganizationMembership.Role.CUSTOMER,
        customer_status=OrganizationMembership.CustomerStatus.BLOCKED,
    ).exists()


def customer_can_book(org, customer):
    """Whether this customer may submit a booking request at this organization."""
    if customer_is_blocked(org, customer):
        return False
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
    blocked = bool(
        membership and membership.customer_status == OrganizationMembership.CustomerStatus.BLOCKED
    )

    return {
        'scheduling_mode': org.scheduling_mode,
        'schedule_valid_from': org.schedule_valid_from,
        'schedule_valid_until': org.schedule_valid_until,
        'booking_policy': org.booking_policy,
        'cancel_cutoff_hours': org.cancel_cutoff_hours,
        'requires_approval': org.booking_policy == Organization.BookingPolicy.APPROVAL,
        'instant_confirm': org.booking_policy == Organization.BookingPolicy.INSTANT,
        'clients_only': org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY,
        'can_book': can_book and (customer.has_booking_contact if customer else False),
        'can_view_calendar': can_view,
        'customer_status': membership.customer_status if membership else None,
        'is_blocked': blocked,
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
    assert_slot_bookable_for_customer(slot)

    if not customer_can_book(org, customer):
        if customer_is_blocked(org, customer):
            raise PermissionDenied(
                'You cannot book with this business. Contact them if you think this is a mistake.'
            )
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

    resolved_address = resolve_booking_service_address(
        service=book_service,
        customer_address=service_address,
    )
    if (
        book_service.fulfillment_kind == Service.FulfillmentKind.MOBILE
        and not (service_address or '').strip()
    ):
        raise ValidationError({
            'service_address': 'Enter the job location where the provider should come.',
        })

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
        service_address=resolved_address,
    )
    slot.status = slot_status
    slot.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def customer_request_slots_batch(*, items, customer):
    """
    Book multiple services for one customer in one transaction.
    Each item: {slot, service (optional), notes, service_address}.
    All services must share the same fulfillment_kind (mobile or shop).
    """
    if not items:
        raise ValidationError({'bookings': 'Select at least one service to book.'})
    if len(items) > 10:
        raise ValidationError({'bookings': 'You can book at most 10 services at once.'})

    seen_slot_ids = set()
    org_id = None
    fulfillment_kind = None
    bookings = []
    for item in items:
        slot = item['slot']
        if slot.id in seen_slot_ids:
            raise ValidationError({
                'bookings': 'Each service needs its own time slot. Pick different times.',
            })
        seen_slot_ids.add(slot.id)
        locked = AvailabilitySlot.objects.select_for_update().select_related(
            'organization', 'service',
        ).get(pk=slot.pk)
        if org_id is None:
            org_id = locked.organization_id
        elif locked.organization_id != org_id:
            raise ValidationError({
                'bookings': 'All services must be from the same business.',
            })
        book_service = item.get('service') or locked.service
        if book_service is not None:
            kind = book_service.fulfillment_kind or Service.FulfillmentKind.MOBILE
            if fulfillment_kind is None:
                fulfillment_kind = kind
            elif kind != fulfillment_kind:
                raise ValidationError({
                    'bookings': (
                        'Mobile and in-shop services cannot be booked together. '
                        'Book them in separate checkouts.'
                    ),
                })
        booking = customer_request_slot(
            slot=locked,
            customer=customer,
            service=item.get('service'),
            notes=item.get('notes') or '',
            service_address=item.get('service_address') or '',
        )
        bookings.append(booking)
    return bookings


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
    from .message_services import post_booking_approval_message

    post_booking_approval_message(booking=booking, sender=staff_user)
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
    # Confirmed bookings: honor the business cancel cutoff (requested can always cancel).
    if is_customer and booking.status == Booking.Status.CONFIRMED:
        cutoff = int(getattr(booking.organization, 'cancel_cutoff_hours', 0) or 0)
        if cutoff > 0:
            hours_left = (booking.start_at - timezone.now()).total_seconds() / 3600
            if hours_left < cutoff:
                raise ValidationError({
                    'status': (
                        f'This business does not allow cancelling within '
                        f'{cutoff} hours of the appointment. Contact them if you need help.'
                    ),
                })
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=['status', 'updated_at'])
    if booking.availability_slot_id:
        release_slot(booking.availability_slot)
    return booking


@transaction.atomic
def start_booking(booking, *, staff_user):
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Only confirmed bookings can be started.'})
    if not OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=staff_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied('Only staff can start bookings.')
    booking.status = Booking.Status.IN_PROGRESS
    booking.save(update_fields=['status', 'updated_at'])
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
    if is_customer:
        assert_slot_bookable_for_customer(new_slot)
    elif new_slot.start_at <= timezone.now():
        raise ValidationError({'slot_id': 'Cannot reschedule to a past slot.'})
    old_slot = booking.availability_slot
    if old_slot:
        release_slot(old_slot)
    booking.availability_slot = new_slot
    booking.start_at = new_slot.start_at
    booking.end_at = new_slot.end_at
    booking.reminder_sent_at = None
    # Customer reschedules always go back to the provider for approval, even if the
    # original booking was already confirmed or the business uses instant booking.
    if is_customer:
        booking.status = Booking.Status.REQUESTED
        new_slot.status = AvailabilitySlot.Status.PENDING
    else:
        # Provider reschedules take effect immediately — no customer approval needed.
        booking.status = Booking.Status.CONFIRMED
        new_slot.status = AvailabilitySlot.Status.BOOKED
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


def _require_staff(booking, staff_user, action_label='do this'):
    if not OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=staff_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied(f'Only staff can {action_label}.')


@transaction.atomic
def mark_booking_incomplete(booking, *, staff_user, note=''):
    """Mark an in-progress job as incomplete; a return visit can be scheduled separately."""
    if booking.status != Booking.Status.IN_PROGRESS:
        raise ValidationError({'status': 'Only in-progress jobs can be marked incomplete.'})
    _require_staff(booking, staff_user, 'mark bookings incomplete')
    booking.status = Booking.Status.NEEDS_RETURN
    booking.save(update_fields=['status', 'updated_at'])
    return booking


@transaction.atomic
def schedule_return_visit(booking, *, new_slot, staff_user, note=''):
    """
    Create a linked return-visit booking for incomplete work.
    Accepts in_progress (marks incomplete first) or needs_return.
    """
    if booking.status not in (Booking.Status.IN_PROGRESS, Booking.Status.NEEDS_RETURN):
        raise ValidationError({
            'status': 'Only in-progress or needs-return bookings can schedule a return visit.',
        })
    _require_staff(booking, staff_user, 'schedule return visits')
    if booking.parent_booking_id:
        raise ValidationError({
            'booking': 'Schedule the return visit from the original booking, not from a return visit.',
        })
    if new_slot.status != AvailabilitySlot.Status.OPEN:
        raise ValidationError({'slot_id': 'The selected slot is not available.'})
    if new_slot.organization_id != booking.organization_id:
        raise ValidationError({'slot_id': 'Slot must belong to the same business.'})
    if new_slot.service_id and new_slot.service_id != booking.service_id:
        raise ValidationError({'slot_id': 'Slot must be for the same service.'})
    if new_slot.start_at <= timezone.now():
        raise ValidationError({'slot_id': 'Cannot schedule a return visit in the past.'})

    open_return = booking.return_visits.filter(
        status__in=(
            Booking.Status.REQUESTED,
            Booking.Status.CONFIRMED,
            Booking.Status.IN_PROGRESS,
        ),
    ).exists()
    if open_return:
        raise ValidationError({
            'booking': 'A return visit is already scheduled for this job.',
        })

    if booking.status == Booking.Status.IN_PROGRESS:
        booking.status = Booking.Status.NEEDS_RETURN
        booking.save(update_fields=['status', 'updated_at'])

    note_text = (note or '').strip()
    child_notes_parts = ['[Return visit for incomplete work]']
    if note_text:
        child_notes_parts.append(note_text)
    if booking.customer_notes:
        child_notes_parts.append(booking.customer_notes)

    return_booking = Booking.objects.create(
        organization=booking.organization,
        service=booking.service,
        customer=booking.customer,
        availability_slot=new_slot,
        parent_booking=booking,
        start_at=new_slot.start_at,
        end_at=new_slot.end_at,
        status=Booking.Status.CONFIRMED,
        source=Booking.Source.PROVIDER_DIRECT,
        booked_by=staff_user,
        customer_notes='\n\n'.join(child_notes_parts),
        service_address=booking.service_address or '',
    )
    new_slot.status = AvailabilitySlot.Status.BOOKED
    new_slot.save(update_fields=['status', 'updated_at'])
    return return_booking
