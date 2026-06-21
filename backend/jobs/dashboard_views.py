from datetime import timedelta

from django.db.models import Case, DateTimeField, IntegerField, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization

from .models import Booking, CustomerServiceInquiry, Task
from .permissions import is_org_staff
from .scheduling_services import get_active_notifications
from .task_services import refresh_recurring_tasks
from .serializers import (
    BookingDashboardSerializer,
    ProviderNotificationSerializer,
    CustomerServiceInquirySerializer,
    TaskSerializer,
)

# Home (Today) shows a short actionable slice; full lists live on Schedule / Tasks pages.
HOME_JOB_LIMIT = 5
HOME_TASK_OPEN_LIMIT = 5
HOME_TASK_DONE_LIMIT = 2
HOME_TASK_DONE_DAYS = 2
HOME_JOB_WINDOW_DAYS = 14


class ProviderDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        slug = request.query_params.get('organization')
        if not slug:
            raise ValidationError({'organization': "Query parameter 'organization' (slug) is required."})
        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        if not is_org_staff(request.user, org):
            raise PermissionDenied('You must be staff of this organization to view the dashboard.')

        now = timezone.now()
        window_end = now + timedelta(days=HOME_JOB_WINDOW_DAYS)

        upcoming_qs = (
            Booking.objects.filter(
                organization=org,
                start_at__gte=now,
                start_at__lte=window_end,
                status__in=(Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS),
            )
            .select_related('service', 'customer')
            .order_by('start_at')
        )
        upcoming_total = upcoming_qs.count()
        upcoming = upcoming_qs[:HOME_JOB_LIMIT]

        pending_requests = (
            Booking.objects.filter(
                organization=org,
                status=Booking.Status.REQUESTED,
            )
            .select_related('service', 'customer')
            .order_by('start_at')[:50]
        )

        refresh_recurring_tasks(org, now=now)

        far = now + timedelta(days=365 * 20)
        done_cutoff = now - timedelta(days=HOME_TASK_DONE_DAYS)
        task_base = Task.objects.filter(organization=org).select_related(
            'job', 'job__service', 'job__customer',
        )
        open_tasks_qs = (
            task_base.filter(is_done=False)
            .annotate(_sort=Coalesce('job__start_at', Value(far, output_field=DateTimeField())))
            .annotate(
                _overdue=Case(
                    When(due_at__lt=now, then=0),
                    default=1,
                    output_field=IntegerField(),
                ),
            )
            .order_by('_overdue', 'due_at', '-priority', '_sort', 'id')
        )
        open_tasks_total = open_tasks_qs.count()
        open_tasks_shown = list(open_tasks_qs[:HOME_TASK_OPEN_LIMIT])

        done_tasks_qs = task_base.filter(is_done=True, done_at__gte=done_cutoff).order_by(
            '-done_at', 'id',
        )
        done_tasks_total = done_tasks_qs.count()
        done_tasks_shown = list(done_tasks_qs[:HOME_TASK_DONE_LIMIT])

        dashboard_tasks = open_tasks_shown + done_tasks_shown

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        jobs_today = upcoming_qs.filter(
            start_at__gte=today_start, start_at__lt=today_end,
        ).count()

        notifications = get_active_notifications(org)
        customer_inquiries = (
            CustomerServiceInquiry.objects.filter(
                organization=org,
                status=CustomerServiceInquiry.Status.PENDING,
            )
            .select_related('customer')
            .order_by('-created_at')[:30]
        )
        ctx = {'request': request}
        return Response({
            'organization': {
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'scheduling_mode': org.scheduling_mode,
            },
            'stats': {
                'jobs_today': jobs_today,
                'upcoming_count': upcoming_total,
                'upcoming_shown': len(upcoming),
                'upcoming_window_days': HOME_JOB_WINDOW_DAYS,
                'tasks_open_total': open_tasks_total,
                'tasks_open_shown': len(open_tasks_shown),
                'tasks_done_total': done_tasks_total,
                'tasks_done_shown': len(done_tasks_shown),
                'pending_requests_count': pending_requests.count(),
                'customer_inquiries_count': customer_inquiries.count(),
            },
            'upcoming_jobs': BookingDashboardSerializer(upcoming, many=True).data,
            'pending_requests': BookingDashboardSerializer(pending_requests, many=True).data,
            'tasks': TaskSerializer(dashboard_tasks, many=True, context=ctx).data,
            'notifications': ProviderNotificationSerializer(notifications, many=True).data,
            'customer_inquiries': CustomerServiceInquirySerializer(
                customer_inquiries, many=True,
            ).data,
        })
