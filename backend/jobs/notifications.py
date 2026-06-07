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


def send_booking_email(event, booking):
    """Send booking lifecycle email; failures are logged, not raised."""
    org = booking.organization
    service_name = booking.service.name if booking.service_id else 'Service'
    when = _format_when(booking.start_at)
    provider_url = provider_booking_detail_url(org.slug, booking.id)

    recipients = []
    subject = ''
    body_lines = []

    if event == 'booking_requested':
        staff_emails = list(
            org.memberships.filter(
                role__in=('owner', 'staff'),
            ).select_related('user').values_list('user__email', flat=True)
        )
        recipients = [e for e in staff_emails if e]
        subject = f'New booking request — {service_name}'
        body_lines = [
            f'A customer requested {service_name}.',
            f'When: {when}',
            f'Customer: {booking.customer.full_name or booking.customer.email}',
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
        staff_emails = list(
            org.memberships.filter(role__in=('owner', 'staff'))
            .select_related('user')
            .values_list('user__email', flat=True)
        )
        staff = [e for e in staff_emails if e]
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
        recipients = [booking.customer.email] if booking.customer.email else []
        subject = f'Service completed — {org.name}'
        body_lines = [
            f'Your appointment for {service_name} on {when} is marked complete.',
            f'Thank you for choosing {org.name}.',
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
