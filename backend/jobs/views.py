from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Case, DateTimeField, IntegerField, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization, OrganizationGalleryImage, OrganizationMembership
from businesses.public_refs import resolve_organization

from .booking_audit import log_booking_event, log_booking_status_change
from .booking_lead import earliest_customer_bookable_at
from .booking_services import (
    accept_booking_request,
    booking_policy_meta,
    cancel_booking,
    complete_booking,
    mark_booking_incomplete,
    mark_booking_no_show,
    reschedule_booking,
    schedule_return_visit,
    customer_can_view_calendar,
    customer_request_slot,
    customer_request_slots_batch,
    decline_booking_request,
    ensure_customer_membership,
    provider_book_customer,
    start_booking,
)
from .datetime_display import format_booking_when
from .message_services import (
    can_access_booking_messages,
    count_unread_summaries,
    list_booking_messages,
    list_customer_conversation_summaries,
    list_provider_conversation_summaries,
    post_booking_incomplete_message,
    post_booking_message,
)
from .models import (
    AvailabilitySlot,
    Booking,
    BookingStatusEvent,
    CustomerNotification,
    CustomerServiceInquiry,
    ProviderNotification,
    Service,
    ServiceCategory,
    ServiceGalleryImage,
    Task,
    UnavailableBlock,
    WeeklyScheduleBlock,
)
from .permissions import (
    is_org_member,
    is_org_staff,
    membership_for,
    require_provider_subscription,
    require_staff_ops,
)
from .scheduling_services import (
    coerce_org_date,
    ensure_flexi_slot_alert,
    get_active_notifications,
    sync_recurring_slots,
)
from .serializers import (
    AvailabilitySlotSerializer,
    UnavailableBlockSerializer,
    BatchBookingSerializer,
    BookingSerializer,
    BookingDetailSerializer,
    OrgCustomerSerializer,
    OrganizationSerializer,
    ProviderBookSerializer,
    ProviderNotificationSerializer,
    CustomerConversationSummarySerializer,
    CustomerNotificationSerializer,
    CustomerServiceInquiryCreateSerializer,
    CustomerServiceInquirySerializer,
    ServiceRequestMessageSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
    TaskSerializer,
    WeeklyScheduleBlockSerializer,
)


def _staff_organization_ids(user):
    return OrganizationMembership.objects.filter(
        user=user,
        role__in=(OrganizationMembership.Role.OWNER, OrganizationMembership.Role.STAFF),
    ).values_list('organization_id', flat=True)


def _customer_organization_ids(user):
    return OrganizationMembership.objects.filter(
        user=user,
        role=OrganizationMembership.Role.CUSTOMER,
    ).values_list('organization_id', flat=True)


class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = []
    serializer_class = OrganizationSerializer
    lookup_field = 'slug'

    def get_throttles(self):
        from luminexa.throttles import ServiceInquiryThrottle

        if getattr(self, 'action', None) == 'service_inquiry':
            return [ServiceInquiryThrottle()]
        return []

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        return (
            Organization.objects.filter(memberships__user=self.request.user)
            .distinct()
            .order_by('name')
        )

    def get_object(self):
        if getattr(self, 'action', None) in ('connect', 'booking_context', 'service_inquiry'):
            org = resolve_organization(self.kwargs.get('slug'))
            if not org or not org.is_active:
                raise ValidationError({'detail': 'Organization not found.'})
            return org
        org = resolve_organization(self.kwargs.get('slug'))
        if org and self.get_queryset().filter(pk=org.pk).exists():
            return org
        return super().get_object()

    def perform_create(self, serializer):
        org = serializer.save()
        OrganizationMembership.objects.create(
            organization=org,
            user=self.request.user,
            role=OrganizationMembership.Role.OWNER,
        )

    def perform_update(self, serializer):
        m = membership_for(self.request.user, serializer.instance)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can update organization settings.')
        allowed = {
            'tagline', 'description', 'profile_public', 'booking_policy', 'name',
            'logo', 'banner', 'scheduling_mode', 'cancel_cutoff_hours',
            'concurrent_capacity',
            'schedule_valid_from', 'schedule_valid_until',
            'service_city', 'service_state', 'service_postal_code', 'service_address',
            'service_latitude', 'service_longitude', 'service_radius_miles',
            'business_types',
        }
        extra = set(serializer.validated_data) - allowed
        if extra:
            raise PermissionDenied(f'Owners cannot update: {", ".join(sorted(extra))}')
        instance = serializer.save()
        if 'scheduling_mode' in serializer.validated_data:
            if instance.scheduling_mode == Organization.SchedulingMode.RECURRING:
                sync_recurring_slots(instance)
            ensure_flexi_slot_alert(instance)

    def perform_destroy(self, instance):
        m = membership_for(self.request.user, instance)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can delete the organization.')
        instance.delete()

    @action(detail=True, methods=['get', 'post'], url_path='locations')
    def locations(self, request, slug=None):
        """List or create service locations / branches for this organization."""
        from businesses.location import (
            assign_location_coordinates,
            ensure_primary_location,
            set_primary_location,
            sync_org_primary_from_location,
        )
        from businesses.models import OrganizationLocation
        from businesses.serializers import OrganizationLocationSerializer

        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')

        if request.method == 'GET':
            ensure_primary_location(org)
            locs = org.locations.all().order_by('-is_primary', 'sort_order', 'id')
            return Response(OrganizationLocationSerializer(locs, many=True).data)

        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can add locations.')
        if org.locations.count() >= OrganizationLocation.MAX_PER_ORGANIZATION:
            raise ValidationError({
                'detail': f'You can add at most {OrganizationLocation.MAX_PER_ORGANIZATION} locations.',
            })

        ser = OrganizationLocationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        make_primary = bool(ser.validated_data.get('is_primary')) or not org.locations.exists()
        location = ser.save(organization=org, is_primary=False)
        if location.latitude is None and (location.postal_code or location.city):
            assign_location_coordinates(location)
        if make_primary:
            set_primary_location(org, location)
        else:
            sync_org_primary_from_location(location)
        return Response(
            OrganizationLocationSerializer(location).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['get', 'patch', 'delete'],
        url_path=r'locations/(?P<location_id>[^/.]+)',
    )
    def location_detail(self, request, slug=None, location_id=None):
        from businesses.location import (
            assign_location_coordinates,
            set_primary_location,
            sync_org_primary_from_location,
        )
        from businesses.models import OrganizationLocation
        from businesses.serializers import OrganizationLocationSerializer

        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        try:
            location = org.locations.get(pk=location_id)
        except (OrganizationLocation.DoesNotExist, ValueError, TypeError):
            raise ValidationError({'detail': 'Location not found.'})

        if request.method == 'GET':
            return Response(OrganizationLocationSerializer(location).data)

        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can change locations.')

        if request.method == 'DELETE':
            was_primary = location.is_primary
            location.delete()
            if was_primary:
                next_loc = org.locations.filter(is_active=True).order_by('id').first()
                if next_loc:
                    set_primary_location(org, next_loc)
            return Response(status=status.HTTP_204_NO_CONTENT)

        ser = OrganizationLocationSerializer(location, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        make_primary = ser.validated_data.pop('is_primary', None)
        location = ser.save()
        if (
            location.latitude is None
            and any(k in request.data for k in ('postal_code', 'city', 'state', 'address'))
        ):
            assign_location_coordinates(location)
        if make_primary is True:
            set_primary_location(org, location)
        elif location.is_primary:
            sync_org_primary_from_location(location)
        return Response(OrganizationLocationSerializer(location).data)

    @action(detail=True, methods=['get'], url_path='booking-context')
    def booking_context(self, request, slug=None):
        org = self.get_object()
        service = None
        service_id = request.query_params.get('service') or request.query_params.get('service_id')
        if service_id:
            from jobs.models import Service

            service = Service.objects.filter(pk=service_id, organization=org).first()
        return Response(booking_policy_meta(org, request.user, service=service))

    @action(detail=True, methods=['get', 'put'], url_path='scheduling-settings')
    def scheduling_settings(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')

        if request.method == 'GET':
            blocks = WeeklyScheduleBlock.objects.filter(organization=org)
            return Response({
                'scheduling_mode': org.scheduling_mode,
                'schedule_valid_from': org.schedule_valid_from,
                'schedule_valid_until': org.schedule_valid_until,
                'timezone': org.timezone,
                'weekly_blocks': WeeklyScheduleBlockSerializer(blocks, many=True).data,
            })

        if not membership_for(request.user, org) or membership_for(request.user, org).role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can update scheduling settings.')

        data = request.data
        update_fields = ['scheduling_mode', 'schedule_valid_from', 'schedule_valid_until', 'updated_at']
        if 'scheduling_mode' in data:
            org.scheduling_mode = data['scheduling_mode']
        if 'schedule_valid_from' in data:
            raw = data['schedule_valid_from']
            org.schedule_valid_from = coerce_org_date(raw) if raw else None
        if 'schedule_valid_until' in data:
            raw = data['schedule_valid_until']
            org.schedule_valid_until = coerce_org_date(raw) if raw else None
        if 'timezone' in data:
            tz_value = (data['timezone'] or '').strip()
            if not tz_value:
                raise ValidationError({'timezone': 'Timezone is required.'})
            try:
                ZoneInfo(tz_value)
            except ZoneInfoNotFoundError as exc:
                raise ValidationError({'timezone': 'Unknown timezone.'}) from exc
            org.timezone = tz_value
            update_fields.append('timezone')
        org.save(update_fields=update_fields)

        if 'weekly_blocks' in data:
            WeeklyScheduleBlock.objects.filter(organization=org).delete()
            for row in data['weekly_blocks']:
                ser = WeeklyScheduleBlockSerializer(data=row)
                ser.is_valid(raise_exception=True)
                WeeklyScheduleBlock.objects.create(organization=org, **ser.validated_data)

        created = 0
        sync_queued = False
        if org.scheduling_mode == Organization.SchedulingMode.RECURRING:
            # Slot generation can take well over the SPA timeout — run in Celery.
            from .tasks import sync_org_recurring_slots

            try:
                sync_org_recurring_slots.delay(org.id, weeks_ahead=12)
                sync_queued = True
            except Exception:
                # Broker unavailable — do a short sync so something is bookable.
                created = sync_recurring_slots(org, weeks_ahead=2)
        ensure_flexi_slot_alert(org)

        blocks = WeeklyScheduleBlock.objects.filter(organization=org)
        return Response({
            'scheduling_mode': org.scheduling_mode,
            'schedule_valid_from': org.schedule_valid_from,
            'schedule_valid_until': org.schedule_valid_until,
            'timezone': org.timezone,
            'weekly_blocks': WeeklyScheduleBlockSerializer(blocks, many=True).data,
            'slots_created': created,
            'sync_queued': sync_queued,
        })

    @action(detail=True, methods=['get', 'put'], url_path='weekly-schedule')
    def weekly_schedule(self, request, slug=None):
        """Legacy alias — prefer scheduling-settings."""
        return self.scheduling_settings(request, slug=slug)

    @action(detail=True, methods=['post'], url_path='sync-recurring-slots')
    def sync_recurring_slots_action(self, request, slug=None):
        org = self.get_object()
        require_staff_ops(request.user, org)
        count = sync_recurring_slots(org)
        return Response({'created': count})

    @action(detail=True, methods=['get'], url_path='conversations')
    def conversations(self, request, slug=None):
        """Provider inbox: booking + inquiry message threads for this organization."""
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        summaries = list_provider_conversation_summaries(org)
        return Response({
            'count': len(summaries),
            'unread_count': count_unread_summaries(summaries),
            'results': CustomerConversationSummarySerializer(summaries, many=True).data,
        })

    @action(detail=True, methods=['get'], url_path='notifications')
    def notifications(self, request, slug=None):
        """List provider in-app notifications (active by default; include dismissed with ?include_dismissed=1)."""
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        from .scheduling_services import ensure_flexi_slot_alert

        ensure_flexi_slot_alert(org)
        include_dismissed = str(
            request.query_params.get('include_dismissed', '')
        ).lower() in ('1', 'true', 'yes')
        qs = ProviderNotification.objects.filter(organization=org).order_by('-created_at')
        if not include_dismissed:
            qs = qs.filter(dismissed_at__isnull=True)
        qs = qs[:100]
        return Response({
            'results': ProviderNotificationSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path=r'notifications/(?P<notification_id>[^/.]+)/dismiss')
    def dismiss_notification(self, request, slug=None, notification_id=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        note = ProviderNotification.objects.filter(
            organization=org, pk=notification_id, dismissed_at__isnull=True,
        ).first()
        if not note:
            raise ValidationError({'detail': 'Notification not found.'})
        note.dismissed_at = timezone.now()
        note.save(update_fields=['dismissed_at'])
        return Response({'detail': 'Dismissed.'})

    @action(detail=True, methods=['get', 'post'], url_path='gallery')
    def gallery(self, request, slug=None):
        org = self.get_object()
        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can manage gallery images.')

        if request.method == 'GET':
            from .serializers import PublicGalleryImageSerializer
            images = org.gallery_images.all()[: OrganizationGalleryImage.MAX_PER_ORGANIZATION]
            return Response(
                PublicGalleryImageSerializer(images, many=True, context={'request': request}).data
            )

        require_provider_subscription(org)
        if org.gallery_images.count() >= OrganizationGalleryImage.MAX_PER_ORGANIZATION:
            raise ValidationError(
                f'Maximum {OrganizationGalleryImage.MAX_PER_ORGANIZATION} gallery images allowed.'
            )
        from luminexa.uploads import validate_uploaded_image
        image_file = validate_uploaded_image(request.FILES.get('image'))
        caption = request.data.get('caption', '')
        sort_order = org.gallery_images.count()
        item = OrganizationGalleryImage.objects.create(
            organization=org,
            image=image_file,
            caption=caption,
            sort_order=sort_order,
        )
        from .serializers import PublicGalleryImageSerializer
        return Response(
            PublicGalleryImageSerializer(item, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'gallery/(?P<image_id>[^/.]+)',
    )
    def gallery_delete(self, request, slug=None, image_id=None):
        org = self.get_object()
        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can manage gallery images.')
        require_provider_subscription(org)
        item = org.gallery_images.filter(pk=image_id).first()
        if not item:
            raise ValidationError({'detail': 'Image not found.'})
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='connect')
    def connect(self, request, slug=None):
        org = self.get_object()
        if not org.profile_public:
            raise ValidationError('This business is not available.')
        membership = ensure_customer_membership(org, request.user)
        if membership.customer_status == OrganizationMembership.CustomerStatus.BLOCKED:
            return Response({
                'detail': (
                    'You cannot book with this business. '
                    'Contact them if you think this is a mistake.'
                ),
                'organization_slug': org.slug,
                'customer_status': membership.customer_status,
                'booking_policy': org.booking_policy,
                'is_blocked': True,
            })
        if org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY:
            msg = (
                'Connection requested. You can view the calendar while waiting for approval.'
                if membership.customer_status == OrganizationMembership.CustomerStatus.PENDING
                else 'Connected.'
            )
        else:
            msg = 'Connected. You can request or book open slots.'
        return Response({
            'detail': msg,
            'organization_slug': org.slug,
            'customer_status': membership.customer_status,
            'booking_policy': org.booking_policy,
        })

    @action(detail=True, methods=['post'], url_path='service-inquiry')
    def service_inquiry(self, request, slug=None):
        org = self.get_object()
        if not org.profile_public or not org.is_active:
            raise ValidationError('This business is not available.')
        membership = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
            role=OrganizationMembership.Role.CUSTOMER,
        ).first()
        if not membership:
            if org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY:
                raise PermissionDenied('Request access to this business before sending a service request.')
            membership = ensure_customer_membership(org, request.user)
        if (
            org.booking_policy == Organization.BookingPolicy.CLIENTS_ONLY
            and membership.customer_status != OrganizationMembership.CustomerStatus.APPROVED
        ):
            raise PermissionDenied(
                'Your access request is pending. You can send service requests after the business approves you.'
            )
        ser = CustomerServiceInquiryCreateSerializer(
            data=request.data,
            context={'organization': org},
        )
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        inquiry = CustomerServiceInquiry.objects.create(
            organization=org,
            customer=request.user,
            service=data.get('service'),
            service_label=(data.get('service_label') or '').strip(),
            message=data['message'],
            service_address=(data.get('service_address') or '').strip(),
            preferred_date=data.get('preferred_date'),
        )
        return Response(
            CustomerServiceInquirySerializer(inquiry).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['post'],
        url_path=r'service-inquiries/(?P<inquiry_id>[^/.]+)/dismiss',
    )
    def dismiss_service_inquiry(self, request, slug=None, inquiry_id=None):
        org = self.get_object()
        require_staff_ops(request.user, org)
        inquiry = CustomerServiceInquiry.objects.filter(
            organization=org, pk=inquiry_id, dismissed_at__isnull=True,
        ).first()
        if not inquiry:
            raise ValidationError({'detail': 'Inquiry not found.'})
        inquiry.dismissed_at = timezone.now()
        inquiry.status = CustomerServiceInquiry.Status.DECLINED
        inquiry.save(update_fields=['dismissed_at', 'status'])
        return Response({'detail': 'Dismissed.'})

    @action(detail=True, methods=['get'], url_path='customers')
    def customers(self, request, slug=None):
        from django.db.models import Count, F

        from .models import BookingStatusEvent

        org = self.get_object()
        require_staff_ops(request.user, org)
        status_filter = request.query_params.get('status', 'approved')
        memberships = OrganizationMembership.objects.filter(
            organization=org,
            role=OrganizationMembership.Role.CUSTOMER,
        ).select_related('user')
        if status_filter == 'pending':
            memberships = memberships.filter(
                customer_status=OrganizationMembership.CustomerStatus.PENDING,
            )
        elif status_filter == 'approved':
            memberships = memberships.filter(
                customer_status=OrganizationMembership.CustomerStatus.APPROVED,
            )
        elif status_filter == 'blocked':
            memberships = memberships.filter(
                customer_status=OrganizationMembership.CustomerStatus.BLOCKED,
            )
        elif status_filter != 'all':
            raise ValidationError({
                'status': 'Use approved, pending, blocked, or all.',
            })
        memberships = list(memberships.order_by('user__full_name'))
        user_ids = [m.user_id for m in memberships]
        cancel_counts = {
            row['booking__customer_id']: row['c']
            for row in BookingStatusEvent.objects.filter(
                booking__organization=org,
                booking__customer_id__in=user_ids,
                action=BookingStatusEvent.Action.CANCELLED,
                actor_id=F('booking__customer_id'),
            ).values('booking__customer_id').annotate(c=Count('id'))
        }
        no_show_counts = {
            row['booking__customer_id']: row['c']
            for row in BookingStatusEvent.objects.filter(
                booking__organization=org,
                booking__customer_id__in=user_ids,
                action=BookingStatusEvent.Action.NO_SHOW,
            ).values('booking__customer_id').annotate(c=Count('id'))
        }
        data = [
            {
                'id': m.user_id,
                'email': m.user.email,
                'full_name': m.user.full_name,
                'phone': m.user.phone or '',
                'membership_id': m.id,
                'customer_status': m.customer_status,
                'cancel_count': cancel_counts.get(m.user_id, 0),
                'no_show_count': no_show_counts.get(m.user_id, 0),
            }
            for m in memberships
        ]
        return Response(OrgCustomerSerializer(data, many=True).data)

    @action(detail=True, methods=['post'], url_path='approve-customer')
    def approve_customer(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can approve customers.')
        require_provider_subscription(org)
        user_id = request.data.get('user_id')
        if not user_id:
            raise ValidationError({'user_id': 'Required.'})
        membership = OrganizationMembership.objects.filter(
            organization=org,
            user_id=user_id,
            role=OrganizationMembership.Role.CUSTOMER,
        ).first()
        if not membership:
            raise ValidationError({'detail': 'Customer not found.'})
        membership.customer_status = OrganizationMembership.CustomerStatus.APPROVED
        membership.save(update_fields=['customer_status'])
        return Response({'detail': 'Customer approved.', 'user_id': int(user_id)})

    @action(detail=True, methods=['post'], url_path='block-customer')
    def block_customer(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can block customers.')
        require_provider_subscription(org)
        user_id = request.data.get('user_id')
        if not user_id:
            raise ValidationError({'user_id': 'Required.'})
        membership = OrganizationMembership.objects.filter(
            organization=org,
            user_id=user_id,
            role=OrganizationMembership.Role.CUSTOMER,
        ).first()
        if not membership:
            raise ValidationError({'detail': 'Customer not found.'})
        membership.customer_status = OrganizationMembership.CustomerStatus.BLOCKED
        membership.save(update_fields=['customer_status'])
        return Response({
            'detail': 'Customer blocked.',
            'user_id': int(user_id),
            'customer_status': membership.customer_status,
        })

    @action(detail=True, methods=['post'], url_path='unblock-customer')
    def unblock_customer(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can unblock customers.')
        require_provider_subscription(org)
        user_id = request.data.get('user_id')
        if not user_id:
            raise ValidationError({'user_id': 'Required.'})
        membership = OrganizationMembership.objects.filter(
            organization=org,
            user_id=user_id,
            role=OrganizationMembership.Role.CUSTOMER,
        ).first()
        if not membership:
            raise ValidationError({'detail': 'Customer not found.'})
        membership.customer_status = OrganizationMembership.CustomerStatus.APPROVED
        membership.save(update_fields=['customer_status'])
        return Response({
            'detail': 'Customer unblocked.',
            'user_id': int(user_id),
            'customer_status': membership.customer_status,
        })

    @action(detail=True, methods=['post'], url_path='invite-staff')
    def invite_staff(self, request, slug=None):
        from businesses.models import StaffInvitation
        from django.core.mail import send_mail
        from django.conf import settings

        org = self.get_object()
        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can invite staff.')
        require_provider_subscription(org)
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            raise ValidationError({'email': 'Required.'})
        existing = OrganizationMembership.objects.filter(
            organization=org,
            user__email__iexact=email,
            role__in=(OrganizationMembership.Role.OWNER, OrganizationMembership.Role.STAFF),
        ).exists()
        if existing:
            raise ValidationError({'email': 'This person is already on your team.'})
        invite, created = StaffInvitation.objects.get_or_create(
            organization=org,
            email=email,
            defaults={'invited_by': request.user},
        )
        if not created and invite.accepted_at:
            raise ValidationError({'email': 'Invitation already accepted.'})
        accept_url = (
            f'{settings.PUBLIC_APP_URL.rstrip("/")}/accept-staff-invite'
            f'?token={invite.token}'
        )
        try:
            send_mail(
                subject=f'Join {org.name} on Luminexa',
                message=(
                    f'You have been invited to join {org.name} as staff.\n\n'
                    f'Sign in or create an account, then open:\n{accept_url}'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception:
            pass
        return Response({'detail': 'Invitation sent.', 'email': email})

    @action(detail=True, methods=['get'], url_path='staff-invitations')
    def staff_invitations(self, request, slug=None):
        from businesses.models import StaffInvitation

        org = self.get_object()
        require_staff_ops(request.user, org)
        invites = StaffInvitation.objects.filter(
            organization=org, accepted_at__isnull=True,
        ).order_by('-created_at')
        data = [
            {'id': i.id, 'email': i.email, 'created_at': i.created_at}
            for i in invites
        ]
        return Response(data)


class ServiceCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCategorySerializer
    http_method_names = ['get', 'head', 'options']  # Platform admin manages catalog via BusinessType

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = ServiceCategory.objects.select_related('organization').filter(
            organization__memberships__user=self.request.user,
        )
        slug = self.request.query_params.get('organization')
        if slug:
            org = Organization.objects.filter(slug=slug).first()
            if org and is_org_member(self.request.user, org):
                from .catalog import ensure_org_categories_from_business_types
                ensure_org_categories_from_business_types(org)
            qs = qs.filter(organization__slug=slug)
        return qs.filter(is_active=True).distinct().order_by('sort_order', 'name')

    def create(self, request, *args, **kwargs):
        raise PermissionDenied(
            'Categories are managed by Luminexa admins. Choose from the existing list.'
        )

    def update(self, request, *args, **kwargs):
        raise PermissionDenied('Categories are managed by Luminexa admins.')

    def partial_update(self, request, *args, **kwargs):
        raise PermissionDenied('Categories are managed by Luminexa admins.')

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied('Categories are managed by Luminexa admins.')


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Service.objects.select_related('organization', 'category').filter(
            organization__memberships__user=self.request.user,
        )
        slug = self.request.query_params.get('organization')
        if slug:
            qs = qs.filter(organization__slug=slug)
        return qs.distinct().order_by('sort_order', 'name')

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        require_staff_ops(self.request.user, org)
        serializer.save()

    def perform_update(self, serializer):
        require_staff_ops(self.request.user, serializer.instance.organization)
        serializer.save()

    def perform_destroy(self, instance):
        require_staff_ops(self.request.user, instance.organization)
        instance.delete()

    @action(detail=True, methods=['get', 'post'], url_path='gallery')
    def gallery(self, request, pk=None):
        service = self.get_object()
        require_staff_ops(request.user, service.organization)

        if request.method == 'GET':
            from .serializers import PublicServiceGalleryImageSerializer
            images = service.gallery_images.all()[: ServiceGalleryImage.MAX_PER_SERVICE]
            return Response(
                PublicServiceGalleryImageSerializer(images, many=True, context={'request': request}).data
            )

        if service.gallery_images.count() >= ServiceGalleryImage.MAX_PER_SERVICE:
            raise ValidationError(
                f'Maximum {ServiceGalleryImage.MAX_PER_SERVICE} images allowed per service.'
            )
        image_file = request.FILES.get('image')
        from luminexa.uploads import validate_uploaded_image
        image_file = validate_uploaded_image(
            image_file, max_bytes=ServiceGalleryImage.MAX_BYTES,
        )
        sort_order = service.gallery_images.count()
        item = ServiceGalleryImage.objects.create(
            service=service,
            image=image_file,
            sort_order=sort_order,
        )
        from .serializers import PublicServiceGalleryImageSerializer
        return Response(
            PublicServiceGalleryImageSerializer(item, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'gallery/(?P<image_id>[^/.]+)',
    )
    def gallery_delete(self, request, pk=None, image_id=None):
        service = self.get_object()
        require_staff_ops(request.user, service.organization)
        item = service.gallery_images.filter(pk=image_id).first()
        if not item:
            raise ValidationError({'detail': 'Image not found.'})
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySlotSerializer
    http_method_names = ['get', 'post', 'head', 'options', 'delete']

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if user and user.is_authenticated:
            ctx['staff_org_ids'] = set(_staff_organization_ids(user))
        else:
            ctx['staff_org_ids'] = set()
        return ctx

    def get_queryset(self):
        user = self.request.user
        staff_ids = list(_staff_organization_ids(user))
        slug = self.request.query_params.get('organization')

        qs = AvailabilitySlot.objects.select_related(
            'organization', 'service',
        ).prefetch_related('bookings__customer')

        if slug:
            org = Organization.objects.filter(slug=slug, is_active=True).first()
            if not org:
                return qs.none()
            if org.id in staff_ids or is_org_staff(user, org):
                qs = qs.filter(organization=org)
            elif customer_can_view_calendar(org, user):
                qs = qs.filter(organization=org)
            else:
                return qs.none()
        else:
            customer_ids = _customer_organization_ids(user)
            qs = qs.filter(
                Q(organization_id__in=staff_ids) | Q(organization_id__in=customer_ids),
            )

        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        open_only = self.request.query_params.get('open_only')
        if open_only and open_only.lower() in ('1', 'true', 'yes'):
            # Customer-facing open slots must respect the booking lead-time buffer.
            qs = qs.filter(
                status=AvailabilitySlot.Status.OPEN,
                start_at__gte=earliest_customer_bookable_at(),
            )

        # Optional window so provider schedule does not download months of slots at once.
        from django.utils.dateparse import parse_datetime, parse_date
        from datetime import datetime, time as dt_time
        from django.utils import timezone as dj_tz

        start_param = self.request.query_params.get('from') or self.request.query_params.get('start')
        end_param = self.request.query_params.get('until') or self.request.query_params.get('end')
        if start_param:
            start_dt = parse_datetime(start_param)
            if start_dt is None:
                d = parse_date(start_param)
                if d:
                    start_dt = datetime.combine(d, dt_time.min)
            if start_dt is not None:
                if dj_tz.is_naive(start_dt):
                    start_dt = dj_tz.make_aware(start_dt, dj_tz.get_current_timezone())
                qs = qs.filter(start_at__gte=start_dt)
        if end_param:
            end_dt = parse_datetime(end_param)
            if end_dt is None:
                d = parse_date(end_param)
                if d:
                    end_dt = datetime.combine(d, dt_time.max)
            if end_dt is not None:
                if dj_tz.is_naive(end_dt):
                    end_dt = dj_tz.make_aware(end_dt, dj_tz.get_current_timezone())
                qs = qs.filter(start_at__lte=end_dt)

        return qs.distinct().order_by('start_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        slug = request.query_params.get('organization')
        if slug:
            org = Organization.objects.filter(slug=slug).first()
            if org:
                service = None
                service_id = request.query_params.get('service')
                if service_id:
                    from .models import Service
                    service = Service.objects.filter(pk=service_id, organization=org).first()
                response.data = {
                    'slots': response.data,
                    'booking': booking_policy_meta(org, request.user, service=service),
                }
        return response

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        require_staff_ops(self.request.user, org)
        serializer.save(created_by=self.request.user)
        ensure_flexi_slot_alert(org)

    def perform_destroy(self, instance):
        require_staff_ops(self.request.user, instance.organization)
        if instance.occupied_count() > 0:
            raise ValidationError('Only slots with no active bookings can be deleted.')
        if instance.status != AvailabilitySlot.Status.OPEN:
            raise ValidationError('Only open slots with no pending booking can be deleted.')
        org = instance.organization
        instance.delete()
        ensure_flexi_slot_alert(org)


class UnavailableBlockViewSet(viewsets.ModelViewSet):
    serializer_class = UnavailableBlockSerializer
    http_method_names = ['get', 'post', 'head', 'options', 'delete']

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        staff_ids = list(_staff_organization_ids(user))
        slug = self.request.query_params.get('organization')
        qs = UnavailableBlock.objects.select_related('organization')
        if slug:
            org = Organization.objects.filter(slug=slug, is_active=True).first()
            if not org or not is_org_staff(user, org):
                return qs.none()
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization_id__in=staff_ids)
        day = self.request.query_params.get('date')
        if day:
            qs = qs.filter(start_at__date=day)
        return qs.order_by('start_at')

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        require_staff_ops(self.request.user, org)
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        require_staff_ops(self.request.user, instance.organization)
        instance.delete()


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    http_method_names = ['get', 'post', 'head', 'options', 'patch']

    def get_throttles(self):
        from luminexa.throttles import BookingCreateThrottle

        if self.action in ('create', 'batch'):
            return [BookingCreateThrottle()]
        return []

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BookingDetailSerializer
        return BookingSerializer

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        staff_org_ids = _staff_organization_ids(user)
        qs = Booking.objects.select_related(
            'organization', 'service', 'customer', 'availability_slot', 'invoice',
        ).filter(
            Q(customer=user) | Q(organization_id__in=staff_org_ids),
        )
        slug = self.request.query_params.get('organization')
        if slug:
            qs = qs.filter(organization__slug=slug)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if self.action in ('retrieve', 'list'):
            qs = qs.prefetch_related('status_events__actor', 'return_visits')
        return qs.distinct().order_by('-start_at')

    def create(self, request, *args, **kwargs):
        if request.data.get('customer') is not None:
            return self._provider_book(request)
        return self._customer_request(request)

    def _provider_book(self, request):
        ser = ProviderBookSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        org = data['organization']
        require_staff_ops(request.user, org)
        booking = provider_book_customer(
            org=org,
            service=data['service'],
            customer=data['customer'],
            start_at=data['start_at'],
            end_at=data['end_at'],
            staff_user=request.user,
            slot=data.get('slot_id'),
            notes=data.get('customer_notes') or '',
        )
        return Response(
            BookingSerializer(booking, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _customer_request(self, request):
        ser = BookingSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        slot = ser.validated_data.get('availability_slot')
        if not slot:
            raise ValidationError({'slot_id': 'Customers must request an open slot (slot_id).'})
        notes = ser.validated_data.get('customer_notes', '')
        booking = customer_request_slot(
            slot=slot,
            customer=request.user,
            service=ser.validated_data.get('service'),
            notes=notes,
            service_address=ser.validated_data.get('service_address', '') or '',
            quote_answers=ser.validated_data.get('quote_answers'),
        )
        log_booking_event(
            booking,
            action=BookingStatusEvent.Action.CREATED,
            actor=request.user,
            new_status=booking.status,
        )
        from .notifications import notify_customer_booking_created

        notify_customer_booking_created(booking)
        return Response(
            BookingSerializer(booking, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='batch')
    def batch(self, request):
        """Book multiple services from one provider in a single request."""
        ser = BatchBookingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        shared_notes = (data.get('customer_notes') or '').strip()
        shared_address = (data.get('service_address') or '').strip()
        items = []
        for row in data['bookings']:
            items.append({
                'slot': row['slot_id'],
                'service': row.get('service'),
                'notes': (row.get('customer_notes') or shared_notes or '').strip(),
                'service_address': (row.get('service_address') or shared_address or '').strip(),
                'quote_answers': row.get('quote_answers'),
            })
        bookings = customer_request_slots_batch(items=items, customer=request.user)
        from .notifications import notify_customer_booking_created

        for booking in bookings:
            log_booking_event(
                booking,
                action=BookingStatusEvent.Action.CREATED,
                actor=request.user,
                new_status=booking.status,
            )
            notify_customer_booking_created(booking)
        return Response(
            BookingSerializer(bookings, many=True, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        booking = serializer.instance
        user = self.request.user
        new_status = serializer.validated_data.get('status')
        if booking.customer_id == user.id:
            allowed = {'customer_notes'}
            if any(k not in allowed for k in serializer.validated_data):
                raise PermissionDenied('Customers can only update customer_notes.')
            serializer.save()
            return
        require_staff_ops(user, booking.organization)
        if new_status == Booking.Status.CONFIRMED and booking.status == Booking.Status.REQUESTED:
            accept_booking_request(booking, user)
            return
        if new_status == Booking.Status.CANCELLED and booking.status == Booking.Status.REQUESTED:
            decline_booking_request(booking)
            return
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        old = booking.status
        accept_booking_request(booking, request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.ACCEPTED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import notify_booking_accepted
        notify_booking_accepted(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='send-quote')
    def send_quote(self, request, pk=None):
        from .booking_services import send_booking_quote

        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        slot = None
        slot_id = request.data.get('slot_id')
        if slot_id not in (None, ''):
            slot = AvailabilitySlot.objects.filter(pk=slot_id).first()
            if not slot:
                raise ValidationError({'slot_id': 'Slot not found.'})
        old = booking.status
        send_booking_quote(
            booking,
            staff_user=request.user,
            amount=request.data.get('amount'),
            message=request.data.get('message') or '',
            questions=request.data.get('questions'),
            new_slot=slot,
        )
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.QUOTED,
            old_status=old,
            new_status=booking.status,
            note=(request.data.get('message') or '')[:200],
        )
        from .notifications import notify_booking_quoted

        notify_booking_quoted(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='accept-quote')
    def accept_quote(self, request, pk=None):
        from .booking_services import accept_booking_quote

        booking = self.get_object()
        old = booking.status
        accept_booking_quote(
            booking,
            customer=request.user,
            answers=request.data.get('answers'),
        )
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.QUOTE_ACCEPTED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import notify_booking_accepted
        notify_booking_accepted(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='accept-time-change')
    def accept_time_change(self, request, pk=None):
        from .booking_services import accept_provider_time_change

        booking = self.get_object()
        old = booking.status
        accept_provider_time_change(booking, customer=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.ACCEPTED,
            old_status=old,
            new_status=booking.status,
            note='Customer accepted provider time change',
        )
        from .notifications import notify_booking_accepted

        notify_booking_accepted(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='decline-time-change')
    def decline_time_change(self, request, pk=None):
        from .booking_services import decline_provider_time_change

        booking = self.get_object()
        old = booking.status
        decline_provider_time_change(booking, customer=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=(
                BookingStatusEvent.Action.DECLINED
                if booking.status == Booking.Status.CANCELLED
                else BookingStatusEvent.Action.RESCHEDULED
            ),
            old_status=old,
            new_status=booking.status,
            note='Customer declined provider time change',
        )
        if booking.status == Booking.Status.CANCELLED:
            from .notifications import notify_booking_declined

            notify_booking_declined(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        booking = self.get_object()
        # Staff decline OR customer declining a quote
        is_staff = is_org_staff(request.user, booking.organization)
        is_customer = booking.customer_id == request.user.id
        if not is_staff and not is_customer:
            raise PermissionDenied('Only staff or the customer can decline this request.')
        if is_staff:
            require_provider_subscription(booking.organization)
        if is_customer and booking.status != Booking.Status.QUOTED:
            raise PermissionDenied('You can only decline after a quote is sent.')
        old = booking.status
        decline_booking_request(booking)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.DECLINED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import notify_booking_declined
        notify_booking_declined(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        old = booking.status
        cancel_booking(booking, by_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.CANCELLED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import notify_booking_cancelled
        notify_booking_cancelled(booking, by_user=request.user)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        old = booking.status
        start_booking(booking, staff_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.STARTED,
            old_status=old,
            new_status=booking.status,
        )
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        from .invoice_services import default_invoice_amount, issue_or_update_invoice

        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        old = booking.status
        complete_booking(booking, staff_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.COMPLETED,
            old_status=old,
            new_status=booking.status,
        )

        amount = request.data.get('amount', None)
        subtotal = request.data.get('subtotal', None)
        service_fee = request.data.get('service_fee', None)
        line_items = request.data.get('line_items', None)
        if (
            (service_fee is None or service_fee == '')
            and (subtotal is None or subtotal == '')
            and (amount is None or amount == '')
        ):
            amount = default_invoice_amount(booking)
        notes = request.data.get('notes', '') or ''
        mark_paid = bool(request.data.get('mark_paid'))
        invoice = issue_or_update_invoice(
            booking,
            staff_user=request.user,
            amount=amount,
            subtotal=subtotal,
            service_fee=service_fee,
            line_items=line_items,
            notes=notes,
            mark_paid=mark_paid,
        )

        from .notifications import notify_booking_completed
        notify_booking_completed(booking)
        booking = (
            Booking.objects.select_related(
                'invoice', 'service', 'organization', 'customer', 'availability_slot',
            )
            .prefetch_related('status_events__actor')
            .get(pk=booking.pk)
        )
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='invoice')
    def invoice(self, request, pk=None):
        """GET invoice JSON; POST create/update (staff)."""
        from .invoice_services import issue_or_update_invoice, suggested_invoice_payload
        from .models import Invoice
        from .serializers import InvoiceSerializer

        booking = self.get_object()
        if request.method == 'GET':
            try:
                inv = booking.invoice
            except Invoice.DoesNotExist:
                if is_org_staff(request.user, booking.organization):
                    suggestion = suggested_invoice_payload(booking)
                    serializable = {}
                    for k, v in suggestion.items():
                        if v is None:
                            serializable[k] = None
                        elif isinstance(v, (list, dict, bool)):
                            serializable[k] = v
                        else:
                            serializable[k] = str(v)
                    return Response({
                        'invoice': None,
                        'suggestion': serializable,
                    })
                return Response({'detail': 'No invoice yet.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(InvoiceSerializer(inv, context={'request': request}).data)

        require_staff_ops(request.user, booking.organization)
        amount = request.data.get('amount')
        subtotal = request.data.get('subtotal')
        service_fee = request.data.get('service_fee')
        line_items = request.data.get('line_items')
        notes = request.data.get('notes', '') or ''
        mark_paid = bool(request.data.get('mark_paid'))
        description = request.data.get('description', '') or ''
        inv = issue_or_update_invoice(
            booking,
            staff_user=request.user,
            amount=amount,
            subtotal=subtotal,
            service_fee=service_fee,
            line_items=line_items,
            notes=notes,
            mark_paid=mark_paid,
            description=description,
        )
        if not mark_paid:
            from .notifications import notify_invoice_ready

            notify_invoice_ready(booking)
        return Response(InvoiceSerializer(inv, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='invoice/mark-paid')
    def invoice_mark_paid(self, request, pk=None):
        from .invoice_services import mark_invoice_paid
        from .models import Invoice
        from .serializers import InvoiceSerializer

        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        try:
            inv = booking.invoice
        except Invoice.DoesNotExist:
            return Response({'detail': 'No invoice yet.'}, status=status.HTTP_404_NOT_FOUND)
        inv = mark_invoice_paid(inv, staff_user=request.user)
        return Response(InvoiceSerializer(inv, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='invoice/download')
    def invoice_download(self, request, pk=None):
        """Download invoice as PDF (customer or staff)."""
        from django.http import HttpResponse

        from .invoice_pdf import build_invoice_pdf
        from .models import Invoice

        booking = self.get_object()
        is_customer = booking.customer_id == request.user.id
        if not is_customer and not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('You cannot access this invoice.')
        try:
            inv = booking.invoice
        except Invoice.DoesNotExist:
            return Response({'detail': 'No invoice yet.'}, status=status.HTTP_404_NOT_FOUND)

        pdf = build_invoice_pdf(inv)
        filename = f'{inv.number}.pdf'
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        booking = self.get_object()
        slot_id = request.data.get('slot_id')
        if not slot_id:
            raise ValidationError({'slot_id': 'Required.'})
        slot = AvailabilitySlot.objects.filter(pk=slot_id).first()
        if not slot:
            raise ValidationError({'slot_id': 'Slot not found.'})
        old_status = booking.status
        prior_when = format_booking_when(booking.start_at)
        reschedule_booking(booking, new_slot=slot, by_user=request.user)
        new_when = format_booking_when(booking.start_at)
        note = (
            f'New time: {new_when} (was {prior_when})'
            if prior_when and prior_when != new_when
            else f'New time: {new_when}'
        )
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.RESCHEDULED,
            old_status=old_status,
            new_status=booking.status,
            note=note,
        )
        from .notifications import (
            create_provider_customer_reschedule_notification,
            notify_booking_rescheduled_by_provider,
            send_booking_email,
        )

        if booking.customer_id == request.user.id:
            create_provider_customer_reschedule_notification(booking)
            send_booking_email('booking_reschedule_requested', booking)
        else:
            notify_booking_rescheduled_by_provider(booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='no-show')
    def no_show(self, request, pk=None):
        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        old = booking.status
        mark_booking_no_show(booking, staff_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.NO_SHOW,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import notify_booking_cancelled
        notify_booking_cancelled(booking, by_user=request.user)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def incomplete(self, request, pk=None):
        """Mark in-progress job incomplete; optionally schedule a linked return visit."""
        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        note = (request.data.get('note') or '').strip()
        slot_id = request.data.get('slot_id')
        old = booking.status

        if slot_id:
            slot = AvailabilitySlot.objects.filter(pk=slot_id).first()
            if not slot:
                raise ValidationError({'slot_id': 'Slot not found.'})
            return_booking = schedule_return_visit(
                booking, new_slot=slot, staff_user=request.user, note=note,
            )
            booking.refresh_from_db()
            log_booking_status_change(
                booking,
                actor=request.user,
                action=BookingStatusEvent.Action.INCOMPLETE,
                old_status=old,
                new_status=booking.status,
                note=note[:500] if note else 'Return visit scheduled',
            )
            log_booking_status_change(
                return_booking,
                actor=request.user,
                action=BookingStatusEvent.Action.RETURN_SCHEDULED,
                old_status='',
                new_status=return_booking.status,
                note=f'Return visit for booking #{booking.id}',
            )
            log_booking_event(
                return_booking,
                actor=request.user,
                action=BookingStatusEvent.Action.CREATED,
                new_status=return_booking.status,
                note='Return visit created',
            )
            try:
                post_booking_incomplete_message(
                    booking=booking,
                    sender=request.user,
                    note=note,
                    return_booking=return_booking,
                )
            except Exception:
                pass
            return Response({
                'booking': BookingSerializer(booking, context={'request': request}).data,
                'return_booking': BookingSerializer(
                    return_booking, context={'request': request},
                ).data,
            })

        mark_booking_incomplete(booking, staff_user=request.user, note=note)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.INCOMPLETE,
            old_status=old,
            new_status=booking.status,
            note=note[:500] if note else 'Return visit to be scheduled',
        )
        try:
            post_booking_incomplete_message(
                booking=booking, sender=request.user, note=note,
            )
        except Exception:
            pass
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='return-visit')
    def return_visit(self, request, pk=None):
        """Schedule a linked return visit for a needs_return (or in-progress) booking."""
        booking = self.get_object()
        require_staff_ops(request.user, booking.organization)
        slot_id = request.data.get('slot_id')
        if not slot_id:
            raise ValidationError({'slot_id': 'Required.'})
        slot = AvailabilitySlot.objects.filter(pk=slot_id).first()
        if not slot:
            raise ValidationError({'slot_id': 'Slot not found.'})
        note = (request.data.get('note') or '').strip()
        old = booking.status
        return_booking = schedule_return_visit(
            booking, new_slot=slot, staff_user=request.user, note=note,
        )
        booking.refresh_from_db()
        if old == Booking.Status.IN_PROGRESS:
            log_booking_status_change(
                booking,
                actor=request.user,
                action=BookingStatusEvent.Action.INCOMPLETE,
                old_status=old,
                new_status=booking.status,
                note=note[:500] if note else 'Return visit scheduled',
            )
        log_booking_status_change(
            return_booking,
            actor=request.user,
            action=BookingStatusEvent.Action.RETURN_SCHEDULED,
            old_status='',
            new_status=return_booking.status,
            note=f'Return visit for booking #{booking.id}',
        )
        log_booking_event(
            return_booking,
            actor=request.user,
            action=BookingStatusEvent.Action.CREATED,
            new_status=return_booking.status,
            note='Return visit created',
        )
        try:
            post_booking_incomplete_message(
                booking=booking,
                sender=request.user,
                note=note,
                return_booking=return_booking,
            )
        except Exception:
            pass
        return Response({
            'booking': BookingSerializer(booking, context={'request': request}).data,
            'return_booking': BookingSerializer(
                return_booking, context={'request': request},
            ).data,
        })

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        from .message_services import mark_booking_messages_read

        booking = self.get_object()
        if not can_access_booking_messages(request.user, booking):
            raise PermissionDenied('You cannot view messages on this booking.')
        if request.method == 'GET':
            messages = list_booking_messages(booking)
            mark_booking_messages_read(booking=booking, user=request.user)
            return Response(
                ServiceRequestMessageSerializer(
                    messages, many=True, context={'request': request},
                ).data,
            )
        if is_org_staff(request.user, booking.organization):
            require_provider_subscription(booking.organization)
        message = post_booking_message(
            booking=booking,
            sender=request.user,
            body=request.data.get('body', ''),
        )
        return Response(
            ServiceRequestMessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='ical')
    def ical(self, request, pk=None):
        """Return an iCalendar (.ics) file for this booking."""
        from django.http import HttpResponse

        booking = self.get_object()
        # Allow both the customer and provider staff to download the calendar file
        is_customer = booking.customer_id == request.user.id
        if not is_customer and not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('You cannot access this booking.')

        org = booking.organization
        service_name = booking.service.name if booking.service_id else 'Appointment'
        ref = f'BK-{booking.pk:05d}'

        def fmt(dt):
            """Format datetime to iCal UTC format."""
            from django.utils import timezone as tz
            utc = tz.utc
            return dt.astimezone(utc).strftime('%Y%m%dT%H%M%SZ')

        uid = f'{ref}@luminexa'
        now_stamp = fmt(__import__('django.utils.timezone', fromlist=['now']).timezone.now())
        dtstart = fmt(booking.start_at)
        dtend = fmt(booking.end_at)
        summary = f'{service_name} — {org.name}'
        location = booking.service_address or ''
        description = f'Reference: {ref}\\nProvider: {org.name}'
        if booking.customer_notes:
            description += f'\\nNotes: {booking.customer_notes}'

        lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Luminexa//Booking//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            f'UID:{uid}',
            f'DTSTAMP:{now_stamp}',
            f'DTSTART:{dtstart}',
            f'DTEND:{dtend}',
            f'SUMMARY:{summary}',
            f'DESCRIPTION:{description}',
            f'LOCATION:{location}',
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR',
        ]
        content = '\r\n'.join(lines) + '\r\n'
        filename = f'luminexa-{ref}.ics'
        response = HttpResponse(content, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class CustomerMyInquiriesAPIView(APIView):
    """Past custom service requests submitted by the logged-in customer."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            CustomerServiceInquiry.objects.filter(customer=request.user)
            .select_related('organization', 'service')
            .order_by('-created_at')
        )
        data = CustomerServiceInquirySerializer(qs, many=True).data
        return Response(data)


class CustomerConversationsAPIView(APIView):
    """Unified booking + inquiry message threads for the customer inbox."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        summaries = list_customer_conversation_summaries(request.user)
        data = CustomerConversationSummarySerializer(summaries, many=True).data
        return Response({
            'count': len(data),
            'unread_count': count_unread_summaries(summaries),
            'results': data,
        })


class CustomerNotificationsAPIView(APIView):
    """In-app alerts for the logged-in customer (booking updates, invoices)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        include_dismissed = str(
            request.query_params.get('include_dismissed', '')
        ).lower() in ('1', 'true', 'yes')
        base = CustomerNotification.objects.filter(customer=request.user)
        unread_count = base.filter(dismissed_at__isnull=True).count()
        qs = base
        if not include_dismissed:
            qs = qs.filter(dismissed_at__isnull=True)
        qs = qs.select_related('organization', 'booking').order_by('-created_at')
        results = qs[:50]
        return Response({
            'count': unread_count,
            'results': CustomerNotificationSerializer(results, many=True).data,
        })


class CustomerNotificationDismissAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        note = CustomerNotification.objects.filter(
            customer=request.user,
            pk=notification_id,
            dismissed_at__isnull=True,
        ).first()
        if not note:
            raise ValidationError({'detail': 'Notification not found.'})
        note.dismissed_at = timezone.now()
        note.save(update_fields=['dismissed_at'])
        return Response({'detail': 'Dismissed.'})


class CustomerNotificationsDismissAllAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = CustomerNotification.objects.filter(
            customer=request.user,
            dismissed_at__isnull=True,
        ).update(dismissed_at=timezone.now())
        return Response({'detail': 'Dismissed.', 'count': updated})


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    http_method_names = ['get', 'post', 'head', 'options', 'patch', 'delete']

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        staff_ids = _staff_organization_ids(self.request.user)
        qs = Task.objects.select_related(
            'organization', 'job', 'job__service', 'job__customer',
        ).filter(
            organization_id__in=staff_ids,
        )
        slug = self.request.query_params.get('organization')
        if slug:
            qs = qs.filter(organization__slug=slug)
        is_done = self.request.query_params.get('is_done')
        if is_done is not None:
            if is_done.lower() in ('1', 'true', 'yes'):
                qs = qs.filter(is_done=True)
            elif is_done.lower() in ('0', 'false', 'no'):
                qs = qs.filter(is_done=False)
        far = timezone.now() + timedelta(days=365 * 20)
        now = timezone.now()
        return qs.annotate(
            _dash_sort=Coalesce('job__start_at', Value(far, output_field=DateTimeField())),
            _overdue=Case(
                When(due_at__lt=now, is_done=False, then=0),
                default=1,
                output_field=IntegerField(),
            ),
        ).order_by('is_done', '_overdue', 'due_at', '-priority', '_dash_sort', 'id')

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        require_staff_ops(self.request.user, org)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        require_staff_ops(self.request.user, serializer.instance.organization)
        serializer.save()

    def perform_destroy(self, instance):
        require_staff_ops(self.request.user, instance.organization)
        instance.delete()
