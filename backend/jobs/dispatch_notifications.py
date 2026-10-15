"""Snow dispatch notifications (commit, nudges, done, storm)."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from businesses.models import OrganizationMembership

from .models import (
    CustomerNotification,
    DispatchRoute,
    DispatchRun,
    DispatchRunStop,
    ProviderNotification,
    StormAlert,
)
from .notifications import create_customer_notification
from .weather import get_daily_snowfall_cm


def _create_provider_notif(org, *, kind, message, link_path='', user=None):
    n = ProviderNotification.objects.create(
        organization=org,
        kind=kind,
        message=message[:500],
        link_path=link_path[:300],
    )
    try:
        from .push_services import send_push_to_org_staff, send_push_to_user

        if user:
            send_push_to_user(user, title='Luminexa', body=message, link_path=link_path)
        else:
            send_push_to_org_staff(org, title='Luminexa', body=message, link_path=link_path)
    except Exception:
        pass
    return n


def notify_run_committed(run: DispatchRun) -> None:
    org = run.organization
    cm = run.forecast_snow_cm
    snow_bit = f' (~{cm} cm forecast)' if cm is not None else ''
    link = f'/provider/{org.slug}/runs/{run.id}'
    for route in run.routes.select_related('crew_membership__user'):
        if route.crew_scheduled_sent_at:
            continue
        user = route.crew_membership.user
        msg = (
            f'Snow run scheduled for {run.run_date}{snow_bit} — '
            f'{route.stops.count()} stops. Open My run to start.'
        )
        _create_provider_notif(
            org,
            kind=ProviderNotification.Kind.SNOW_RUN_SCHEDULED,
            message=msg,
            link_path=f'/provider/{org.slug}/my-run',
            user=user,
        )
        try:
            send_mail(
                subject=f'Snow run scheduled — {org.name}',
                message=msg + f'\n\n{settings.PUBLIC_APP_URL.rstrip("/")}/provider/{org.slug}/my-run',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            pass
        route.crew_scheduled_sent_at = timezone.now()
        route.save(update_fields=['crew_scheduled_sent_at'])

    for stop in run.stops.select_related('customer'):
        if stop.customer_scheduled_sent_at:
            continue
        token_url = f'{settings.PUBLIC_APP_URL.rstrip("/")}/snow/{stop.customer_view_token}'
        title = 'Snow clearing scheduled'
        message = (
            f'{org.name} scheduled snow clearing'
            f'{snow_bit}. Track status: {token_url}'
        )
        create_customer_notification(
            customer=stop.customer,
            kind=CustomerNotification.Kind.SNOW_RUN_SCHEDULED,
            title=title,
            message=message[:500],
            organization=org,
            link_path=f'/snow/{stop.customer_view_token}',
        )
        try:
            send_mail(
                subject=f'{org.name}: snow clearing scheduled',
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[stop.customer.email],
                fail_silently=True,
            )
        except Exception:
            pass
        stop.customer_scheduled_sent_at = timezone.now()
        stop.save(update_fields=['customer_scheduled_sent_at'])


def notify_stop_done_seasonal(stop: DispatchRunStop) -> None:
    if stop.customer_done_sent_at:
        return
    org = stop.run.organization
    title = 'Snow clearing done'
    message = f'{org.name} finished clearing at {stop.address_line1 or "your property"}.'
    create_customer_notification(
        customer=stop.customer,
        kind=CustomerNotification.Kind.SNOW_STOP_DONE,
        title=title,
        message=message,
        organization=org,
        link_path=f'/snow/{stop.customer_view_token}',
    )
    try:
        send_mail(
            subject=f'{org.name}: snow clearing complete',
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[stop.customer.email],
            fail_silently=True,
        )
    except Exception:
        pass
    stop.customer_done_sent_at = timezone.now()
    stop.save(update_fields=['customer_done_sent_at'])


def send_dispatch_nudges() -> dict:
    """Celery beat: crew 1h, late-start, customer ~30m ETA."""
    now = timezone.now()
    stats = {'crew_1h': 0, 'late': 0, 'customer_soon': 0}
    # Crew 1h before
    window_start = now + timedelta(minutes=55)
    window_end = now + timedelta(minutes=65)
    routes = DispatchRoute.objects.filter(
        run__status__in=(DispatchRun.Status.SCHEDULED, DispatchRun.Status.IN_PROGRESS),
        crew_1h_sent_at__isnull=True,
        status=DispatchRoute.Status.NOT_STARTED,
        run__scheduled_start__gte=window_start,
        run__scheduled_start__lte=window_end,
    ).select_related('run__organization', 'crew_membership__user')
    for route in routes:
        org = route.run.organization
        user = route.crew_membership.user
        msg = f'Snow run starts in about 1 hour ({route.run.scheduled_start}).'
        _create_provider_notif(
            org,
            kind=ProviderNotification.Kind.SNOW_RUN_1H,
            message=msg,
            link_path=f'/provider/{org.slug}/my-run',
            user=user,
        )
        route.crew_1h_sent_at = now
        route.save(update_fields=['crew_1h_sent_at'])
        stats['crew_1h'] += 1

    # Late start alerts
    late_routes = DispatchRoute.objects.filter(
        run__status__in=(DispatchRun.Status.SCHEDULED, DispatchRun.Status.IN_PROGRESS),
        status=DispatchRoute.Status.NOT_STARTED,
        late_start_alert_sent_at__isnull=True,
        run__organization__snow_late_start_alert_enabled=True,
    ).select_related('run__organization', 'crew_membership__user')
    for route in late_routes:
        org = route.run.organization
        mins = int(org.snow_late_start_alert_minutes or 30)
        if route.run.scheduled_start + timedelta(minutes=mins) > now:
            continue
        crew_name = route.crew_membership.user.full_name or route.crew_membership.user.email
        msg = f'{crew_name} has not started the snow run (scheduled {route.run.scheduled_start}).'
        _create_provider_notif(
            org,
            kind=ProviderNotification.Kind.SNOW_CREW_LATE,
            message=msg,
            link_path=f'/provider/{org.slug}/runs/{route.run_id}',
        )
        route.late_start_alert_sent_at = now
        route.save(update_fields=['late_start_alert_sent_at'])
        stats['late'] += 1

    # Customer ~30 min before ETA
    soon_start = now + timedelta(minutes=25)
    soon_end = now + timedelta(minutes=35)
    stops = DispatchRunStop.objects.filter(
        status=DispatchRunStop.Status.PENDING,
        customer_soon_sent_at__isnull=True,
        eta_at__gte=soon_start,
        eta_at__lte=soon_end,
        route__status=DispatchRoute.Status.IN_PROGRESS,
        run__status=DispatchRun.Status.IN_PROGRESS,
    ).select_related('customer', 'run__organization')
    for stop in stops:
        org = stop.run.organization
        create_customer_notification(
            customer=stop.customer,
            kind=CustomerNotification.Kind.SNOW_ETA_SOON,
            title='Crew arriving soon',
            message=f'{org.name} is about 30 minutes away.',
            organization=org,
            link_path=f'/snow/{stop.customer_view_token}',
        )
        stop.customer_soon_sent_at = now
        stop.save(update_fields=['customer_soon_sent_at'])
        stats['customer_soon'] += 1
    return stats


def evaluate_storm_alerts() -> int:
    """3×/day: alert masters when forecast ≥ threshold. Never starts runs."""
    from businesses.models import Organization

    count = 0
    orgs = Organization.objects.filter(
        provider_mode=Organization.ProviderMode.PROPERTY_ROUTES,
        route_vertical=Organization.RouteVertical.SNOW,
        is_active=True,
    )
    for org in orgs:
        region = org.service_regions.filter(is_active=True).order_by('id').first()
        lat = region.depot_latitude if region and region.depot_latitude is not None else org.service_latitude
        lng = region.depot_longitude if region and region.depot_longitude is not None else org.service_longitude
        if lat is None or lng is None:
            continue
        days = get_daily_snowfall_cm(
            float(lat), float(lng), days=7, tz=org.timezone or 'America/Toronto'
        )
        threshold = float(org.snow_threshold_cm or 2)
        for day in days:
            cm = float(day.get('snowfall_cm') or 0)
            if cm < threshold:
                continue
            alert_date = day['date']
            if isinstance(alert_date, str):
                from datetime import date as date_cls

                alert_date = date_cls.fromisoformat(alert_date)
            _, created = StormAlert.objects.get_or_create(
                organization=org,
                alert_date=alert_date,
                defaults={'forecast_snow_cm': cm},
            )
            if not created:
                continue
            _create_provider_notif(
                org,
                kind=ProviderNotification.Kind.SNOW_STORM_ALERT,
                message=(
                    f'Snow forecast {cm} cm on {alert_date} '
                    f'(threshold {threshold} cm). Plan a run when ready.'
                ),
                link_path=f'/provider/{org.slug}/runs',
            )
            owners = OrganizationMembership.objects.filter(
                organization=org,
                role=OrganizationMembership.Role.OWNER,
            ).select_related('user')
            for m in owners:
                try:
                    send_mail(
                        subject=f'Snow alert — {org.name}',
                        message=(
                            f'Forecast {cm} cm on {alert_date}. '
                            f'Threshold is {threshold} cm. Open Luminexa to schedule a run.'
                        ),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[m.user.email],
                        fail_silently=True,
                    )
                except Exception:
                    pass
            count += 1
    return count
