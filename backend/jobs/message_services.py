from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Booking, CustomerServiceInquiry, ServiceRequestMessage
from .permissions import is_org_staff


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
