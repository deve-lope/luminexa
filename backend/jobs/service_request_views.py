from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization

from .models import Booking, CustomerServiceInquiry
from .permissions import is_org_staff
from .serializers import (
    CustomerServiceInquirySerializer,
    ProviderServiceRequestListSerializer,
    ServiceRequestMessageSerializer,
)
from .message_services import (
    can_access_inquiry_messages,
    list_inquiry_messages,
    post_inquiry_message,
)


def _booking_bucket(status):
    if status == Booking.Status.REQUESTED:
        return 'pending'
    if status in (Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS):
        return 'active'
    return 'done'


def _inquiry_bucket(status):
    if status == CustomerServiceInquiry.Status.PENDING:
        return 'pending'
    if status == CustomerServiceInquiry.Status.ACTIVE:
        return 'active'
    return 'done'


class ProviderServiceRequestsAPIView(APIView):
    """Unified list of booking requests and custom inquiries for provider staff."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        slug = request.query_params.get('organization')
        if not slug:
            raise ValidationError({'organization': "Query parameter 'organization' (slug) is required."})
        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        if not is_org_staff(request.user, org):
            raise PermissionDenied('You must be staff of this organization.')

        filter_key = (request.query_params.get('filter') or 'all').lower()
        items = []

        bookings = (
            Booking.objects.filter(organization=org)
            .exclude(source=Booking.Source.PROVIDER_DIRECT)
            .select_related('service', 'customer')
            .annotate(message_count=Count('request_messages'))
            .order_by('-created_at')
        )
        for booking in bookings:
            bucket = _booking_bucket(booking.status)
            if filter_key != 'all' and bucket != filter_key:
                continue
            items.append({
                'kind': 'booking',
                'id': booking.id,
                'title': booking.service.name,
                'customer_name': booking.customer.full_name,
                'customer_email': booking.customer.email,
                'status': booking.status,
                'bucket': bucket,
                'start_at': booking.start_at,
                'preferred_date': None,
                'summary': (booking.customer_notes or '').strip() or None,
                'message_count': booking.message_count,
                'created_at': booking.created_at,
                'updated_at': booking.updated_at,
            })

        inquiries = (
            CustomerServiceInquiry.objects.filter(organization=org)
            .select_related('customer', 'service')
            .annotate(message_count=Count('request_messages'))
            .order_by('-created_at')
        )
        for inquiry in inquiries:
            bucket = _inquiry_bucket(inquiry.status)
            if filter_key != 'all' and bucket != filter_key:
                continue
            title = inquiry.service.name if inquiry.service_id else (inquiry.service_label or 'Custom request')
            items.append({
                'kind': 'inquiry',
                'id': inquiry.id,
                'title': title,
                'customer_name': inquiry.customer.full_name,
                'customer_email': inquiry.customer.email,
                'status': inquiry.status,
                'bucket': bucket,
                'start_at': None,
                'preferred_date': inquiry.preferred_date,
                'summary': (inquiry.message or '').strip() or None,
                'message_count': inquiry.message_count,
                'created_at': inquiry.created_at,
                'updated_at': inquiry.created_at,
            })

        items.sort(key=lambda row: row['created_at'], reverse=True)
        data = ProviderServiceRequestListSerializer(items, many=True).data

        all_bookings = Booking.objects.filter(organization=org).exclude(
            source=Booking.Source.PROVIDER_DIRECT,
        )
        all_inquiries = CustomerServiceInquiry.objects.filter(organization=org)
        pending_count = (
            all_bookings.filter(status=Booking.Status.REQUESTED).count()
            + all_inquiries.filter(status=CustomerServiceInquiry.Status.PENDING).count()
        )
        return Response({'items': data, 'pending_count': pending_count})


class ProviderServiceInquiryDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_inquiry(self, slug, inquiry_id, user):
        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        if not is_org_staff(user, org):
            raise PermissionDenied('Staff only.')
        inquiry = (
            CustomerServiceInquiry.objects.filter(organization=org, pk=inquiry_id)
            .select_related('customer', 'service', 'organization')
            .first()
        )
        if not inquiry:
            raise NotFound('Request not found.')
        return inquiry

    def get(self, request, slug, inquiry_id):
        inquiry = self._get_inquiry(slug, inquiry_id, request.user)
        return Response(CustomerServiceInquirySerializer(inquiry).data)

    def patch(self, request, slug, inquiry_id):
        inquiry = self._get_inquiry(slug, inquiry_id, request.user)
        action = (request.data.get('action') or '').lower()
        if action == 'accept':
            if inquiry.status != CustomerServiceInquiry.Status.PENDING:
                raise ValidationError({'action': 'Only pending requests can be accepted.'})
            inquiry.status = CustomerServiceInquiry.Status.ACTIVE
            inquiry.save(update_fields=['status'])
        elif action == 'complete':
            if inquiry.status not in (
                CustomerServiceInquiry.Status.PENDING,
                CustomerServiceInquiry.Status.ACTIVE,
            ):
                raise ValidationError({'action': 'This request is already closed.'})
            inquiry.status = CustomerServiceInquiry.Status.COMPLETED
            inquiry.save(update_fields=['status'])
        elif action == 'decline':
            if inquiry.status in (
                CustomerServiceInquiry.Status.COMPLETED,
                CustomerServiceInquiry.Status.DECLINED,
            ):
                raise ValidationError({'action': 'This request is already closed.'})
            inquiry.status = CustomerServiceInquiry.Status.DECLINED
            inquiry.dismissed_at = timezone.now()
            inquiry.save(update_fields=['status', 'dismissed_at'])
        else:
            raise ValidationError({'action': 'Use accept, complete, or decline.'})
        return Response(CustomerServiceInquirySerializer(inquiry).data)


class ServiceInquiryMessagesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_inquiry(self, slug, inquiry_id, user):
        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        inquiry = CustomerServiceInquiry.objects.filter(organization=org, pk=inquiry_id).first()
        if not inquiry:
            raise NotFound('Request not found.')
        if not can_access_inquiry_messages(user, inquiry):
            raise PermissionDenied('You cannot view messages on this request.')
        return inquiry

    def get(self, request, slug, inquiry_id):
        inquiry = self._get_inquiry(slug, inquiry_id, request.user)
        messages = list_inquiry_messages(inquiry)
        return Response(
            ServiceRequestMessageSerializer(
                messages, many=True, context={'request': request},
            ).data,
        )

    def post(self, request, slug, inquiry_id):
        inquiry = self._get_inquiry(slug, inquiry_id, request.user)
        message = post_inquiry_message(
            inquiry=inquiry,
            sender=request.user,
            body=request.data.get('body', ''),
        )
        return Response(
            ServiceRequestMessageSerializer(message, context={'request': request}).data,
            status=201,
        )
