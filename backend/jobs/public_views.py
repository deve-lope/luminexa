import calendar
from collections import defaultdict
from datetime import date, datetime, time

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import BusinessType, Organization, OrganizationMembership
from businesses.public_refs import resolve_organization
from businesses.serializers import BusinessTypeSerializer

from .booking_lead import earliest_customer_bookable_at
from .booking_services import booking_policy_meta, customer_can_view_calendar
from .catalog import build_service_catalog
from .models import AvailabilitySlot, Booking, Service, ServiceReview
from .scheduling_services import sync_recurring_slots
from .serializers import (
    PublicOrganizationReadSerializer,
    PublicServiceDetailSerializer,
    PublicServiceReadSerializer,
    ServiceReviewWriteSerializer,
)


def _public_organization(key):
    org = resolve_organization(key)
    if org and org.is_active and org.profile_public:
        return org
    return None


class PublicProviderStorefrontAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        org = _public_organization(slug)
        if org:
            org = (
                Organization.objects.filter(pk=org.pk)
                .prefetch_related('gallery_images', 'business_types', 'locations')
                .first()
            )
        if not org:
            return Response({'detail': 'Provider not found.'}, status=status.HTTP_404_NOT_FOUND)

        services = Service.objects.filter(organization=org, is_active=True).select_related(
            'category'
        ).order_by('sort_order', 'name')
        ctx = {'request': request}
        types = org.business_types.filter(is_active=True).order_by('sort_order', 'name')
        ser = lambda qs: PublicServiceReadSerializer(qs, many=True, context=ctx).data
        catalog = build_service_catalog(org, ser, active_only=True)
        return Response({
            'organization': PublicOrganizationReadSerializer(org, context=ctx).data,
            'services': ser(services),
            'service_catalog': catalog,
            'business_types': BusinessTypeSerializer(types, many=True).data,
            'booking_policy': org.booking_policy,
        })


class PublicServiceCalendarAPIView(APIView):
    """Month calendar with per-day availability for a service."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug, service_id):
        org = _public_organization(slug)
        if not org:
            return Response({'detail': 'Provider not found.'}, status=status.HTTP_404_NOT_FOUND)

        service = Service.objects.filter(
            id=service_id, organization=org, is_active=True,
        ).first()
        if not service:
            return Response({'detail': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not customer_can_view_calendar(org, request.user):
            return Response(
                {'detail': 'Connect to this business to view availability.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        is_staff = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
            role__in=(
                OrganizationMembership.Role.OWNER,
                OrganizationMembership.Role.STAFF,
            ),
        ).exists()
        # Customers need a lead-time buffer; staff can still pick nearer open slots
        # (e.g. return visits / provider reschedule).
        bookable_after = now if is_staff else earliest_customer_bookable_at(now=now)
        if org.scheduling_mode == Organization.SchedulingMode.RECURRING:
            has_future_open = AvailabilitySlot.objects.filter(
                organization=org,
                status=AvailabilitySlot.Status.OPEN,
                start_at__gte=bookable_after,
            ).exists()
            if not has_future_open:
                sync_recurring_slots(org, weeks_ahead=12)

        try:
            year = int(request.query_params.get('year', timezone.localdate().year))
            month = int(request.query_params.get('month', timezone.localdate().month))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid year or month.'}, status=status.HTTP_400_BAD_REQUEST)

        if month < 1 or month > 12:
            return Response({'detail': 'Month must be 1–12.'}, status=status.HTTP_400_BAD_REQUEST)

        _, last_day = calendar.monthrange(year, month)
        range_start = timezone.make_aware(datetime.combine(date(year, month, 1), time.min))
        range_end = timezone.make_aware(
            datetime.combine(date(year, month, last_day), time.max)
        )

        slots_qs = (
            AvailabilitySlot.objects.filter(
                Q(service=service) | Q(service__isnull=True),
                organization=org,
                start_at__gte=range_start,
                start_at__lte=range_end,
            )
            .select_related('organization', 'service')
            .prefetch_related('bookings')
            .order_by('start_at')
        )

        days_meta = {}
        slots_by_day = defaultdict(list)
        for slot in slots_qs:
            day_key = timezone.localtime(slot.start_at).strftime('%Y-%m-%d')
            remaining = slot.remaining_capacity()
            # Hide past and within-lead-time slots from the customer booking UI.
            # Capacity > 1 keeps a slot bookable until all seats are taken.
            is_open = remaining > 0 and slot.start_at >= bookable_after
            entry = {
                'id': slot.id,
                'start_at': slot.start_at.isoformat(),
                'end_at': slot.end_at.isoformat(),
                'status': slot.status,
                'available': is_open,
                'capacity': slot.capacity,
                'occupied_count': slot.capacity - remaining,
                'remaining_capacity': remaining,
            }
            slots_by_day[day_key].append(entry)
            if day_key not in days_meta:
                days_meta[day_key] = {'total': 0, 'open': 0}
            days_meta[day_key]['total'] += 1
            if is_open:
                days_meta[day_key]['open'] += 1

        days = {}
        for day_num in range(1, last_day + 1):
            day_key = date(year, month, day_num).isoformat()
            meta = days_meta.get(day_key)
            if not meta or meta['total'] == 0:
                day_status = 'none'
            elif meta['open'] > 0:
                day_status = 'available'
            else:
                day_status = 'full'
            days[day_key] = {
                'status': day_status,
                'open_count': meta['open'] if meta else 0,
                'total_count': meta['total'] if meta else 0,
            }

        return Response({
            'year': year,
            'month': month,
            'service': PublicServiceReadSerializer(service, context={'request': request}).data,
            'booking': booking_policy_meta(org, request.user, service=service),
            'days': days,
            'slots_by_day': dict(slots_by_day),
        })


class PublicServiceDetailAPIView(APIView):
    """Full public service page: description, gallery, ratings."""

    permission_classes = [AllowAny]

    def get(self, request, slug, service_id):
        org = _public_organization(slug)
        if not org:
            return Response({'detail': 'Provider not found.'}, status=status.HTTP_404_NOT_FOUND)

        service = (
            Service.objects.filter(id=service_id, organization=org, is_active=True)
            .select_related('organization', 'category')
            .prefetch_related('gallery_images', 'reviews__customer')
            .first()
        )
        if not service:
            return Response({'detail': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            PublicServiceDetailSerializer(service, context={'request': request}).data
        )


class PublicServiceReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, service_id):
        from .ratings import customer_can_edit_service_review, customer_can_rate_service

        org = _public_organization(slug)
        if not org:
            return Response({'detail': 'Provider not found.'}, status=status.HTTP_404_NOT_FOUND)

        service = Service.objects.filter(
            id=service_id, organization=org, is_active=True,
        ).first()
        if not service:
            return Response({'detail': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        ser = ServiceReviewWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        booking_id = data.pop('booking_id', None)

        existing = ServiceReview.objects.filter(
            service=service, customer=request.user,
        ).first()

        completed_booking = None
        if booking_id:
            completed_booking = Booking.objects.filter(
                id=booking_id,
                service=service,
                customer=request.user,
                status=Booking.Status.COMPLETED,
            ).first()
            if not completed_booking:
                raise ValidationError({'booking_id': 'Completed booking not found for this service.'})
        else:
            completed_booking = (
                Booking.objects.filter(
                    service=service,
                    customer=request.user,
                    status=Booking.Status.COMPLETED,
                )
                .order_by('-end_at')
                .first()
            )

        from .serializers import PublicServiceReviewSerializer

        if existing:
            if not customer_can_edit_service_review(service, request.user):
                raise ValidationError('You cannot edit this rating.')
            for key, value in data.items():
                setattr(existing, key, value)
            if completed_booking and not existing.booking_id:
                existing.booking = completed_booking
            existing.save()
            return Response(
                PublicServiceReviewSerializer(existing, context={'request': request}).data,
            )

        if not customer_can_rate_service(service, request.user):
            raise ValidationError(
                'You can rate this service after a completed booking, and only once.'
            )

        review = ServiceReview.objects.create(
            service=service,
            customer=request.user,
            booking=completed_booking,
            **data,
        )
        return Response(
            PublicServiceReviewSerializer(review, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )
