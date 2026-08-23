import logging

from django.conf import settings
from django.core.mail import EmailMessage, send_mail
from django.utils import timezone

from businesses.models import Organization

from .datetime_display import format_booking_when
from .models import CustomerNotification, ProviderNotification, Service

logger = logging.getLogger(__name__)


def _public_app_url():
    return getattr(settings, 'PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')


def provider_booking_detail_url(org_slug, booking_id):
    return f'{_public_app_url()}/provider/{org_slug}/schedule/booking/{booking_id}'


def provider_request_link_path(org_slug, booking_id):
    """In-app path to the request detail where staff can approve / act."""
    return f'/provider/{org_slug}/requests/booking/{booking_id}'


def provider_messages_link_path(org_slug, *, booking_id=None, inquiry_id=None, conversation_id=None):
    """In-app Messages inbox, optionally deep-linked to a conversation."""
    base = f'/provider/{org_slug}/messages'
    if conversation_id:
        return f'{base}?conversation={conversation_id}'
    if booking_id:
        return f'{base}?booking={booking_id}'
    if inquiry_id:
        return f'{base}?inquiry={inquiry_id}'
    return base


def customer_appointment_url(booking):
    return booking.customer_view_url()


def customer_bookings_url():
    return f'{_public_app_url()}/customer/bookings'


def customer_history_url():
    return f'{_public_app_url()}/customer/history'


def _format_when(dt):
    return format_booking_when(dt)


def _provider_staff_emails(org):
    return [
        e
        for e in org.memberships.filter(role__in=('owner', 'staff'))
        .select_related('user')
        .values_list('user__email', flat=True)
        if e
    ]


def _customer_label(booking):
    return booking.customer.full_name or booking.customer.email


def _job_location_lines(booking):
    if not booking.service_address:
        return []
    kind = getattr(booking.service, 'fulfillment_kind', None) if booking.service_id else None
    if kind == Service.FulfillmentKind.SHOP:
        return [f'Job location (come to the shop): {booking.service_address}']
    return [f'Job location (we come to you): {booking.service_address}']


def _booking_detail_lines(booking, *, include_address=False):
    service_name = booking.service.name if booking.service_id else 'Service'
    lines = [
        f'Service: {service_name}',
        f'When: {_format_when(booking.start_at)}',
        f'Customer: {_customer_label(booking)}',
    ]
    if booking.customer.phone:
        lines.append(f'Phone: {booking.customer.phone}')
    if include_address:
        lines.extend(_job_location_lines(booking))
    if booking.customer_notes:
        lines.append(f'Notes: {booking.customer_notes}')
    return lines


# Cleared when the customer opens that booking's detail (not new_message).
CUSTOMER_BOOKING_UPDATE_KINDS = (
    CustomerNotification.Kind.BOOKING_CONFIRMED,
    CustomerNotification.Kind.BOOKING_DECLINED,
    CustomerNotification.Kind.BOOKING_CANCELLED,
    CustomerNotification.Kind.BOOKING_RESCHEDULED,
    CustomerNotification.Kind.BOOKING_TIME_CHANGE,
    CustomerNotification.Kind.BOOKING_COMPLETED,
    CustomerNotification.Kind.INVOICE_READY,
    CustomerNotification.Kind.PAYMENT_CONFIRMED,
    CustomerNotification.Kind.QUOTE_DETAILS_REQUESTED,
)

# Cleared when provider staff open that booking's request/schedule detail.
PROVIDER_BOOKING_UPDATE_KINDS = (
    ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
    ProviderNotification.Kind.CUSTOMER_CANCELLED_BOOKING,
    ProviderNotification.Kind.CUSTOMER_RESCHEDULE_REQUEST,
    ProviderNotification.Kind.QUOTE_ACCEPTED,
    ProviderNotification.Kind.QUOTE_ANSWERS_RECEIVED,
    ProviderNotification.Kind.PAYMENT_RECEIVED,
)


def dismiss_booking_update_notifications(*, booking, user):
    """Mark booking-related in-app alerts read when the user opens that booking.

    Mirrors mark_booking_messages_read for new_message: viewing the booking
    clears only that booking's update alerts (not other bookings, not messages).
    """
    from .permissions import is_org_staff

    now = timezone.now()
    if booking.customer_id == user.id:
        CustomerNotification.objects.filter(
            customer_id=booking.customer_id,
            booking=booking,
            kind__in=CUSTOMER_BOOKING_UPDATE_KINDS,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)
    elif is_org_staff(user, booking.organization):
        ProviderNotification.objects.filter(
            organization_id=booking.organization_id,
            booking=booking,
            kind__in=PROVIDER_BOOKING_UPDATE_KINDS,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)


def create_customer_notification(
    *,
    customer,
    kind,
    title,
    message,
    organization=None,
    booking=None,
    inquiry=None,
    link_path='',
):
    """Create an in-app customer alert (shown after login on Home)."""
    if not customer:
        return None
    path = link_path or (
        f'/customer/bookings/{booking.pk}' if booking is not None else '/customer/bookings'
    )
    n = CustomerNotification.objects.create(
        customer=customer,
        organization=organization,
        booking=booking,
        inquiry=inquiry,
        kind=kind,
        title=title[:200],
        message=message[:500],
        link_path=path,
    )
    try:
        from .push_services import send_push_to_user

        send_push_to_user(customer, title=n.title, body=n.message, link_path=n.link_path)
    except Exception:
        logger.exception('Customer push failed for notification %s', n.pk)
    return n


def _push_org_staff(organization, *, title, body, link_path=''):
    try:
        from .push_services import send_push_to_org_staff

        send_push_to_org_staff(organization, title=title, body=body, link_path=link_path)
    except Exception:
        logger.exception('Provider push failed for org %s', getattr(organization, 'pk', None))


def notify_customer_provider_direct(booking):
    """Customer confirmation after staff books on their behalf. Do not ping staff."""
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        title=f'Booking confirmed — {booking.organization.name}',
        message=(
            f'{booking.organization.name} booked '
            f'{booking.service.name if booking.service_id else "a service"} '
            f'for you on {_format_when(booking.start_at)}.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path=booking.customer_view_path(),
    )
    send_booking_email('booking_confirmed', booking)


def notify_customer_booking_created(booking):
    """Email provider staff and the customer after a customer books a slot."""
    from .models import Booking

    create_provider_booking_notification(booking)
    if booking.status == Booking.Status.CONFIRMED:
        send_booking_email('booking_new_to_provider', booking)
        create_customer_notification(
            customer=booking.customer,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
            title=f'Booking confirmed — {booking.organization.name}',
            message=(
                f'Your appointment for '
                f'{booking.service.name if booking.service_id else "a service"} '
                f'on {_format_when(booking.start_at)} is confirmed.'
            ),
            organization=booking.organization,
            booking=booking,
        )
        send_booking_email('booking_confirmed', booking)
    else:
        send_booking_email('booking_requested', booking)


def create_provider_booking_notification(booking):
    """Create an in-app provider alert when a customer finishes booking."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    action = 'booked' if booking.status == booking.Status.CONFIRMED else 'requested'
    org = booking.organization
    ProviderNotification.objects.create(
        organization=org,
        booking=booking,
        kind=ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
        message=(
            f'{customer_name} {action} {service_name} for {_format_when(booking.start_at)}. '
            'Open Service requests to review or manage it.'
        ),
        link_path=provider_request_link_path(org.slug, booking.pk),
    )
    _push_org_staff(
        org,
        title=f'New booking — {org.name}',
        body=f'{customer_name} {action} {service_name}.',
        link_path=provider_request_link_path(org.slug, booking.pk),
    )


def create_provider_customer_cancel_notification(booking):
    """In-app alert when a customer cancels a booking."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    org = booking.organization
    ProviderNotification.objects.create(
        organization=org,
        booking=booking,
        kind=ProviderNotification.Kind.CUSTOMER_CANCELLED_BOOKING,
        message=(
            f'{customer_name} cancelled {service_name} '
            f'(was {_format_when(booking.start_at)}). '
            'Open Service requests if you need to follow up.'
        ),
        link_path=provider_request_link_path(org.slug, booking.pk),
    )
    _push_org_staff(
        org,
        title=f'Booking cancelled — {org.name}',
        body=f'{customer_name} cancelled {service_name}.',
        link_path=provider_request_link_path(org.slug, booking.pk),
    )


def create_provider_customer_reschedule_notification(booking):
    """In-app alert when a customer asks to reschedule."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    org = booking.organization
    ProviderNotification.objects.create(
        organization=org,
        booking=booking,
        kind=ProviderNotification.Kind.CUSTOMER_RESCHEDULE_REQUEST,
        message=(
            f'{customer_name} asked to reschedule {service_name} '
            f'to {_format_when(booking.start_at)}. '
            'Open Service requests to review or approve.'
        ),
        link_path=provider_request_link_path(org.slug, booking.pk),
    )


def notify_booking_cancelled(booking, *, by_user=None):
    """
    Notify parties when a booking is cancelled.
    Always emails the customer; emails provider staff as well.
    When the customer cancels, also create an in-app provider alert.
    When staff cancels, also leave an in-thread note for the customer.
    """
    from .permissions import is_org_staff

    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_CANCELLED,
        title=f'Booking cancelled — {booking.organization.name}',
        message=(
            f'Your appointment for '
            f'{booking.service.name if booking.service_id else "a service"} '
            f'on {_format_when(booking.start_at)} was cancelled.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path='/customer/history',
    )
    send_booking_email('booking_cancelled', booking)

    if by_user is None:
        return

    # Customer cancelled → in-app alert for the business
    if booking.customer_id == by_user.id:
        create_provider_customer_cancel_notification(booking)
        return

    if not is_org_staff(by_user, booking.organization):
        return
    try:
        from .message_services import post_booking_cancellation_message

        post_booking_cancellation_message(booking=booking, sender=by_user)
    except Exception:
        logger.exception(
            'Failed to post cancellation message for booking %s', booking.pk
        )


def notify_booking_accepted(booking):
    service_name = booking.service.name if booking.service_id else 'Service'
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        title=f'Booking approved — {booking.organization.name}',
        message=(
            f'{booking.organization.name} approved your request for {service_name} '
            f'on {_format_when(booking.start_at)}.'
        ),
        organization=booking.organization,
        booking=booking,
    )
    send_booking_email('booking_confirmed', booking)


def create_provider_quote_accepted_notification(booking):
    """In-app alert when a customer accepts a quote."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    amount = booking.quote_amount
    amount_txt = f'${amount}' if amount is not None else 'your quote'
    org = booking.organization
    ProviderNotification.objects.create(
        organization=org,
        booking=booking,
        kind=ProviderNotification.Kind.QUOTE_ACCEPTED,
        message=(
            f'{customer_name} accepted {amount_txt} for {service_name} '
            f'on {_format_when(booking.start_at)}. '
            'The booking is confirmed — open Service requests to review.'
        ),
        link_path=provider_request_link_path(org.slug, booking.pk),
    )


def notify_quote_accepted(booking):
    """Notify both sides after the customer accepts a quote (booking confirmed)."""
    service_name = booking.service.name if booking.service_id else 'Service'
    amount = booking.quote_amount
    amount_txt = f'${amount}' if amount is not None else 'the quote'
    create_provider_quote_accepted_notification(booking)
    send_booking_email('quote_accepted', booking)
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        title=f'Quote accepted — {booking.organization.name}',
        message=(
            f'You accepted {amount_txt} for {service_name} on '
            f'{_format_when(booking.start_at)}. Your booking is confirmed.'
        ),
        organization=booking.organization,
        booking=booking,
    )
    send_booking_email('booking_confirmed', booking)


def notify_booking_quoted(booking):
    service_name = booking.service.name if booking.service_id else 'Service'
    amount = booking.quote_amount
    amount_txt = f'${amount}' if amount is not None else 'a price'
    when = _format_when(booking.start_at)
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        title=f'Quote ready — {booking.organization.name}',
        message=(
            f'{booking.organization.name} quoted {amount_txt} for {service_name} on {when}. '
            f'Open Bookings to accept or decline.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path=f'/customer/bookings/{booking.pk}',
    )
    send_booking_email('booking_quoted', booking)


def notify_quote_details_requested(booking):
    """Customer: answer questions so the provider can price the job accurately."""
    service_name = booking.service.name if booking.service_id else 'Service'
    n = len(booking.quote_questions or [])
    q_label = 'a question' if n == 1 else f'{n} questions'
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.QUOTE_DETAILS_REQUESTED,
        title=f'Answer questions — {booking.organization.name}',
        message=(
            f'{booking.organization.name} needs you to answer {q_label} about {service_name} '
            f'before they can send an accurate quote. Open Bookings to reply.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path=f'/customer/bookings/{booking.pk}',
    )
    send_booking_email('quote_details_requested', booking)


def notify_quote_answers_received(booking):
    """Provider: customer answered clarifying questions — ready to price."""
    service_name = booking.service.name if booking.service_id else 'Service'
    ProviderNotification.objects.create(
        organization=booking.organization,
        booking=booking,
        kind=ProviderNotification.Kind.QUOTE_ANSWERS_RECEIVED,
        message=(
            f'{_customer_label(booking)} answered your questions for {service_name}. '
            f'Open the request to send a quote.'
        ),
        link_path=provider_request_link_path(booking.organization.slug, booking.pk),
    )


def notify_booking_declined(booking):
    service_name = booking.service.name if booking.service_id else 'Service'
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_DECLINED,
        title=f'Booking declined — {booking.organization.name}',
        message=(
            f'{booking.organization.name} declined your request for {service_name} '
            f'on {_format_when(booking.start_at)}.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path='/customer/history',
    )
    send_booking_email('booking_declined', booking)


def notify_booking_rescheduled_by_provider(booking):
    service_name = booking.service.name if booking.service_id else 'Service'
    new_when = _format_when(booking.start_at)
    if booking.prior_start_at:
        old_when = _format_when(booking.prior_start_at)
        change_line = f'New time: {new_when} (was {old_when}).'
    else:
        change_line = f'New time: {new_when}.'

    quote_line = ''
    if booking.quote_amount is not None:
        quote_line = f' Quote: ${booking.quote_amount}.'
    else:
        pricing = getattr(booking.service, 'pricing_type', None) if booking.service_id else None
        needs_quote = (
            Service.pricing_requires_quote(pricing)
            or booking.organization.booking_policy == Organization.BookingPolicy.QUOTE
        )
        if needs_quote:
            quote_line = ' A quote will follow before you can confirm.'

    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_TIME_CHANGE,
        title=f'New time proposed — {booking.organization.name}',
        message=(
            f'{booking.organization.name} proposed a new time for {service_name}. '
            f'{change_line}{quote_line} Review and accept in Bookings.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path='/customer/bookings',
    )
    send_booking_email('booking_time_change_proposed', booking)


def notify_booking_completed(booking):
    service_name = booking.service.name if booking.service_id else 'Service'
    create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.BOOKING_COMPLETED,
        title=f'Job complete — invoice from {booking.organization.name}',
        message=(
            f'Your {service_name} job is done. Check your email for the invoice, '
            f'or open History in the app.'
        ),
        organization=booking.organization,
        booking=booking,
        link_path='/customer/history',
    )
    send_booking_email('booking_completed', booking)


def notify_invoice_ready(booking):
    """Create or refresh the customer's actionable invoice notification."""
    service_name = booking.service.name if booking.service_id else 'Service'
    existing = (
        CustomerNotification.objects.filter(
            customer=booking.customer,
            booking=booking,
            kind=CustomerNotification.Kind.INVOICE_READY,
            dismissed_at__isnull=True,
        )
        .order_by('-created_at')
        .first()
    )
    title = f'Invoice ready — {booking.organization.name}'
    message = f'Your invoice for {service_name} is ready. Pay securely in Luminexa.'
    if existing:
        existing.title = title
        existing.message = message
        existing.link_path = '/customer/history'
        existing.save(update_fields=['title', 'message', 'link_path'])
        return existing
    return create_customer_notification(
        customer=booking.customer,
        kind=CustomerNotification.Kind.INVOICE_READY,
        title=title,
        message=message,
        organization=booking.organization,
        booking=booking,
        link_path='/customer/history',
    )


def notify_invoice_paid(invoice):
    """Confirm an online payment to both customer and provider."""
    booking = invoice.booking
    amount = f'{invoice.amount:.2f} {invoice.currency or "CAD"}'
    CustomerNotification.objects.filter(
        customer=booking.customer,
        booking=booking,
        kind=CustomerNotification.Kind.INVOICE_READY,
        dismissed_at__isnull=True,
    ).update(dismissed_at=timezone.now())
    _, created = CustomerNotification.objects.get_or_create(
        customer=booking.customer,
        booking=booking,
        kind=CustomerNotification.Kind.PAYMENT_CONFIRMED,
        defaults={
            'organization': booking.organization,
            'title': f'Payment confirmed — {booking.organization.name}',
            'message': f'Your payment of {amount} for invoice {invoice.number} was successful.',
            'link_path': '/customer/history',
        },
    )
    if created:
        try:
            from .push_services import send_push_to_user

            send_push_to_user(
                booking.customer,
                title=f'Payment confirmed — {booking.organization.name}',
                body=f'Your payment of {amount} for invoice {invoice.number} was successful.',
                link_path='/customer/history',
            )
        except Exception:
            logger.exception('Customer payment push failed for booking %s', booking.pk)
    customer_name = _customer_label(booking)
    org = booking.organization
    _, provider_created = ProviderNotification.objects.get_or_create(
        organization=org,
        booking=booking,
        kind=ProviderNotification.Kind.PAYMENT_RECEIVED,
        defaults={
            'message': (
                f'Payment received: {customer_name} paid {amount} '
                f'for invoice {invoice.number}.'
            ),
            'link_path': provider_request_link_path(org.slug, booking.pk),
        },
    )
    if provider_created:
        _push_org_staff(
            org,
            title=f'Payment received — {org.name}',
            body=f'{customer_name} paid {amount}.',
            link_path=provider_request_link_path(org.slug, booking.pk),
        )


def send_invoice_email(booking):
    """Email the customer the invoice PDF (used when invoice is re-issued)."""
    send_booking_email('booking_completed', booking)


def send_booking_email(event, booking):
    """Send booking lifecycle email; failures are logged, not raised."""
    org = booking.organization
    service_name = booking.service.name if booking.service_id else 'Service'
    when = _format_when(booking.start_at)
    provider_url = provider_booking_detail_url(org.slug, booking.id)
    bookings_url = customer_bookings_url()
    history_url = customer_history_url()

    recipients = []
    subject = ''
    body_lines = []
    attachments = []

    if event == 'booking_new_to_provider':
        recipients = _provider_staff_emails(org)
        subject = f'New booking — {service_name}'
        body_lines = [
            f'A customer booked {service_name}.',
            *_booking_detail_lines(booking, include_address=True),
            '',
            f'Open in Luminexa: {provider_url}',
        ]
    elif event == 'booking_requested':
        recipients = _provider_staff_emails(org)
        subject = f'New booking request — {service_name}'
        body_lines = [
            f'A customer requested {service_name}.',
            *_booking_detail_lines(booking, include_address=True),
            '',
            f'Open in Luminexa: {provider_url}',
        ]
        if booking.customer.email:
            _send_to(
                booking.customer.email,
                f'Booking request sent — {org.name}',
                [
                    f'Your request for {service_name} at {org.name} was submitted.',
                    f'When: {when}',
                    'The business will confirm your appointment.',
                    '',
                    f'View bookings: {bookings_url}',
                ],
            )
    elif event == 'booking_quoted':
        amount = booking.quote_amount
        amount_txt = f'${amount}' if amount is not None else 'a price'
        msg = (booking.quote_message or '').strip()
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Your quote from {org.name} is ready'
        body_lines = [
            f'{org.name} sent a quote for {service_name}.',
            f'Quoted price: {amount_txt}',
            f'Appointment: {when}',
        ]
        if msg:
            body_lines.extend(['', 'Note from the business:', msg])
        body_lines.extend([
            '',
            'Open your bookings to accept the quote and confirm, or decline if it does not work.',
            f'View bookings: {bookings_url}',
        ])
    elif event == 'quote_details_requested':
        msg = (booking.quote_message or '').strip()
        questions = [
            (q.get('question') or '').strip()
            for q in (booking.quote_questions or [])
            if (q.get('question') or '').strip() and not (q.get('answer') or '').strip()
        ]
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'{org.name} needs a few details for your quote'
        body_lines = [
            f'{org.name} asked you to answer questions about {service_name} so they can send an accurate quote.',
            f'Appointment: {when}',
        ]
        if questions:
            body_lines.extend(['', 'Questions:'])
            body_lines.extend([f'• {q}' for q in questions[:20]])
        if msg:
            body_lines.extend(['', 'Note from the business:', msg])
        body_lines.extend([
            '',
            'Open your bookings to answer, then the business will send your quote.',
            f'View bookings: {bookings_url}',
        ])
    elif event == 'quote_accepted':
        amount = booking.quote_amount
        amount_txt = f'${amount}' if amount is not None else 'your quote'
        recipients = _provider_staff_emails(org)
        subject = f'Quote accepted — {service_name}'
        body_lines = [
            f'{_customer_label(booking)} accepted {amount_txt} for {service_name}.',
            'The booking is now confirmed.',
            *_booking_detail_lines(booking, include_address=True),
            '',
            f'Open in Luminexa: {provider_url}',
        ]
    elif event == 'booking_reschedule_requested':
        recipients = _provider_staff_emails(org)
        subject = f'Reschedule request — {service_name}'
        body_lines = [
            f'A customer asked to reschedule {service_name}.',
            *_booking_detail_lines(booking, include_address=True),
            '',
            f'Open in Luminexa: {provider_url}',
        ]
        if booking.customer.email:
            _send_to(
                booking.customer.email,
                f'Reschedule request sent — {org.name}',
                [
                    f'Your reschedule request for {service_name} at {org.name} was submitted.',
                    f'New time: {when}',
                    'The business will confirm your new appointment time.',
                    '',
                    f'View bookings: {bookings_url}',
                ],
            )
    elif event == 'booking_confirmed':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Booking confirmed — {org.name}'
        body_lines = [
            f'Your appointment for {service_name} is confirmed.',
            f'When: {when}',
            f'Business: {org.name}',
            *_job_location_lines(booking),
            '',
            f'View your appointment: {customer_appointment_url(booking)}',
        ]
    elif event == 'booking_rescheduled':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Booking rescheduled — {org.name}'
        body_lines = [
            f'Your appointment for {service_name} was rescheduled.',
            f'New time: {when}',
            f'Business: {org.name}',
            *_job_location_lines(booking),
            '',
            f'View your bookings: {bookings_url}',
        ]
    elif event == 'booking_time_change_proposed':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'New time proposed — {org.name}'
        body_lines = [
            f'{org.name} proposed a new time for {service_name}.',
            f'Proposed time: {when}',
        ]
        if booking.prior_start_at:
            body_lines.append(f'Previous time: {_format_when(booking.prior_start_at)}')
        if booking.quote_amount is not None:
            body_lines.append(f'Quote: ${booking.quote_amount}')
            if (booking.quote_message or '').strip():
                body_lines.extend(['', 'Note from the business:', booking.quote_message.strip()])
            body_lines.extend([
                '',
                'Open Bookings to review the quote and new time, then accept or decline.',
            ])
        else:
            pricing = getattr(booking.service, 'pricing_type', None) if booking.service_id else None
            needs_quote = (
                Service.pricing_requires_quote(pricing)
                or org.booking_policy == Organization.BookingPolicy.QUOTE
            )
            if needs_quote:
                body_lines.append('The business will send a quote before you can confirm.')
            else:
                body_lines.append('Open Bookings to accept or decline this new time.')
        body_lines.extend([
            *_job_location_lines(booking),
            '',
            f'View your bookings: {bookings_url}',
        ])
    elif event == 'booking_declined':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Booking declined — {org.name}'
        body_lines = [
            f'Your request for {service_name} was declined.',
            f'When: {when}',
            '',
            f'Browse other options: {_public_app_url()}/customer/find',
        ]
    elif event == 'booking_cancelled':
        staff = _provider_staff_emails(org)
        customer_email = booking.customer.email
        if customer_email:
            _send_to(
                customer_email,
                f'Booking cancelled — {org.name}',
                [
                    f'Your appointment for {service_name} has been cancelled.',
                    f'When: {when}',
                    f'Business: {org.name}',
                    '',
                    f'View your bookings: {bookings_url}',
                ],
            )
        recipients = staff
        subject = f'Booking cancelled — {service_name}'
        body_lines = [
            f'The booking for {service_name} on {when} was cancelled.',
            f'Customer: {booking.customer.full_name or booking.customer.email}',
            f'View: {provider_url}',
        ]
    elif event == 'booking_completed':
        ref = f'BK-{booking.pk:05d}'
        review_url = (
            f'{_public_app_url()}/book/{org.public_ref}/services/{booking.service_id}'
            if booking.service_id
            else None
        )
        customer_lines = [
            f'Your job is complete — {org.name}',
            f'Reference: {ref}',
            f'Service: {service_name}',
            f'Date: {when}',
        ]
        try:
            inv = booking.invoice
            customer_lines.append(f'Invoice: {inv.number}')
            customer_lines.append(f'Amount: ${inv.amount:,.2f}')
            pdf_bytes = _invoice_pdf_bytes(inv)
            if pdf_bytes:
                attachments.append(
                    (f'invoice-{inv.number}.pdf', pdf_bytes, 'application/pdf')
                )
        except Exception:
            if booking.service_id and hasattr(booking, 'service') and booking.service.base_price:
                price = booking.service.base_price
                customer_lines.append(f'Price: ${price:,.2f}')
        customer_lines += [
            '',
            'Your invoice PDF is attached to this email.' if attachments else '',
            f'Thank you for choosing {org.name}!',
            '',
            f'View in app: {history_url}',
        ]
        if review_url:
            customer_lines += [
                '',
                'How was your experience? Leave a review:',
                review_url,
            ]
        if booking.customer.email:
            _send_to(
                booking.customer.email,
                f'Service complete — invoice from {org.name}',
                [line for line in customer_lines if line is not None],
                attachments=attachments,
            )
        recipients = _provider_staff_emails(org)
        subject = f'Job completed — {service_name} ({ref})'
        body_lines = [
            f'Booking {ref} is marked complete.',
            *_booking_detail_lines(booking),
            '',
            f'View: {provider_booking_detail_url(org.slug, booking.id)}',
        ]
    elif event == 'booking_reminder':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Reminder: appointment tomorrow — {org.name}'
        body_lines = [
            f'Your appointment for {service_name} is coming up.',
            f'When: {when}',
            f'Business: {org.name}',
            *_job_location_lines(booking),
            '',
            f'View bookings: {bookings_url}',
        ]
    else:
        return

    if not recipients:
        return
    body = '\n'.join(line for line in body_lines if line)
    _send_to(recipients, subject, body.split('\n'))


def _invoice_pdf_bytes(invoice):
    try:
        from .invoice_pdf import build_invoice_pdf

        return build_invoice_pdf(invoice)
    except Exception:
        logger.exception('Failed to build invoice PDF for invoice %s', getattr(invoice, 'pk', None))
        return None


def _send_to(recipients, subject, body_lines, attachments=None):
    if isinstance(recipients, str):
        recipients = [recipients]
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    body = '\n'.join(line for line in body_lines if line is not None)
    try:
        if attachments:
            msg = EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=recipients,
            )
            for filename, content, mimetype in attachments:
                msg.attach(filename, content, mimetype)
            msg.send(fail_silently=False)
        else:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False,
            )
    except Exception:
        logger.exception('Failed to send email to %s: %s', recipients, subject)


def send_booking_reminders_for_window(*, hours_ahead=24, window_hours=1):
    """Email customers with confirmed bookings starting in ~24 hours (once per booking)."""
    from datetime import timedelta

    from .models import Booking

    now = timezone.now()
    window_start = now + timedelta(hours=hours_ahead)
    window_end = window_start + timedelta(hours=window_hours)
    sent = 0
    bookings = Booking.objects.filter(
        status=Booking.Status.CONFIRMED,
        reminder_sent_at__isnull=True,
        start_at__gte=window_start,
        start_at__lt=window_end,
    ).select_related('organization', 'service', 'customer')
    for booking in bookings:
        send_booking_email('booking_reminder', booking)
        booking.reminder_sent_at = now
        booking.save(update_fields=['reminder_sent_at'])
        sent += 1
    return sent


DEFAULT_INVOICE_FOLLOWUP_DAYS = (3, 7, 14)


def send_unpaid_invoice_followups():
    """Email payment reminders for unpaid invoices based on org cadence settings."""
    from datetime import timedelta

    from businesses.models import Organization

    from .models import Invoice

    now = timezone.now()
    sent = 0
    orgs = Organization.objects.filter(is_active=True, invoice_followup_enabled=True)
    for org in orgs:
        days_list = org.invoice_followup_days or list(DEFAULT_INVOICE_FOLLOWUP_DAYS)
        try:
            days_list = sorted({int(d) for d in days_list if int(d) > 0})
        except (TypeError, ValueError):
            days_list = list(DEFAULT_INVOICE_FOLLOWUP_DAYS)
        if not days_list:
            continue
        max_reminders = len(days_list)
        invoices = (
            Invoice.objects.filter(
                booking__organization=org,
                status=Invoice.Status.ISSUED,
                payment_reminder_count__lt=max_reminders,
            )
            .select_related('booking', 'booking__customer', 'booking__service', 'booking__organization')
        )
        for inv in invoices:
            next_idx = inv.payment_reminder_count
            if next_idx >= len(days_list):
                continue
            due_after = timedelta(days=days_list[next_idx])
            if inv.issued_at + due_after > now:
                continue
            if inv.last_payment_reminder_at and inv.last_payment_reminder_at > now - timedelta(hours=20):
                continue
            customer_email = inv.booking.customer.email
            if not customer_email:
                continue
            service_name = inv.booking.service.name if inv.booking.service_id else 'Service'
            from django.conf import settings as dj_settings
            base = (getattr(dj_settings, 'PUBLIC_APP_URL', None) or 'http://localhost:3000').rstrip('/')
            bookings_url = f'{base}/customer/bookings'
            _send_to(
                customer_email,
                f'Payment reminder — invoice {inv.number} from {org.name}',
                [
                    f'This is a friendly reminder that invoice {inv.number} for {service_name} '
                    f'({inv.amount} {inv.currency}) is still unpaid.',
                    f'Business: {org.name}',
                    '',
                    f'View and pay in Luminexa: {bookings_url}',
                ],
            )
            inv.payment_reminder_count = next_idx + 1
            inv.last_payment_reminder_at = now
            inv.save(update_fields=['payment_reminder_count', 'last_payment_reminder_at', 'updated_at'])
            sent += 1
    return sent
