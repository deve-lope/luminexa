import logging

from django.conf import settings
from django.core.mail import EmailMessage, send_mail
from django.utils import timezone
from django.utils.formats import date_format

from businesses.models import Organization

from .models import CustomerNotification, ProviderNotification, Service

logger = logging.getLogger(__name__)


def _public_app_url():
    return getattr(settings, 'PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')


def provider_booking_detail_url(org_slug, booking_id):
    return f'{_public_app_url()}/provider/{org_slug}/schedule/booking/{booking_id}'


def customer_bookings_url():
    return f'{_public_app_url()}/customer/bookings'


def customer_history_url():
    return f'{_public_app_url()}/customer/history'


def _format_when(dt):
    if not dt:
        return ''
    return date_format(timezone.localtime(dt), 'DATETIME_FORMAT')


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


def create_customer_notification(
    *,
    customer,
    kind,
    title,
    message,
    organization=None,
    booking=None,
    link_path='',
):
    """Create an in-app customer alert (shown after login on Home)."""
    if not customer:
        return None
    return CustomerNotification.objects.create(
        customer=customer,
        organization=organization,
        booking=booking,
        kind=kind,
        title=title[:200],
        message=message[:500],
        link_path=link_path
        or (f'/customer/bookings/{booking.pk}' if booking is not None else '/customer/bookings'),
    )


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
    ProviderNotification.objects.create(
        organization=booking.organization,
        kind=ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
        message=(
            f'{customer_name} {action} {service_name} for {_format_when(booking.start_at)}. '
            'Open Service requests to review or manage it.'
        ),
    )


def create_provider_customer_cancel_notification(booking):
    """In-app alert when a customer cancels a booking."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    ProviderNotification.objects.create(
        organization=booking.organization,
        kind=ProviderNotification.Kind.CUSTOMER_CANCELLED_BOOKING,
        message=(
            f'{customer_name} cancelled {service_name} '
            f'(was {_format_when(booking.start_at)}). '
            'Open Service requests if you need to follow up.'
        ),
    )


def create_provider_customer_reschedule_notification(booking):
    """In-app alert when a customer asks to reschedule."""
    service_name = booking.service.name if booking.service_id else 'Service'
    customer_name = _customer_label(booking)
    ProviderNotification.objects.create(
        organization=booking.organization,
        kind=ProviderNotification.Kind.CUSTOMER_RESCHEDULE_REQUEST,
        message=(
            f'{customer_name} asked to reschedule {service_name} '
            f'to {_format_when(booking.start_at)}. '
            'Open Service requests to review or approve.'
        ),
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
    CustomerNotification.objects.get_or_create(
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
    customer_name = _customer_label(booking)
    ProviderNotification.objects.get_or_create(
        organization=booking.organization,
        kind=ProviderNotification.Kind.PAYMENT_RECEIVED,
        message=(
            f'Payment received: {customer_name} paid {amount} '
            f'for invoice {invoice.number}.'
        ),
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
            f'View your bookings: {bookings_url}',
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
