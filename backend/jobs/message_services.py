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


def post_booking_message(*, booking, sender, body):
    if not can_access_booking_messages(sender, booking):
        raise PermissionDenied('You cannot message on this booking.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    return ServiceRequestMessage.objects.create(booking=booking, sender=sender, body=text)


def post_inquiry_message(*, inquiry, sender, body):
    if not can_access_inquiry_messages(sender, inquiry):
        raise PermissionDenied('You cannot message on this request.')
    text = (body or '').strip()
    if len(text) < 1:
        raise ValidationError({'body': 'Message cannot be empty.'})
    return ServiceRequestMessage.objects.create(inquiry=inquiry, sender=sender, body=text)
