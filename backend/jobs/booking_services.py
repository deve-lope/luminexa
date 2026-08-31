from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.models import Organization, OrganizationMembership

from .booking_lead import assert_slot_bookable_for_customer
from .models import AvailabilitySlot, Booking, BookingStatusEvent, Service


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
    # Instant / approval / clients_only: pending or new customers may request.
    # Blocked customers are denied above. Accepting a request approves clients_only.
    return True


def customer_can_view_calendar(org, customer):
    """Logged-in users may view the calendar for any public active org."""
    return org.profile_public and org.is_active


def booking_requires_quote(org, service=None):
    """
    Quote before confirm when the service is not fixed-price, or (legacy) the org
    still uses the all-services quote booking policy.
    """
    if service is not None and Service.pricing_requires_quote(
        getattr(service, 'pricing_type', None)
    ):
        return True
    return org.booking_policy == Organization.BookingPolicy.QUOTE


def service_quote_question_template(service):
    """Normalize Service.quote_questions into [{id, question, answer}]."""
    if not service:
        return []
    return _normalize_quote_questions(getattr(service, 'quote_questions', None) or [])


def apply_quote_answers(template_questions, answers=None):
    """
    Merge customer answers into template questions.
    answers: [{id, answer}] or [{question, answer}] or ["answer", ...] aligned by index.
    """
    questions = [dict(q) for q in (template_questions or [])]
    if not answers:
        return questions
    if isinstance(answers, dict):
        answers = [{'id': k, 'answer': v} for k, v in answers.items()]
    if not isinstance(answers, list):
        raise ValidationError({'quote_answers': 'Answers must be a list.'})

    by_id = {}
    by_question = {}
    indexed = []
    for item in answers:
        if isinstance(item, str):
            indexed.append(item.strip()[:1000])
            continue
        if not isinstance(item, dict):
            continue
        ans = (item.get('answer') or '').strip()[:1000]
        qid = str(item.get('id') or '').strip()
        qtext = (item.get('question') or item.get('text') or '').strip().lower()
        if qid:
            by_id[qid] = ans
        if qtext:
            by_question[qtext] = ans
        indexed.append(ans)

    for i, q in enumerate(questions):
        qid = str(q.get('id') or '')
        qtext = (q.get('question') or '').strip().lower()
        if qid and qid in by_id:
            q['answer'] = by_id[qid]
        elif qtext and qtext in by_question:
            q['answer'] = by_question[qtext]
        elif i < len(indexed) and indexed[i]:
            q['answer'] = indexed[i]
    return questions


def booking_policy_meta(org, customer, service=None):
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
    requires_quote = booking_requires_quote(org, service)

    return {
        'scheduling_mode': org.scheduling_mode,
        'schedule_valid_from': org.schedule_valid_from,
        'schedule_valid_until': org.schedule_valid_until,
        'booking_policy': org.booking_policy,
        'cancel_cutoff_hours': org.cancel_cutoff_hours,
        'concurrent_capacity': max(1, int(getattr(org, 'concurrent_capacity', 1) or 1)),
        'requires_approval': requires_quote or org.booking_policy in (
            Organization.BookingPolicy.APPROVAL,
            Organization.BookingPolicy.CLIENTS_ONLY,
            Organization.BookingPolicy.QUOTE,
        ),
        'instant_confirm': (
            org.booking_policy == Organization.BookingPolicy.INSTANT and not requires_quote
        ),
        'clients_only': org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY,
        'requires_quote': requires_quote,
        'service_quote_questions': [
            q['question'] for q in service_quote_question_template(service)
        ] if service is not None else [],
        'can_book': can_book and (customer.has_booking_contact if customer else False),
        'can_view_calendar': can_view,
        'customer_status': membership.customer_status if membership else None,
        'is_blocked': blocked,
        'needs_contact_info': bool(customer and not customer.has_booking_contact),
    }


def release_slot(slot):
    """Recompute slot status after a booking frees a seat (cancel / decline / reschedule)."""
    if not slot:
        return
    slot.refresh_status(save=True)


def _lock_slot(slot):
    """Row-lock a slot for capacity-safe booking mutations.

    Do not select_related nullable FKs (e.g. service): Postgres rejects
    SELECT FOR UPDATE on the nullable side of an outer join.
    """
    return (
        AvailabilitySlot.objects.select_for_update()
        .select_related('organization')
        .get(pk=slot.pk)
    )


@transaction.atomic
def provider_book_customer(
    *, org, service, customer, start_at, end_at, staff_user, slot=None, notes='', service_address='',
):
    if service.organization_id != org.id:
        raise ValidationError({'service': 'Service does not belong to this organization.'})
    ensure_customer_membership(org, customer, approve=True)
    if slot:
        slot = _lock_slot(slot)
        if slot.organization_id != org.id:
            raise ValidationError({'slot_id': 'Slot does not match organization.'})
        if slot.service_id and slot.service_id != service.id:
            raise ValidationError({'slot_id': 'Slot does not match the selected service.'})
        if not slot.is_bookable():
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
        slot.refresh_status(save=True)
    from .message_services import ensure_booking_card
    ensure_booking_card(booking=booking, sender=staff_user)
    return booking


@transaction.atomic
def customer_request_slot(
    *,
    slot,
    customer,
    notes='',
    service_address='',
    service=None,
    quote_answers=None,
):
    slot = _lock_slot(slot)
    org = slot.organization
    require_booking_contact(customer)

    if not slot.is_bookable():
        raise ValidationError({'slot_id': 'This slot is no longer available.'})
    assert_slot_bookable_for_customer(slot)

    if not customer_can_book(org, customer):
        if customer_is_blocked(org, customer):
            raise PermissionDenied(
                'You cannot book with this business. Contact them if you think this is a mistake.'
            )
        raise PermissionDenied('You cannot book with this business.')

    # Creates pending membership for clients_only; approved for open policies.
    ensure_customer_membership(org, customer)

    book_service = slot.service or service
    if not book_service:
        raise ValidationError({'service': 'Service is required for this booking.'})
    if book_service.organization_id != org.id:
        raise ValidationError({'service': 'Service does not belong to this organization.'})

    requires_quote = booking_requires_quote(org, book_service)
    if requires_quote or org.booking_policy != Organization.BookingPolicy.INSTANT:
        booking_status = Booking.Status.REQUESTED
    else:
        booking_status = Booking.Status.CONFIRMED

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

    quote_questions = []
    if requires_quote:
        template = service_quote_question_template(book_service)
        quote_questions = apply_quote_answers(template, quote_answers)
        missing = [q['question'] for q in quote_questions if not (q.get('answer') or '').strip()]
        if missing:
            raise ValidationError({
                'quote_answers': f'Please answer: {missing[0]}',
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
        quote_questions=quote_questions,
    )
    slot.refresh_status(save=True)
    from .message_services import ensure_booking_card
    ensure_booking_card(booking=booking, sender=customer)
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
            'organization',
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
            quote_answers=item.get('quote_answers'),
        )
        bookings.append(booking)
    return bookings


@transaction.atomic
def accept_booking_request(booking, staff_user):
    if booking.status != Booking.Status.REQUESTED:
        raise ValidationError({'status': 'Only requested bookings can be accepted.'})
    if booking_requires_quote(booking.organization, booking.service):
        raise ValidationError({
            'detail': 'This booking needs a quote. Send a quote instead of approving directly.',
            'code': 'quote_required',
        })
    booking.status = Booking.Status.CONFIRMED
    booking.booked_by = staff_user
    booking.save(update_fields=['status', 'booked_by', 'updated_at'])
    # Accepting the service request also approves invitation-only customers.
    if booking.customer_id:
        ensure_customer_membership(booking.organization, booking.customer, approve=True)
    if booking.availability_slot_id:
        slot = _lock_slot(booking.availability_slot)
        slot.refresh_status(save=True)
    from .message_services import post_booking_approval_message

    post_booking_approval_message(booking=booking, sender=staff_user)
    return booking


def _normalize_quote_questions(raw):
    questions = []
    if not raw:
        return questions
    if not isinstance(raw, list):
        raise ValidationError({'questions': 'Questions must be a list.'})
    for i, item in enumerate(raw):
        if isinstance(item, str):
            text = item.strip()
            if not text:
                continue
            questions.append({'id': f'q{i + 1}', 'question': text[:300], 'answer': ''})
            continue
        if not isinstance(item, dict):
            continue
        text = (item.get('question') or item.get('text') or '').strip()
        if not text:
            continue
        qid = (item.get('id') or f'q{i + 1}')[:40]
        answer = (item.get('answer') or '').strip()[:1000]
        questions.append({'id': qid, 'question': text[:300], 'answer': answer})
    return questions[:20]


def _merge_quote_questions(existing, incoming):
    """Prefer incoming question list; preserve prior answers when possible."""
    if incoming is None:
        return list(existing or [])
    normalized = _normalize_quote_questions(incoming)
    prior = list(existing or [])
    by_id = {str(q.get('id')): q for q in prior if q.get('id')}
    by_text = {(q.get('question') or '').strip().lower(): q for q in prior}
    for q in normalized:
        if not (q.get('answer') or '').strip():
            prev = by_id.get(str(q.get('id'))) or by_text.get((q.get('question') or '').strip().lower())
            if prev and (prev.get('answer') or '').strip():
                q['answer'] = prev['answer']
    return normalized


def booking_awaiting_quote_details(booking) -> bool:
    """True when provider asked questions and customer has not answered them all yet."""
    if booking.status != Booking.Status.REQUESTED:
        return False
    questions = booking.quote_questions or []
    if not questions:
        return False
    return any(
        (q.get('question') or '').strip() and not (q.get('answer') or '').strip()
        for q in questions
    )


def booking_quote_questions_all_answered(booking) -> bool:
    questions = booking.quote_questions or []
    if not questions:
        return False
    return all((q.get('answer') or '').strip() for q in questions if (q.get('question') or '').strip())


@transaction.atomic
def ask_booking_quote_questions(
    booking,
    *,
    staff_user,
    questions,
    message='',
):
    """
    Provider asks clarifying questions before pricing.

    This is not a quote — status stays/returns to REQUESTED and quote_amount is cleared.
    """
    if booking.status not in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
        raise ValidationError({'status': 'Only open requests can receive quote questions.'})
    normalized = _normalize_quote_questions(questions)
    if not normalized:
        raise ValidationError({'questions': 'Add at least one question for the customer.'})

    booking.quote_questions = _merge_quote_questions(booking.quote_questions, normalized)
    # Ensure the asked set still has at least one unanswered question for the customer.
    if not any(not (q.get('answer') or '').strip() for q in booking.quote_questions):
        # All questions already answered (re-ask same set) — clear answers for newly listed blanks only
        pass
    booking.quote_amount = None
    booking.quote_message = (message or '').strip()[:4000]
    booking.quoted_at = None
    booking.status = Booking.Status.REQUESTED
    booking.booked_by = staff_user
    booking.save(
        update_fields=[
            'quote_questions',
            'quote_amount',
            'quote_message',
            'quoted_at',
            'status',
            'booked_by',
            'updated_at',
        ]
    )
    return booking


@transaction.atomic
def answer_booking_quote_questions(booking, *, customer, answers):
    """Customer submits answers so the provider can send an accurate quote."""
    if booking.customer_id != customer.id:
        raise PermissionDenied('Only the customer can answer these questions.')
    if booking.status != Booking.Status.REQUESTED:
        raise ValidationError({'status': 'These questions are no longer open for answers.'})
    questions = list(booking.quote_questions or [])
    if not questions:
        raise ValidationError({'detail': 'There are no questions to answer on this request.'})

    by_id = {}
    if isinstance(answers, list):
        for item in answers:
            if isinstance(item, dict) and item.get('id'):
                by_id[str(item['id'])] = (item.get('answer') or '').strip()[:1000]
    elif isinstance(answers, dict):
        for k, v in answers.items():
            by_id[str(k)] = (v or '').strip()[:1000]

    for q in questions:
        qid = str(q.get('id') or '')
        if qid in by_id:
            q['answer'] = by_id[qid]

    missing = [q['question'] for q in questions if not (q.get('answer') or '').strip()]
    if missing:
        raise ValidationError({
            'answers': f'Please answer all questions ({len(missing)} remaining).',
        })

    booking.quote_questions = questions
    booking.save(update_fields=['quote_questions', 'updated_at'])
    return booking


@transaction.atomic
def send_booking_quote(
    booking,
    *,
    staff_user,
    amount,
    message='',
    questions=None,
    new_slot=None,
):
    """Provider sends a priced quote (optional already-answered questions + optional new time)."""
    if booking.status not in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
        raise ValidationError({'status': 'Only open requests can receive a quote.'})
    try:
        from decimal import Decimal, InvalidOperation

        amount = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({'amount': 'Enter a valid quote amount.'}) from exc
    if amount <= 0:
        raise ValidationError({'amount': 'Quote amount must be greater than zero.'})

    if new_slot is not None:
        reschedule_booking(booking, new_slot=new_slot, by_user=staff_user)
        booking.refresh_from_db()

    merged = _merge_quote_questions(booking.quote_questions, questions)
    unanswered = [
        q for q in merged
        if (q.get('question') or '').strip() and not (q.get('answer') or '').strip()
    ]
    if unanswered:
        raise ValidationError({
            'questions': (
                'Ask the customer to answer questions first (Ask questions), '
                'then send a priced quote. Unanswered questions cannot go out with a price.'
            ),
        })

    booking.quote_amount = amount
    booking.quote_message = (message or '').strip()[:4000]
    booking.quote_questions = merged
    booking.quoted_at = timezone.now()
    booking.status = Booking.Status.QUOTED
    booking.booked_by = staff_user
    booking.save(
        update_fields=[
            'quote_amount',
            'quote_message',
            'quote_questions',
            'quoted_at',
            'status',
            'booked_by',
            'updated_at',
        ]
    )
    if booking.availability_slot_id:
        slot = _lock_slot(booking.availability_slot)
        slot.refresh_status(save=True)
    return booking


@transaction.atomic
def accept_booking_quote(booking, *, customer, answers=None):
    if booking.status != Booking.Status.QUOTED:
        raise ValidationError({'status': 'Only quoted bookings can be accepted.'})
    if booking.customer_id != customer.id:
        raise PermissionDenied('Only the customer can accept this quote.')
    if booking.quote_amount is None:
        raise ValidationError({'detail': 'This quote has no amount yet.'})

    questions = list(booking.quote_questions or [])
    if answers:
        by_id = {}
        if isinstance(answers, list):
            for item in answers:
                if isinstance(item, dict) and item.get('id'):
                    by_id[str(item['id'])] = (item.get('answer') or '').strip()[:1000]
        for q in questions:
            qid = str(q.get('id') or '')
            if qid in by_id:
                q['answer'] = by_id[qid]

    booking.quote_questions = questions
    booking.status = Booking.Status.CONFIRMED
    _clear_provider_time_proposal(booking)
    booking.save(update_fields=[
        'quote_questions', 'status', 'awaiting_customer_acceptance',
        'prior_start_at', 'prior_end_at', 'prior_availability_slot', 'updated_at',
    ])
    ensure_customer_membership(booking.organization, customer, approve=True)
    if booking.availability_slot_id:
        slot = _lock_slot(booking.availability_slot)
        slot.refresh_status(save=True)
    return booking


@transaction.atomic
def decline_booking_request(booking):
    if booking.status not in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
        raise ValidationError({'status': 'Only requested or quoted bookings can be declined.'})
    booking.status = Booking.Status.CANCELLED
    _clear_provider_time_proposal(booking)
    booking.save(update_fields=[
        'status', 'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
        'prior_availability_slot', 'updated_at',
    ])
    if booking.availability_slot_id:
        release_slot(_lock_slot(booking.availability_slot))
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
        Booking.Status.QUOTED,
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
        release_slot(_lock_slot(booking.availability_slot))
    return booking


JOB_ACTION_EARLY_HOURS = 6


def earliest_job_action_at(booking):
    """First instant Start job / Mark complete are allowed (start_at minus 6 hours)."""
    if not booking.start_at:
        return None
    return booking.start_at - timedelta(hours=JOB_ACTION_EARLY_HOURS)


def _require_job_action_window(booking):
    earliest = earliest_job_action_at(booking)
    if earliest is None:
        return
    if timezone.now() < earliest:
        raise ValidationError({
            'status': (
                'This job can be started or completed from 6 hours before '
                'the scheduled time.'
            ),
        })


@transaction.atomic
def start_booking(booking, *, staff_user):
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Only confirmed bookings can be started.'})
    _require_job_action_window(booking)
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
    _require_job_action_window(booking)
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
    if booking.availability_slot_id:
        # Completed jobs free a seat so remaining capacity can be booked again.
        release_slot(_lock_slot(booking.availability_slot))
    return booking


@transaction.atomic
def reschedule_booking(booking, *, new_slot, by_user):
    if booking.status not in (
        Booking.Status.REQUESTED,
        Booking.Status.QUOTED,
        Booking.Status.CONFIRMED,
    ):
        raise ValidationError({'status': 'Only active bookings can be rescheduled.'})
    new_slot = _lock_slot(new_slot)
    if not new_slot.is_bookable():
        raise ValidationError({'slot_id': 'The new slot is not available.'})
    if new_slot.organization_id != booking.organization_id:
        raise ValidationError({'slot_id': 'Slot must belong to the same business.'})
    if new_slot.service_id and new_slot.service_id != booking.service_id:
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
    if is_customer and customer_is_blocked(booking.organization, by_user):
        raise PermissionDenied(
            'You cannot book with this business. Contact them if you think this is a mistake.'
        )
    # Same cutoff as cancel: customers may not reschedule confirmed bookings inside the window.
    if is_customer and booking.status == Booking.Status.CONFIRMED:
        cutoff = int(getattr(booking.organization, 'cancel_cutoff_hours', 0) or 0)
        if cutoff > 0:
            hours_left = (booking.start_at - timezone.now()).total_seconds() / 3600
            if hours_left < cutoff:
                raise ValidationError({
                    'status': (
                        f'This business does not allow rescheduling within '
                        f'{cutoff} hours of the appointment. Contact them if you need help.'
                    ),
                })
    if is_customer:
        assert_slot_bookable_for_customer(new_slot)
    elif new_slot.start_at <= timezone.now():
        raise ValidationError({'slot_id': 'Cannot reschedule to a past slot.'})
    old_slot = booking.availability_slot
    prior_start = booking.start_at
    prior_end = booking.end_at
    if old_slot and old_slot.pk != new_slot.pk:
        old_slot = _lock_slot(old_slot)
    booking.availability_slot = new_slot
    booking.start_at = new_slot.start_at
    booking.end_at = new_slot.end_at
    booking.reminder_sent_at = None
    # Customer reschedules always go back to the provider for approval, even if the
    # original booking was already confirmed or the business uses instant booking.
    if is_customer:
        booking.status = Booking.Status.REQUESTED
        booking.awaiting_customer_acceptance = False
        booking.prior_start_at = None
        booking.prior_end_at = None
        booking.prior_availability_slot = None
        booking.save(update_fields=[
            'availability_slot', 'start_at', 'end_at', 'status', 'reminder_sent_at',
            'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
            'prior_availability_slot', 'updated_at',
        ])
    else:
        # Provider proposes a new time — customer must accept before it is fixed.
        booking.prior_start_at = prior_start
        booking.prior_end_at = prior_end
        booking.prior_availability_slot = old_slot
        booking.awaiting_customer_acceptance = True
        if booking_requires_quote(booking.organization, booking.service):
            booking.status = (
                Booking.Status.QUOTED
                if booking.quote_amount is not None
                else Booking.Status.REQUESTED
            )
        else:
            booking.status = Booking.Status.REQUESTED
        booking.save(update_fields=[
            'availability_slot', 'start_at', 'end_at', 'status', 'reminder_sent_at',
            'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
            'prior_availability_slot', 'updated_at',
        ])
    new_slot.refresh_status(save=True)
    if old_slot and old_slot.pk != new_slot.pk:
        release_slot(old_slot)
    return booking


def _clear_provider_time_proposal(booking):
    booking.awaiting_customer_acceptance = False
    booking.prior_start_at = None
    booking.prior_end_at = None
    booking.prior_availability_slot = None


@transaction.atomic
def accept_provider_time_change(booking, *, customer):
    """Customer accepts a provider-proposed time change (fixed-price path)."""
    if booking.customer_id != customer.id:
        raise PermissionDenied('Only the customer can accept this time change.')
    if not booking.awaiting_customer_acceptance:
        raise ValidationError({'status': 'There is no pending time change to accept.'})
    if booking_requires_quote(booking.organization, booking.service):
        if booking.status == Booking.Status.QUOTED:
            raise ValidationError({
                'status': 'Accept the quote to confirm this booking and the new time.',
            })
        raise ValidationError({
            'status': 'Wait for the provider to send a quote, then accept it to confirm.',
        })
    if booking.status not in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
        raise ValidationError({'status': 'This booking cannot be confirmed right now.'})
    booking.status = Booking.Status.CONFIRMED
    _clear_provider_time_proposal(booking)
    booking.save(update_fields=[
        'status', 'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
        'prior_availability_slot', 'updated_at',
    ])
    ensure_customer_membership(booking.organization, customer, approve=True)
    if booking.availability_slot_id:
        slot = _lock_slot(booking.availability_slot)
        slot.refresh_status(save=True)
    return booking


@transaction.atomic
def decline_provider_time_change(booking, *, customer):
    """
    Customer rejects a provider time change.
    Prefer reverting to the prior slot when it is still free; otherwise cancel.
    """
    if booking.customer_id != customer.id:
        raise PermissionDenied('Only the customer can decline this time change.')
    if not booking.awaiting_customer_acceptance:
        raise ValidationError({'status': 'There is no pending time change to decline.'})

    prior_slot = booking.prior_availability_slot
    prior_start = booking.prior_start_at
    prior_end = booking.prior_end_at
    current_slot = booking.availability_slot

    if prior_slot and prior_start and prior_end:
        prior_slot = _lock_slot(prior_slot)
        if current_slot and prior_slot.pk == current_slot.pk:
            _clear_provider_time_proposal(booking)
            booking.status = Booking.Status.CONFIRMED
            booking.save(update_fields=[
                'status', 'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
                'prior_availability_slot', 'updated_at',
            ])
            return booking
        if prior_slot.remaining_capacity() > 0:
            if current_slot:
                current_slot = _lock_slot(current_slot)
            booking.availability_slot = prior_slot
            booking.start_at = prior_start
            booking.end_at = prior_end
            booking.status = Booking.Status.CONFIRMED
            _clear_provider_time_proposal(booking)
            booking.save(update_fields=[
                'availability_slot', 'start_at', 'end_at', 'status',
                'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
                'prior_availability_slot', 'updated_at',
            ])
            prior_slot.refresh_status(save=True)
            if current_slot:
                release_slot(current_slot)
            return booking

    # Cannot revert — cancel the booking.
    booking.status = Booking.Status.CANCELLED
    _clear_provider_time_proposal(booking)
    booking.save(update_fields=[
        'status', 'awaiting_customer_acceptance', 'prior_start_at', 'prior_end_at',
        'prior_availability_slot', 'updated_at',
    ])
    if current_slot:
        release_slot(_lock_slot(current_slot))
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
        release_slot(_lock_slot(booking.availability_slot))
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
    new_slot = _lock_slot(new_slot)
    if not new_slot.is_bookable():
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
    new_slot.refresh_status(save=True)
    return return_booking


def booking_needs_attendance_prompt(booking, *, now=None):
    """After end_at, ask the customer if the provider showed up (confirmed jobs only)."""
    if booking.status != Booking.Status.CONFIRMED:
        return False
    if booking.customer_confirmed_attendance_at or booking.customer_reported_no_show_at:
        return False
    now = now or timezone.now()
    return now > booking.end_at


@transaction.atomic
def customer_report_provider_attendance(booking, *, customer, showed_up):
    if booking.customer_id != customer.id:
        raise PermissionDenied('Only the customer can report attendance for this booking.')
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({
            'status': 'Attendance can only be reported for confirmed appointments.',
        })
    now = timezone.now()
    if now <= booking.end_at:
        raise ValidationError({
            'status': 'You can report attendance after the scheduled appointment time.',
        })
    if booking.customer_confirmed_attendance_at or booking.customer_reported_no_show_at:
        raise ValidationError({'detail': 'Attendance was already recorded for this appointment.'})

    if showed_up:
        booking.customer_confirmed_attendance_at = now
        booking.save(update_fields=['customer_confirmed_attendance_at', 'updated_at'])
        return booking

    booking.customer_reported_no_show_at = now
    booking.save(update_fields=['customer_reported_no_show_at', 'updated_at'])
    from .booking_audit import log_booking_event
    from .notifications import create_provider_customer_no_show_report_notification

    log_booking_event(
        booking,
        action=BookingStatusEvent.Action.CUSTOMER_NO_SHOW_REPORTED,
        actor=customer,
        old_status=booking.status,
        new_status=booking.status,
        note='Customer reported provider did not show up',
    )
    create_provider_customer_no_show_report_notification(booking)
    return booking
