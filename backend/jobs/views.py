from datetime import timedelta

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

from .booking_services import (
    accept_booking_request,
    booking_policy_meta,
    cancel_booking,
    complete_booking,
    mark_booking_no_show,
    reschedule_booking,
    customer_can_view_calendar,
    customer_request_slot,
    decline_booking_request,
    ensure_customer_membership,
    provider_book_customer,
)
from .message_services import (
    can_access_booking_messages,
    list_booking_messages,
    post_booking_message,
)
from .models import (
    AvailabilitySlot,
    Booking,
    BookingStatusEvent,
    CustomerServiceInquiry,
    Service,
    ServiceCategory,
    ServiceGalleryImage,
    Task,
    UnavailableBlock,
)
from .permissions import is_org_member, is_org_staff, membership_for
from .scheduling_services import (
    coerce_org_date,
    ensure_flexi_slot_alert,
    get_active_notifications,
    sync_recurring_slots,
)
from .serializers import (
    AvailabilitySlotSerializer,
    UnavailableBlockSerializer,
    BookingSerializer,
    BookingDetailSerializer,
    OrgCustomerSerializer,
    OrganizationSerializer,
    ProviderBookSerializer,
    ProviderNotificationSerializer,
    CustomerServiceInquiryCreateSerializer,
    CustomerServiceInquirySerializer,
    ServiceRequestMessageSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
    TaskSerializer,
    WeeklyScheduleBlockSerializer,
)
from .models import ProviderNotification, WeeklyScheduleBlock


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
            'logo', 'banner', 'scheduling_mode',
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

    @action(detail=True, methods=['get'], url_path='booking-context')
    def booking_context(self, request, slug=None):
        org = self.get_object()
        return Response(booking_policy_meta(org, request.user))

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
                'weekly_blocks': WeeklyScheduleBlockSerializer(blocks, many=True).data,
            })

        if not membership_for(request.user, org) or membership_for(request.user, org).role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can update scheduling settings.')

        data = request.data
        if 'scheduling_mode' in data:
            org.scheduling_mode = data['scheduling_mode']
        if 'schedule_valid_from' in data:
            raw = data['schedule_valid_from']
            org.schedule_valid_from = coerce_org_date(raw) if raw else None
        if 'schedule_valid_until' in data:
            raw = data['schedule_valid_until']
            org.schedule_valid_until = coerce_org_date(raw) if raw else None
        org.save(update_fields=[
            'scheduling_mode', 'schedule_valid_from', 'schedule_valid_until', 'updated_at',
        ])

        if 'weekly_blocks' in data:
            WeeklyScheduleBlock.objects.filter(organization=org).delete()
            for row in data['weekly_blocks']:
                ser = WeeklyScheduleBlockSerializer(data=row)
                ser.is_valid(raise_exception=True)
                WeeklyScheduleBlock.objects.create(organization=org, **ser.validated_data)

        created = 0
        if org.scheduling_mode == Organization.SchedulingMode.RECURRING:
            created = sync_recurring_slots(org)
        ensure_flexi_slot_alert(org)

        blocks = WeeklyScheduleBlock.objects.filter(organization=org)
        return Response({
            'scheduling_mode': org.scheduling_mode,
            'schedule_valid_from': org.schedule_valid_from,
            'schedule_valid_until': org.schedule_valid_until,
            'weekly_blocks': WeeklyScheduleBlockSerializer(blocks, many=True).data,
            'slots_created': created,
        })

    @action(detail=True, methods=['get', 'put'], url_path='weekly-schedule')
    def weekly_schedule(self, request, slug=None):
        """Legacy alias — prefer scheduling-settings."""
        return self.scheduling_settings(request, slug=slug)

    @action(detail=True, methods=['post'], url_path='sync-recurring-slots')
    def sync_recurring_slots_action(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        count = sync_recurring_slots(org)
        return Response({'created': count})

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

        if org.gallery_images.count() >= OrganizationGalleryImage.MAX_PER_ORGANIZATION:
            raise ValidationError(
                f'Maximum {OrganizationGalleryImage.MAX_PER_ORGANIZATION} gallery images allowed.'
            )
        image_file = request.FILES.get('image')
        if not image_file:
            raise ValidationError({'image': 'Image file is required.'})
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
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
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
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can list customers.')
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
        memberships = memberships.order_by('user__full_name')
        data = [
            {
                'id': m.user_id,
                'email': m.user.email,
                'full_name': m.user.full_name,
                'phone': m.user.phone or '',
                'membership_id': m.id,
                'customer_status': m.customer_status,
            }
            for m in memberships
        ]
        return Response(OrgCustomerSerializer(data, many=True).data)

    @action(detail=True, methods=['post'], url_path='approve-customer')
    def approve_customer(self, request, slug=None):
        org = self.get_object()
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can approve customers.')
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

    @action(detail=True, methods=['post'], url_path='invite-staff')
    def invite_staff(self, request, slug=None):
        from businesses.models import StaffInvitation
        from django.core.mail import send_mail
        from django.conf import settings

        org = self.get_object()
        m = membership_for(request.user, org)
        if not m or m.role != OrganizationMembership.Role.OWNER:
            raise PermissionDenied('Only the owner can invite staff.')
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
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
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

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = ServiceCategory.objects.select_related('organization').filter(
            organization__memberships__user=self.request.user,
        )
        slug = self.request.query_params.get('organization')
        if slug:
            qs = qs.filter(organization__slug=slug)
        return qs.distinct().order_by('sort_order', 'name')

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        if not is_org_staff(self.request.user, org):
            raise PermissionDenied('Only owners and staff can create categories.')
        serializer.save()

    def perform_update(self, serializer):
        if not is_org_staff(self.request.user, serializer.instance.organization):
            raise PermissionDenied('Only owners and staff can update categories.')
        serializer.save()

    def perform_destroy(self, instance):
        if not is_org_staff(self.request.user, instance.organization):
            raise PermissionDenied('Only owners and staff can delete categories.')
        instance.delete()


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
        if not is_org_staff(self.request.user, org):
            raise PermissionDenied('Only owners and staff can create services.')
        serializer.save()

    def perform_update(self, serializer):
        if not is_org_staff(self.request.user, serializer.instance.organization):
            raise PermissionDenied('Only owners and staff can update services.')
        serializer.save()

    def perform_destroy(self, instance):
        if not is_org_staff(self.request.user, instance.organization):
            raise PermissionDenied('Only owners and staff can delete services.')
        instance.delete()

    @action(detail=True, methods=['get', 'post'], url_path='gallery')
    def gallery(self, request, pk=None):
        service = self.get_object()
        if not is_org_staff(request.user, service.organization):
            raise PermissionDenied('Only owners and staff can manage service images.')

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
        if not image_file:
            raise ValidationError({'image': 'Image file is required.'})
        if image_file.size > ServiceGalleryImage.MAX_BYTES:
            raise ValidationError({'image': 'Each image must be 3 MB or smaller.'})
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
        if not is_org_staff(request.user, service.organization):
            raise PermissionDenied('Only owners and staff can manage service images.')
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

    def get_queryset(self):
        user = self.request.user
        staff_ids = list(_staff_organization_ids(user))
        slug = self.request.query_params.get('organization')

        qs = AvailabilitySlot.objects.select_related(
            'organization', 'service', 'booking', 'booking__customer',
        )

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
            qs = qs.filter(
                status=AvailabilitySlot.Status.OPEN,
                start_at__gt=timezone.now(),
            )
        return qs.distinct().order_by('start_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        slug = request.query_params.get('organization')
        if slug:
            org = Organization.objects.filter(slug=slug).first()
            if org:
                response.data = {
                    'slots': response.data,
                    'booking': booking_policy_meta(org, request.user),
                }
        return response

    def perform_create(self, serializer):
        org = serializer.validated_data['organization']
        if not is_org_staff(self.request.user, org):
            raise PermissionDenied('Only owners and staff can create open slots.')
        serializer.save(created_by=self.request.user)
        ensure_flexi_slot_alert(org)

    def perform_destroy(self, instance):
        if not is_org_staff(self.request.user, instance.organization):
            raise PermissionDenied('Only owners and staff can delete slots.')
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
        if not is_org_staff(self.request.user, org):
            raise PermissionDenied('Only owners and staff can block time.')
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if not is_org_staff(self.request.user, instance.organization):
            raise PermissionDenied('Only owners and staff can remove blocks.')
        instance.delete()


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    http_method_names = ['get', 'post', 'head', 'options', 'patch']

    def get_throttles(self):
        from luminexa.throttles import BookingCreateThrottle

        if self.action == 'create':
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
            'organization', 'service', 'customer', 'availability_slot'
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
            qs = qs.prefetch_related('status_events__actor')
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
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Only staff can book on behalf of customers.')
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
        if not is_org_staff(user, booking.organization):
            raise PermissionDenied('Only staff can update this booking.')
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
        if not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('Only staff can accept requests.')
        old = booking.status
        accept_booking_request(booking, request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.ACCEPTED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import send_booking_email
        send_booking_email('booking_confirmed', booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        booking = self.get_object()
        if not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('Only staff can decline requests.')
        old = booking.status
        decline_booking_request(booking)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.DECLINED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import send_booking_email
        send_booking_email('booking_declined', booking)
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
        from .notifications import send_booking_email
        send_booking_email('booking_cancelled', booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        booking = self.get_object()
        if not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('Only staff can complete bookings.')
        old = booking.status
        complete_booking(booking, staff_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.COMPLETED,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import send_booking_email
        send_booking_email('booking_completed', booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

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
        reschedule_booking(booking, new_slot=slot, by_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.RESCHEDULED,
            old_status=old_status,
            new_status=booking.status,
            note=f'New time: {booking.start_at.isoformat()}',
        )
        from .notifications import send_booking_email
        send_booking_email('booking_requested', booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='no-show')
    def no_show(self, request, pk=None):
        booking = self.get_object()
        if not is_org_staff(request.user, booking.organization):
            raise PermissionDenied('Only staff can mark no-show.')
        old = booking.status
        mark_booking_no_show(booking, staff_user=request.user)
        log_booking_status_change(
            booking,
            actor=request.user,
            action=BookingStatusEvent.Action.NO_SHOW,
            old_status=old,
            new_status=booking.status,
        )
        from .notifications import send_booking_email
        send_booking_email('booking_cancelled', booking)
        return Response(BookingSerializer(booking, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        booking = self.get_object()
        if not can_access_booking_messages(request.user, booking):
            raise PermissionDenied('You cannot view messages on this booking.')
        if request.method == 'GET':
            messages = list_booking_messages(booking)
            return Response(
                ServiceRequestMessageSerializer(
                    messages, many=True, context={'request': request},
                ).data,
            )
        message = post_booking_message(
            booking=booking,
            sender=request.user,
            body=request.data.get('body', ''),
        )
        return Response(
            ServiceRequestMessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


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
        if not is_org_staff(self.request.user, org):
            raise PermissionDenied('Only owners and staff can create tasks.')
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not is_org_staff(self.request.user, serializer.instance.organization):
            raise PermissionDenied('Only owners and staff can update tasks.')
        serializer.save()

    def perform_destroy(self, instance):
        if not is_org_staff(self.request.user, instance.organization):
            raise PermissionDenied('Only owners and staff can delete tasks.')
        instance.delete()
