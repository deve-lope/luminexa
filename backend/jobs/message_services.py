from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .datetime_display import format_booking_when
from .models import OrgCustomerConversation, ServiceRequestMessage
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


def can_access_conversation(user, conversation):
    if conversation.customer_id == user.id:
        return True
    return is_org_staff(user, conversation.organization)


def get_or_create_conversation(*, organization, customer):
    conv, _ = OrgCustomerConversation.objects.get_or_create(
        organization=organization,
        customer=customer,
    )
    return conv


def conversation_for_booking(booking):
    return get_or_create_conversation(
        organization=booking.organization,
        customer=booking.customer,
    )


def conversation_for_inquiry(inquiry):
    return get_or_create_conversation(
        organization=inquiry.organization,
        customer=inquiry.customer,
    )


def _booking_card_meta(booking):
    return {
        'booking_id': booking.id,
        'reference': f'BK-{booking.pk:05d}',
        'service_name': booking.service.name if booking.service_id else 'Booking',
        'status': booking.status,
        'start_at': booking.start_at.isoformat() if booking.start_at else None,
        'end_at': booking.end_at.isoformat() if booking.end_at else None,
        'service_address': booking.service_address or '',
        'organization_slug': booking.organization.slug,
        'organization_name': booking.organization.name,
    }


def _inquiry_card_meta(inquiry):
    label = (
        inquiry.service.name
        if inquiry.service_id
        else (inquiry.service_label or 'Custom request')
    )
    return {
        'inquiry_id': inquiry.id,
        'reference': f'SR-{inquiry.pk:05d}',
        'service_name': label,
        'status': inquiry.status,
        'preferred_date': inquiry.preferred_date.isoformat() if inquiry.preferred_date else None,
        'service_address': inquiry.service_address or '',
        'organization_slug': inquiry.organization.slug,
        'organization_name': inquiry.organization.name,
        'summary': (inquiry.message or '')[:200],
    }


ACTIVE_BOOKING_STATUSES = (
    'requested',
    'quoted',
    'confirmed',
    'in_progress',
    'needs_return',
)

ACTIVE_INQUIRY_STATUSES = (
    'pending',
    'active',
)


def conversation_active_bookings(conversation):
    """Live ongoing bookings for this org↔customer chat, soonest first."""
    from .models import Booking

    qs = (
        Booking.objects.filter(
            organization_id=conversation.organization_id,
            customer_id=conversation.customer_id,
            status__in=ACTIVE_BOOKING_STATUSES,
        )
        .select_related('service', 'organization')
        .order_by('start_at', 'id')
    )
    return [_booking_card_meta(b) for b in qs]


def conversation_active_inquiries(conversation):
    """Open custom requests for this org↔customer chat."""
    from .models import CustomerServiceInquiry

    qs = (
        CustomerServiceInquiry.objects.filter(
            organization_id=conversation.organization_id,
            customer_id=conversation.customer_id,
            status__in=ACTIVE_INQUIRY_STATUSES,
            dismissed_at__isnull=True,
        )
        .select_related('service', 'organization')
        .order_by('-created_at', 'id')
    )
    return [_inquiry_card_meta(iq) for iq in qs]


def ensure_conversation_context_cards(conversation):
    """Backfill booking/inquiry cards for active items missing a timeline card."""
    from .models import Booking, CustomerServiceInquiry

    active_bookings = Booking.objects.filter(
        organization_id=conversation.organization_id,
        customer_id=conversation.customer_id,
        status__in=ACTIVE_BOOKING_STATUSES,
    ).select_related('service', 'organization', 'customer')
    for booking in active_bookings:
        ensure_booking_card(booking=booking, sender=booking.customer)

    active_inquiries = CustomerServiceInquiry.objects.filter(
        organization_id=conversation.organization_id,
        customer_id=conversation.customer_id,
        status__in=ACTIVE_INQUIRY_STATUSES,
        dismissed_at__isnull=True,
    ).select_related('service', 'organization', 'customer')
    for inquiry in active_inquiries:
        ensure_inquiry_card(inquiry=inquiry, sender=inquiry.customer)


def ensure_booking_card(*, booking, sender):
    """Post a booking summary card into the org↔customer thread (once per booking)."""
    conv = conversation_for_booking(booking)
    existing = ServiceRequestMessage.objects.filter(
        conversation=conv,
        booking=booking,
        kind=ServiceRequestMessage.Kind.BOOKING_CARD,
    ).exists()
    if existing:
        return None
    service_name = booking.service.name if booking.service_id else 'Booking'
    when = _format_when(booking.start_at)
    body = f'Booking: {service_name}' + (f' · {when}' if when else '')
    msg = ServiceRequestMessage(
        conversation=conv,
        booking=booking,
        sender=sender,
        kind=ServiceRequestMessage.Kind.BOOKING_CARD,
        body=body,
        meta=_booking_card_meta(booking),
    )
    msg.save()
    OrgCustomerConversation.objects.filter(pk=conv.pk).update(updated_at=timezone.now())
    return msg


def ensure_inquiry_card(*, inquiry, sender):
    """Post an inquiry summary card into the org↔customer thread (once per inquiry)."""
    conv = conversation_for_inquiry(inquiry)
    existing = ServiceRequestMessage.objects.filter(
        conversation=conv,
        inquiry=inquiry,
        kind=ServiceRequestMessage.Kind.INQUIRY_CARD,
    ).exists()
    if existing:
        return None
    label = (
        inquiry.service.name
        if inquiry.service_id
        else (inquiry.service_label or 'Custom request')
    )
    body = f'Request: {label}'
    msg = ServiceRequestMessage(
        conversation=conv,
        inquiry=inquiry,
        sender=sender,
        kind=ServiceRequestMessage.Kind.INQUIRY_CARD,
        body=body,
        meta=_inquiry_card_meta(inquiry),
    )
    msg.save()
    OrgCustomerConversation.objects.filter(pk=conv.pk).update(updated_at=timezone.now())
    return msg


def list_conversation_messages(conversation):
    return (
        ServiceRequestMessage.objects.filter(conversation=conversation)
        .select_related(
            'sender',
            'conversation',
            'conversation__customer',
            'booking',
            'booking__service',
            'booking__organization',
            'booking__customer',
            'inquiry',
            'inquiry__service',
            'inquiry__organization',
            'inquiry__customer',
        )
        .order_by('created_at')
    )


def list_booking_messages(booking):
    """All messages in the org↔customer conversation for this booking."""
    conv = conversation_for_booking(booking)
    ensure_booking_card(booking=booking, sender=booking.customer)
    return list_conversation_messages(conv)


def list_inquiry_messages(inquiry):
    """All messages in the org↔customer conversation for this inquiry."""
    conv = conversation_for_inquiry(inquiry)
    ensure_inquiry_card(inquiry=inquiry, sender=inquiry.customer)
    return list_conversation_messages(conv)


def _preview_body(msg, *, max_len=140):
    if getattr(msg, 'kind', None) == ServiceRequestMessage.Kind.BOOKING_CARD:
        text = msg.body or 'Booking details'
    elif getattr(msg, 'kind', None) == ServiceRequestMessage.Kind.INQUIRY_CARD:
        text = msg.body or 'Service request'
    else:
        text = ' '.join((msg.body or '').split())
    if len(text) <= max_len:
        return text
    return f'{text[: max_len - 1].rstrip()}…'


def _thread_has_unread(*, last_message, viewer_is_customer, customer_id, read_at):
    """Unread when the latest message is from the other party after the viewer last opened the thread."""
    if not last_message or not last_message.sender_id:
        return False
    # Cards / system from either party shouldn't create unread noise for the poster,
    # but cards posted for the customer should show unread for provider and vice versa
    # only when sender is the other party.
    if viewer_is_customer:
        from_other = last_message.sender_id != customer_id
    else:
        from_other = last_message.sender_id == customer_id
    if not from_other:
        return False
    if read_at is None:
        return True
    return last_message.created_at > read_at


def mark_conversation_messages_read(*, conversation, user):
    now = timezone.now()
    if conversation.customer_id == user.id:
        conversation.customer_messages_read_at = now
        conversation.save(update_fields=['customer_messages_read_at', 'updated_at'])
        _dismiss_conversation_new_message_notifications(
            conversation=conversation, for_customer=True,
        )
    elif is_org_staff(user, conversation.organization):
        conversation.provider_messages_read_at = now
        conversation.save(update_fields=['provider_messages_read_at', 'updated_at'])
        _dismiss_conversation_new_message_notifications(
            conversation=conversation, for_provider=True,
        )


def mark_booking_messages_read(*, booking, user):
    conv = conversation_for_booking(booking)
    mark_conversation_messages_read(conversation=conv, user=user)
    # Keep legacy fields in sync for older code paths.
    now = timezone.now()
    if booking.customer_id == user.id:
        booking.customer_messages_read_at = now
        booking.save(update_fields=['customer_messages_read_at', 'updated_at'])
    elif is_org_staff(user, booking.organization):
        booking.provider_messages_read_at = now
        booking.save(update_fields=['provider_messages_read_at', 'updated_at'])


def mark_inquiry_messages_read(*, inquiry, user):
    conv = conversation_for_inquiry(inquiry)
    mark_conversation_messages_read(conversation=conv, user=user)
    now = timezone.now()
    if inquiry.customer_id == user.id:
        inquiry.customer_messages_read_at = now
        inquiry.save(update_fields=['customer_messages_read_at'])
    elif is_org_staff(user, inquiry.organization):
        inquiry.provider_messages_read_at = now
        inquiry.save(update_fields=['provider_messages_read_at'])


def _dismiss_conversation_new_message_notifications(
    *, conversation, for_customer=False, for_provider=False,
):
    from .models import CustomerNotification, ProviderNotification

    now = timezone.now()
    if for_customer:
        CustomerNotification.objects.filter(
            customer_id=conversation.customer_id,
            organization_id=conversation.organization_id,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).update(dismissed_at=now)
    if for_provider:
        ProviderNotification.objects.filter(
            organization_id=conversation.organization_id,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            dismissed_at__isnull=True,
        ).filter(
            Q(booking__customer_id=conversation.customer_id)
            | Q(inquiry__customer_id=conversation.customer_id)
        ).update(dismissed_at=now)


def _dismiss_booking_new_message_notifications(*, booking, for_customer=False, for_provider=False):
    conv = conversation_for_booking(booking)
    _dismiss_conversation_new_message_notifications(
        conversation=conv, for_customer=for_customer, for_provider=for_provider,
    )


def _dismiss_inquiry_new_message_notifications(*, inquiry, for_customer=False, for_provider=False):
    conv = conversation_for_inquiry(inquiry)
    _dismiss_conversation_new_message_notifications(
        conversation=conv, for_customer=for_customer, for_provider=for_provider,
    )


def count_unread_summaries(summaries):
    """Number of conversation threads with an unread latest message for the viewer."""
    return sum(1 for s in summaries if s.get('has_unread'))


def _latest_message_for_conversation(conversation_id):
    return (
        ServiceRequestMessage.objects.filter(conversation_id=conversation_id)
        .select_related('sender')
        .order_by('-created_at', '-id')
        .first()
    )


def list_customer_conversation_summaries(user):
    """One inbox row per provider (org) the customer has messaged / booked with."""
    conversations = (
        OrgCustomerConversation.objects.filter(customer=user)
        .select_related('organization', 'customer')
        .order_by('-updated_at')
    )
    summaries = []
    for conv in conversations:
        msg = _latest_message_for_conversation(conv.id)
        if not msg:
            continue
        org = conv.organization
        summaries.append({
            'kind': 'direct',
            'id': conv.id,
            'reference': '',
            'subject': org.name,
            'organization_name': org.name,
            'organization_slug': org.slug,
            'organization_public_ref': org.public_ref or '',
            'customer_name': '',
            'last_message_preview': _preview_body(msg),
            'last_message_at': msg.created_at,
            'last_sender_name': msg.sender.full_name if msg.sender_id else '',
            'has_unread': _thread_has_unread(
                last_message=msg,
                viewer_is_customer=True,
                customer_id=conv.customer_id,
                read_at=conv.customer_messages_read_at,
            ),
        })
    summaries.sort(key=lambda s: s['last_message_at'] or timezone.now(), reverse=True)
    return summaries


def list_provider_conversation_summaries(organization):
    """One inbox row per customer for this provider org."""
    conversations = (
        OrgCustomerConversation.objects.filter(organization=organization)
        .select_related('organization', 'customer')
        .order_by('-updated_at')
    )
    summaries = []
    for conv in conversations:
        msg = _latest_message_for_conversation(conv.id)
        if not msg:
            continue
        customer = conv.customer
        summaries.append({
            'kind': 'direct',
            'id': conv.id,
            'reference': '',
            'subject': (customer.full_name if customer else '') or (customer.email if customer else 'Customer'),
            'organization_name': organization.name,
            'organization_slug': organization.slug,
            'organization_public_ref': organization.public_ref or '',
            'customer_name': (customer.full_name if customer else '') or (customer.email if customer else ''),
            'customer_id': conv.customer_id,
            'last_message_preview': _preview_body(msg),
            'last_message_at': msg.created_at,
            'last_sender_name': msg.sender.full_name if msg.sender_id else '',
            'has_unread': _thread_has_unread(
                last_message=msg,
                viewer_is_customer=False,
                customer_id=conv.customer_id,
                read_at=conv.provider_messages_read_at,
            ),
        })
    summaries.sort(key=lambda s: s['last_message_at'] or timezone.now(), reverse=True)
    return summaries


def find_conversation_for_booking_id(*, organization=None, customer=None, booking_id):
    from .models import Booking

    qs = Booking.objects.filter(pk=booking_id)
    if organization is not None:
        qs = qs.filter(organization=organization)
    if customer is not None:
        qs = qs.filter(customer=customer)
    booking = qs.select_related('organization', 'customer').first()
    if not booking:
        return None
    return conversation_for_booking(booking)


def find_conversation_for_inquiry_id(*, organization=None, customer=None, inquiry_id):
    from .models import CustomerServiceInquiry

    qs = CustomerServiceInquiry.objects.filter(pk=inquiry_id)
    if organization is not None:
        qs = qs.filter(organization=organization)
    if customer is not None:
        qs = qs.filter(customer=customer)
    inquiry = qs.select_related('organization', 'customer').first()
    if not inquiry:
        return None
    return conversation_for_inquiry(inquiry)


# Avoid flooding the customer inbox during a live chat. Email once per
# conversation, then skip further chat emails until this window elapses.
CHAT_EMAIL_COOLDOWN = timezone.timedelta(hours=2)


def _staff_chat_email_recently_sent(*, conversation, customer, current_message) -> bool:
    """True if another staff TEXT in this thread already fell in the cooldown window.

    The first staff message in a quiet window emails; later ones rely on in-app
    + push until CHAT_EMAIL_COOLDOWN has passed since that prior staff text.
    """
    cutoff = timezone.now() - CHAT_EMAIL_COOLDOWN
    return (
        ServiceRequestMessage.objects.filter(
            conversation=conversation,
            kind=ServiceRequestMessage.Kind.TEXT,
            created_at__gte=cutoff,
        )
        .exclude(pk=current_message.pk)
        .exclude(sender_id=customer.id)
        .exists()
    )


def _notify_new_message(message, *, create_in_app=True):
    """Notify the other party about a new message.

    Provider→customer: at most one email per conversation every
    CHAT_EMAIL_COOLDOWN (in-app + push still fire every time).
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
    preview = _preview_body(message, max_len=120)
    conversation = message.conversation
    if conversation is None:
        if message.booking_id:
            conversation = conversation_for_booking(message.booking)
        elif message.inquiry_id:
            conversation = conversation_for_inquiry(message.inquiry)
        else:
            return

    org = conversation.organization
    customer = conversation.customer
    sender_is_staff = is_org_staff(sender, org)
    messages_path = provider_messages_link_path(org.slug, conversation_id=conversation.pk)

    if sender_is_staff:
        if customer.email and not _staff_chat_email_recently_sent(
            conversation=conversation,
            customer=customer,
            current_message=message,
        ):
            _send_to(
                customer.email,
                f'New message from {org.name}',
                [
                    f'{org.name} sent you a message.',
                    f'"{message.body}"' if message.body else preview,
                    '',
                    f'Reply at: {_public_app_url()}/customer/messages',
                ],
            )
        if create_in_app:
            create_customer_notification(
                customer=customer,
                kind=CustomerNotification.Kind.NEW_MESSAGE,
                title=f'New message — {org.name}',
                message=f'{org.name}: {preview}',
                organization=org,
                booking=message.booking if message.booking_id else None,
                inquiry=message.inquiry if message.inquiry_id else None,
                link_path='/customer/messages',
            )
    else:
        if create_in_app:
            customer_name = customer.full_name or customer.email
            ProviderNotification.objects.create(
                organization=org,
                booking=message.booking if message.booking_id else None,
                inquiry=message.inquiry if message.inquiry_id else None,
                kind=ProviderNotification.Kind.NEW_MESSAGE,
                message=(
                    f'{customer_name} sent you a message. Open Messages to reply.'
                ),
                link_path=messages_path,
            )


def post_conversation_message(*, conversation, sender, body, create_in_app=True, booking=None, inquiry=None):
    if not can_access_conversation(sender, conversation):
        raise PermissionDenied('You cannot message in this conversation.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    msg = ServiceRequestMessage.objects.create(
        conversation=conversation,
        booking=booking,
        inquiry=inquiry,
        sender=sender,
        kind=ServiceRequestMessage.Kind.TEXT,
        body=text,
    )
    OrgCustomerConversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())
    mark_conversation_messages_read(conversation=conversation, user=sender)
    _notify_new_message(msg, create_in_app=create_in_app)
    return msg


def post_booking_message(*, booking, sender, body, create_in_app=True):
    if not can_access_booking_messages(sender, booking):
        raise PermissionDenied('You cannot message on this booking.')
    conv = conversation_for_booking(booking)
    ensure_booking_card(booking=booking, sender=booking.customer)
    return post_conversation_message(
        conversation=conv,
        sender=sender,
        body=body,
        create_in_app=create_in_app,
        booking=booking,
    )


def post_inquiry_message(*, inquiry, sender, body, create_in_app=True):
    if not can_access_inquiry_messages(sender, inquiry):
        raise PermissionDenied('You cannot message on this request.')
    conv = conversation_for_inquiry(inquiry)
    ensure_inquiry_card(inquiry=inquiry, sender=inquiry.customer)
    return post_conversation_message(
        conversation=conv,
        sender=sender,
        body=body,
        create_in_app=create_in_app,
        inquiry=inquiry,
    )


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
    conv = conversation_for_booking(booking)
    ensure_booking_card(booking=booking, sender=booking.customer)
    msg = ServiceRequestMessage(
        conversation=conv,
        booking=booking,
        sender=sender,
        kind=ServiceRequestMessage.Kind.SYSTEM,
        body=booking_cancellation_message_body(booking),
    )
    msg.save()
    OrgCustomerConversation.objects.filter(pk=conv.pk).update(updated_at=timezone.now())
    return msg


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
