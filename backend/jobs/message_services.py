from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .datetime_display import format_booking_when
from .models import ServiceRequestMessage
from .permissions import is_org_staff


def _format_when(dt):
    return format_booking_when(dt)


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


def _preview_body(body, *, max_len=140):
    text = ' '.join((body or '').split())
    if len(text) <= max_len:
        return text
    return f'{text[: max_len - 1].rstrip()}…'


def _thread_has_unread(*, last_message, viewer_is_customer, customer_id, read_at):
    """Unread when the latest message is from the other party after the viewer last opened the thread."""
    if not last_message or not last_message.sender_id:
        return False
    if viewer_is_customer:
        from_other = last_message.sender_id != customer_id
    else:
        from_other = last_message.sender_id == customer_id
    if not from_other:
        return False
    if read_at is None:
        return True
    return last_message.created_at > read_at


def mark_booking_messages_read(*, booking, user):
    """Record that user opened the booking thread (customer or provider staff)."""
    now = timezone.now()
    if booking.customer_id == user.id:
        booking.customer_messages_read_at = now
        booking.save(update_fields=['customer_messages_read_at', 'updated_at'])
        _dismiss_booking_new_message_notifications(booking=booking, for_customer=True)
    elif is_org_staff(user, booking.organization):
        booking.provider_messages_read_at = now
        booking.save(update_fields=['provider_messages_read_at', 'updated_at'])
        _dismiss_booking_new_message_notifications(booking=booking, for_provider=True)


def mark_inquiry_messages_read(*, inquiry, user):
    """Record that user opened the inquiry thread (customer or provider staff)."""
    now = timezone.now()
    if inquiry.customer_id == user.id:
        inquiry.customer_messages_read_at = now
        inquiry.save(update_fields=['customer_messages_read_at'])
        _dismiss_inquiry_new_message_notifications(inquiry=inquiry, for_customer=True)
    elif is_org_staff(user, inquiry.organization):
        inquiry.provider_messages_read_at = now
        inquiry.save(update_fields=['provider_messages_read_at'])
        _dismiss_inquiry_new_message_notifications(inquiry=inquiry, for_provider=True)


def _dismiss_booking_new_message_notifications(*, booking, for_customer=False, for_provider=False):
    """Clear in-app new_message alerts for this booking thread only."""
    from .models import CustomerNotification, ProviderNotification

    now = timezone.now()
    if for_customer:
        CustomerNotification.objects.filter(
            customer_id=booking.customer_id,
            booking=booking,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)
    if for_provider:
        ProviderNotification.objects.filter(
            organization_id=booking.organization_id,
            booking=booking,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)


def _dismiss_inquiry_new_message_notifications(*, inquiry, for_customer=False, for_provider=False):
    """Clear in-app new_message alerts for this inquiry thread only."""
    from .models import CustomerNotification, ProviderNotification

    now = timezone.now()
    if for_customer:
        CustomerNotification.objects.filter(
            customer_id=inquiry.customer_id,
            inquiry=inquiry,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)
    if for_provider:
        ProviderNotification.objects.filter(
            organization_id=inquiry.organization_id,
            inquiry=inquiry,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)

def count_unread_summaries(summaries):
    """Number of conversation threads with an unread latest message for the viewer."""
    return sum(1 for s in summaries if s.get('has_unread'))


def list_customer_conversation_summaries(user):
    """Booking + inquiry threads for the customer inbox, newest activity first."""
    messages = (
        ServiceRequestMessage.objects.filter(
            Q(booking__customer=user) | Q(inquiry__customer=user),
        )
        .select_related(
            'sender',
            'booking',
            'booking__organization',
            'booking__service',
            'inquiry',
            'inquiry__organization',
            'inquiry__service',
        )
        .order_by('-created_at', '-id')
    )

    summaries = []
    seen = set()
    for msg in messages:
        if msg.booking_id:
            key = ('booking', msg.booking_id)
            if key in seen:
                continue
            seen.add(key)
            booking = msg.booking
            org = booking.organization
            subject = booking.service.name if booking.service_id else 'Booking'
            summaries.append({
                'kind': 'booking',
                'id': booking.id,
                'reference': f'BK-{booking.pk:05d}',
                'subject': subject,
                'organization_name': org.name,
                'organization_slug': org.slug,
                'organization_public_ref': org.public_ref or '',
                'last_message_preview': _preview_body(msg.body),
                'last_message_at': msg.created_at,
                'last_sender_name': msg.sender.full_name if msg.sender_id else '',
                'has_unread': _thread_has_unread(
                    last_message=msg,
                    viewer_is_customer=True,
                    customer_id=booking.customer_id,
                    read_at=booking.customer_messages_read_at,
                ),
            })
        elif msg.inquiry_id:
            key = ('inquiry', msg.inquiry_id)
            if key in seen:
                continue
            seen.add(key)
            inquiry = msg.inquiry
            org = inquiry.organization
            subject = (
                inquiry.service.name
                if inquiry.service_id
                else (inquiry.service_label or 'Custom request')
            )
            summaries.append({
                'kind': 'inquiry',
                'id': inquiry.id,
                'reference': f'SR-{inquiry.pk:05d}',
                'subject': subject,
                'organization_name': org.name,
                'organization_slug': org.slug,
                'organization_public_ref': org.public_ref or '',
                'last_message_preview': _preview_body(msg.body),
                'last_message_at': msg.created_at,
                'last_sender_name': msg.sender.full_name if msg.sender_id else '',
                'has_unread': _thread_has_unread(
                    last_message=msg,
                    viewer_is_customer=True,
                    customer_id=inquiry.customer_id,
                    read_at=inquiry.customer_messages_read_at,
                ),
            })
    return summaries


def list_provider_conversation_summaries(organization):
    """Booking + inquiry threads for one provider org inbox, newest activity first."""
    messages = (
        ServiceRequestMessage.objects.filter(
            Q(booking__organization=organization) | Q(inquiry__organization=organization),
        )
        .select_related(
            'sender',
            'booking',
            'booking__organization',
            'booking__service',
            'booking__customer',
            'inquiry',
            'inquiry__organization',
            'inquiry__service',
            'inquiry__customer',
        )
        .order_by('-created_at', '-id')
    )

    summaries = []
    seen = set()
    for msg in messages:
        if msg.booking_id:
            key = ('booking', msg.booking_id)
            if key in seen:
                continue
            seen.add(key)
            booking = msg.booking
            org = booking.organization
            subject = booking.service.name if booking.service_id else 'Booking'
            customer = booking.customer
            summaries.append({
                'kind': 'booking',
                'id': booking.id,
                'reference': f'BK-{booking.pk:05d}',
                'subject': subject,
                'organization_name': org.name,
                'organization_slug': org.slug,
                'organization_public_ref': org.public_ref or '',
                'customer_name': (customer.full_name if customer else '') or (customer.email if customer else ''),
                'last_message_preview': _preview_body(msg.body),
                'last_message_at': msg.created_at,
                'last_sender_name': msg.sender.full_name if msg.sender_id else '',
                'has_unread': _thread_has_unread(
                    last_message=msg,
                    viewer_is_customer=False,
                    customer_id=booking.customer_id,
                    read_at=booking.provider_messages_read_at,
                ),
            })
        elif msg.inquiry_id:
            key = ('inquiry', msg.inquiry_id)
            if key in seen:
                continue
            seen.add(key)
            inquiry = msg.inquiry
            org = inquiry.organization
            subject = (
                inquiry.service.name
                if inquiry.service_id
                else (inquiry.service_label or 'Custom request')
            )
            customer = inquiry.customer
            summaries.append({
                'kind': 'inquiry',
                'id': inquiry.id,
                'reference': f'SR-{inquiry.pk:05d}',
                'subject': subject,
                'organization_name': org.name,
                'organization_slug': org.slug,
                'organization_public_ref': org.public_ref or '',
                'customer_name': (customer.full_name if customer else '') or (customer.email if customer else ''),
                'last_message_preview': _preview_body(msg.body),
                'last_message_at': msg.created_at,
                'last_sender_name': msg.sender.full_name if msg.sender_id else '',
                'has_unread': _thread_has_unread(
                    last_message=msg,
                    viewer_is_customer=False,
                    customer_id=inquiry.customer_id,
                    read_at=inquiry.provider_messages_read_at,
                ),
            })
    return summaries


def _notify_new_message(message, *, create_in_app=True):
    """Notify the other party about a new message.

    Provider→customer: email + optional in-app CustomerNotification.
    Customer→provider: in-app ProviderNotification only (no email — chat spam).
    """
    from .models import CustomerNotification, ProviderNotification
    from .notifications import (
        _send_to,
        _public_app_url,
        create_customer_notification,
        provider_messages_link_path,
    )

    sender = message.sender
    preview = _preview_body(message.body, max_len=120)

    if message.booking_id:
        booking = message.booking
        org = booking.organization
        service_name = booking.service.name if booking.service_id else 'your booking'
        ref = f'BK-{booking.pk:05d}'
        subject = f'New message about {service_name} ({ref}) — {org.name}'
        messages_path = provider_messages_link_path(org.slug, booking_id=booking.pk)

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
                        f'Reply at: {_public_app_url()}/customer/messages',
                    ],
                )
            if create_in_app:
                create_customer_notification(
                    customer=booking.customer,
                    kind=CustomerNotification.Kind.NEW_MESSAGE,
                    title=f'New message — {org.name}',
                    message=f'{org.name}: {preview}',
                    organization=org,
                    booking=booking,
                    link_path='/customer/messages',
                )
        else:
            # In-app only for customer→provider chat (email was too noisy).
            if create_in_app:
                customer_name = booking.customer.full_name or booking.customer.email
                ProviderNotification.objects.create(
                    organization=org,
                    booking=booking,
                    kind=ProviderNotification.Kind.NEW_MESSAGE,
                    message=(
                        f'{customer_name} sent a message about {service_name} ({ref}). '
                        'Open Messages to reply.'
                    ),
                    link_path=messages_path,
                )

    elif message.inquiry_id:
        inquiry = message.inquiry
        org = inquiry.organization
        service_label = (
            inquiry.service.name if inquiry.service_id else (inquiry.service_label or 'your request')
        )
        ref = f'SR-{inquiry.pk:05d}'
        subject = f'New message about {service_label} ({ref}) — {org.name}'
        messages_path = provider_messages_link_path(org.slug, inquiry_id=inquiry.pk)

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
                        f'Reply at: {_public_app_url()}/customer/messages',
                    ],
                )
            if create_in_app:
                create_customer_notification(
                    customer=inquiry.customer,
                    kind=CustomerNotification.Kind.NEW_MESSAGE,
                    title=f'New message — {org.name}',
                    message=f'{org.name}: {preview}',
                    organization=org,
                    inquiry=inquiry,
                    link_path='/customer/messages',
                )
        else:
            # In-app only for customer→provider chat (email was too noisy).
            if create_in_app:
                customer_name = inquiry.customer.full_name or inquiry.customer.email
                ProviderNotification.objects.create(
                    organization=org,
                    inquiry=inquiry,
                    kind=ProviderNotification.Kind.NEW_MESSAGE,
                    message=(
                        f'{customer_name} sent a message about {service_label} ({ref}). '
                        'Open Messages to reply.'
                    ),
                    link_path=messages_path,
                )


def post_booking_message(*, booking, sender, body, create_in_app=True):
    if not can_access_booking_messages(sender, booking):
        raise PermissionDenied('You cannot message on this booking.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    msg = ServiceRequestMessage.objects.create(booking=booking, sender=sender, body=text)
    # Sender has seen the thread through their own send.
    mark_booking_messages_read(booking=booking, user=sender)
    _notify_new_message(msg, create_in_app=create_in_app)
    return msg


def post_inquiry_message(*, inquiry, sender, body, create_in_app=True):
    if not can_access_inquiry_messages(sender, inquiry):
        raise PermissionDenied('You cannot message on this request.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    msg = ServiceRequestMessage.objects.create(inquiry=inquiry, sender=sender, body=text)
    mark_inquiry_messages_read(inquiry=inquiry, user=sender)
    _notify_new_message(msg, create_in_app=create_in_app)
    return msg


def post_booking_approval_message(*, booking, sender):
    """Post an automated thread message when staff approves a booking request."""
    return post_booking_message(
        booking=booking,
        sender=sender,
        body=booking_approval_message_body(booking),
        create_in_app=False,  # BOOKING_CONFIRMED notification already covers this
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
        create_in_app=False,
    )
