from django.utils import timezone
from django.utils.formats import date_format
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Booking, CustomerServiceInquiry, ServiceRequestMessage
from .permissions import is_org_staff


def _format_when(dt):
    if not dt:
        return ''
    return date_format(timezone.localtime(dt), 'DATETIME_FORMAT')


def booking_approval_message_body(booking):
    service_name = booking.service.name if booking.service_id else 'your service'
    when = _format_when(booking.start_at)
    if when:
        return f'Your request for {service_name} on {when} has been approved.'
    return f'Your request for {service_name} has been approved.'


def booking_cancellation_message_body(booking):
    service_name = booking.service.name if booking.service_id else 'your service'
    when = _format_when(booking.start_at)
    if when:
        return f'Your booking for {service_name} on {when} has been cancelled.'
    return f'Your booking for {service_name} has been cancelled.'


def booking_incomplete_message_body(booking, *, note='', return_booking=None):
    service_name = booking.service.name if booking.service_id else 'your service'
    note_text = (note or '').strip()
    if return_booking is not None:
        when = _format_when(return_booking.start_at)
        body = (
            f'Work on {service_name} could not be finished today. '
            f'A return visit is scheduled for {when}.'
        )
    else:
        body = (
            f'Work on {service_name} could not be finished today. '
            'We will schedule a return visit and confirm the time with you.'
        )
    if note_text:
        body = f'{body}\n\nNote: {note_text}'
    return body


def inquiry_approval_message_body(inquiry):
    label = (
        inquiry.service.name
        if inquiry.service_id
        else (inquiry.service_label or 'your request')
    )
    if inquiry.preferred_date:
        return f'Your request for {label} (preferred date: {inquiry.preferred_date}) has been approved.'
    return f'Your request for {label} has been approved.'


def can_access_booking_messages(user, booking):
    if booking.customer_id == user.id:
        return True
    return is_org_staff(user, booking.organization)


def can_access_inquiry_messages(user, inquiry):
    if inquiry.customer_id == user.id:
        return True
    return is_org_staff(user, inquiry.organization)


def list_booking_messages(booking):
    return (
        ServiceRequestMessage.objects.filter(booking=booking)
        .select_related('sender', 'booking', 'booking__customer')
        .order_by('created_at')
    )


def list_inquiry_messages(inquiry):
    return (
        ServiceRequestMessage.objects.filter(inquiry=inquiry)
        .select_related('sender', 'inquiry', 'inquiry__customer')
        .order_by('created_at')
    )


def _notify_new_message(message):
    """Email the other party about a new message (non-blocking — failures are logged)."""
    from .notifications import _send_to, _public_app_url, _provider_staff_emails

    sender = message.sender

    if message.booking_id:
        booking = message.booking
        org = booking.organization
        service_name = booking.service.name if booking.service_id else 'your booking'
        ref = f'BK-{booking.pk:05d}'
        subject = f'New message about {service_name} ({ref}) — {org.name}'
        thread_url = f'{_public_app_url()}/provider/{org.slug}/requests/booking/{booking.pk}'

        sender_is_staff = is_org_staff(sender, org)
        if sender_is_staff:
            # Notify the customer
            if booking.customer.email:
                _send_to(
                    booking.customer.email,
                    subject,
                    [
                        f'{org.name} sent you a message about {service_name}.',
                        f'"{message.body}"',
                        '',
                        f'Reply at: {thread_url}',
                    ],
                )
        else:
            # Notify provider staff
            staff_emails = _provider_staff_emails(org)
            if staff_emails:
                customer_name = booking.customer.full_name or booking.customer.email
                _send_to(
                    staff_emails,
                    subject,
                    [
                        f'{customer_name} sent a message about {service_name} ({ref}).',
                        f'"{message.body}"',
                        '',
                        f'Reply at: {thread_url}',
                    ],
                )

    elif message.inquiry_id:
        inquiry = message.inquiry
        org = inquiry.organization
        service_label = (
            inquiry.service.name if inquiry.service_id else (inquiry.service_label or 'your request')
        )
        ref = f'SR-{inquiry.pk:05d}'
        subject = f'New message about {service_label} ({ref}) — {org.name}'
        thread_url = f'{_public_app_url()}/provider/{org.slug}/requests/inquiry/{inquiry.pk}'

        sender_is_staff = is_org_staff(sender, org)
        if sender_is_staff:
            if inquiry.customer.email:
                _send_to(
                    inquiry.customer.email,
                    subject,
                    [
                        f'{org.name} sent you a message about {service_label}.',
                        f'"{message.body}"',
                        '',
                        f'Reply at: {thread_url}',
                    ],
                )
        else:
            staff_emails = _provider_staff_emails(org)
            if staff_emails:
                customer_name = inquiry.customer.full_name or inquiry.customer.email
                _send_to(
                    staff_emails,
                    subject,
                    [
                        f'{customer_name} sent a message about {service_label} ({ref}).',
                        f'"{message.body}"',
                        '',
                        f'Reply at: {thread_url}',
                    ],
                )


def post_booking_message(*, booking, sender, body):
    if not can_access_booking_messages(sender, booking):
        raise PermissionDenied('You cannot message on this booking.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    msg = ServiceRequestMessage.objects.create(booking=booking, sender=sender, body=text)
    _notify_new_message(msg)
    return msg


def post_inquiry_message(*, inquiry, sender, body):
    if not can_access_inquiry_messages(sender, inquiry):
        raise PermissionDenied('You cannot message on this request.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    msg = ServiceRequestMessage.objects.create(inquiry=inquiry, sender=sender, body=text)
    _notify_new_message(msg)
    return msg


def post_booking_approval_message(*, booking, sender):
    """Post an automated thread message when staff approves a booking request."""
    return post_booking_message(
        booking=booking,
        sender=sender,
        body=booking_approval_message_body(booking),
    )


def post_booking_cancellation_message(*, booking, sender):
    """
    Record a cancellation note in the booking thread.
    Does not send a separate message email — the cancel email already notifies the customer.
    """
    if not can_access_booking_messages(sender, booking):
        raise PermissionDenied('You cannot message on this booking.')
    return ServiceRequestMessage.objects.create(
        booking=booking,
        sender=sender,
        body=booking_cancellation_message_body(booking),
    )


def post_booking_incomplete_message(*, booking, sender, note='', return_booking=None):
    """Notify the customer that work was incomplete and a return visit may be scheduled."""
    return post_booking_message(
        booking=booking,
        sender=sender,
        body=booking_incomplete_message_body(
            booking, note=note, return_booking=return_booking,
        ),
    )


def post_inquiry_approval_message(*, inquiry, sender):
    """Post an automated thread message when staff approves a custom service request."""
    return post_inquiry_message(
        inquiry=inquiry,
        sender=sender,
        body=inquiry_approval_message_body(inquiry),
    )
