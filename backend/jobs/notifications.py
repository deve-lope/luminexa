import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.formats import date_format

logger = logging.getLogger(__name__)


def _public_app_url():
    return getattr(settings, 'PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')


def provider_booking_detail_url(org_slug, booking_id):
    return f'{_public_app_url()}/provider/{org_slug}/schedule/booking/{booking_id}'


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


def _booking_detail_lines(booking, *, include_address=False):
    service_name = booking.service.name if booking.service_id else 'Service'
    lines = [
        f'Service: {service_name}',
        f'When: {_format_when(booking.start_at)}',
        f'Customer: {_customer_label(booking)}',
    ]
    if booking.customer.phone:
        lines.append(f'Phone: {booking.customer.phone}')
    if include_address and booking.service_address:
        lines.append(f'Location: {booking.service_address}')
    if booking.customer_notes:
        lines.append(f'Notes: {booking.customer_notes}')
    return lines


def notify_customer_booking_created(booking):
    """Email provider staff and the customer after a customer books a slot."""
    from .models import Booking

    if booking.status == Booking.Status.CONFIRMED:
        send_booking_email('booking_new_to_provider', booking)
        send_booking_email('booking_confirmed', booking)
    else:
        send_booking_email('booking_requested', booking)


def send_booking_email(event, booking):
    """Send booking lifecycle email; failures are logged, not raised."""
    org = booking.organization
    service_name = booking.service.name if booking.service_id else 'Service'
    when = _format_when(booking.start_at)
    provider_url = provider_booking_detail_url(org.slug, booking.id)

    recipients = []
    subject = ''
    body_lines = []

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
                ],
            )
    elif event == 'booking_confirmed':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Booking confirmed — {org.name}'
        body_lines = [
            f'Your appointment for {service_name} is confirmed.',
            f'When: {when}',
            f'Business: {org.name}',
        ]
    elif event == 'booking_declined':
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Booking declined — {org.name}'
        body_lines = [
            f'Your request for {service_name} was declined.',
            f'When: {when}',
        ]
    elif event == 'booking_cancelled':
        staff = _provider_staff_emails(org)
        customer_email = booking.customer.email
        if customer_email:
            _send_to(
                customer_email,
                f'Booking cancelled — {org.name}',
                [f'Your appointment for {service_name} on {when} was cancelled.'],
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
        # Receipt to customer
        customer_lines = [
            f'Receipt — {org.name}',
            f'Reference: {ref}',
            f'Service: {service_name}',
            f'Date: {when}',
        ]
        if booking.service_id and hasattr(booking, 'service') and booking.service.base_price:
            from decimal import Decimal
            price = booking.service.base_price
            customer_lines.append(f'Price: ${price:,.2f}')
        customer_lines += [
            '',
            f'Thank you for choosing {org.name}!',
        ]
        if review_url:
            customer_lines += [
                '',
                f'How was your experience? Leave a review:',
                review_url,
            ]
        if booking.customer.email:
            _send_to(
                booking.customer.email,
                f'Service complete — receipt from {org.name}',
                customer_lines,
            )
        # Completion notice to provider staff
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
        ]
        if booking.service_address:
            body_lines.append(f'Location: {booking.service_address}')
    else:
        return

    if not recipients:
        return
    body = '\n'.join(line for line in body_lines if line)
    _send_to(recipients, subject, body.split('\n'))


def _send_to(recipients, subject, body_lines):
    if isinstance(recipients, str):
        recipients = [recipients]
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    body = '\n'.join(body_lines)
    try:
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
