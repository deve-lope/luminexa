"""Snow dispatch APIs under /organizations/<slug>/dispatch/."""

from __future__ import annotations

import csv
import io
import os
import time
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization, OrganizationMembership, StaffInvitation
from businesses.serializers import OrganizationMembershipReadSerializer

from .dispatch_services import (
    candidates_with_detour,
    commit_run,
    complete_stop,
    geocode_property,
    live_optimize_properties,
    optimize_run,
    org_today,
    save_stop_photo,
    skip_stop,
    start_route,
)
from .models import (
    DispatchRoute,
    DispatchRun,
    DispatchRunStop,
    DispatchStopPhoto,
    ServiceProperty,
    ServiceRegion,
)
from .permissions import (
    is_org_crew,
    is_org_staff,
    membership_for,
    require_provider_subscription,
    require_snow_org,
)
from .snow_defaults import validate_duration_matrix
from .weather import get_daily_snowfall_cm


def _org(user, slug, *, owner=False, staff=False, crew=False):
    org = Organization.objects.filter(slug=slug).first()
    if not org:
        raise ValidationError({'detail': 'Organization not found.'})
    require_snow_org(org)
    require_provider_subscription(org)
    m = membership_for(user, org)
    if owner and (not m or m.role != OrganizationMembership.Role.OWNER):
        raise PermissionDenied('Owner only.')
    if staff and not is_org_staff(user, org):
        raise PermissionDenied('Staff only.')
    if crew and not (is_org_crew(user, org) or is_org_staff(user, org)):
        raise PermissionDenied('Crew only.')
    if not owner and not staff and not crew:
        if not m or m.role not in (
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
            OrganizationMembership.Role.CREW,
        ):
            raise PermissionDenied('Not a member.')
    return org, m


def _property_dict(p: ServiceProperty, today=None):
    return {
        'id': p.id,
        'region_id': p.region_id,
        'region_name': p.region.name if p.region_id else '',
        'customer_id': p.customer_id,
        'customer_name': getattr(p.customer, 'full_name', '') or p.customer.email,
        'service_address_line1': p.service_address_line1,
        'service_address_line2': p.service_address_line2,
        'service_city': p.service_city,
        'service_region': p.service_region,
        'service_postal': p.service_postal,
        'service_country': p.service_country,
        'latitude': p.latitude,
        'longitude': p.longitude,
        'house_type': p.house_type,
        'work_type': p.work_type,
        'service_minutes_override': p.service_minutes_override,
        'service_minutes': p.resolve_service_minutes(),
        'frequency': p.frequency,
        'contract_start': p.contract_start,
        'contract_end': p.contract_end,
        'contract_status': p.contract_status(today),
        'payment_status': p.payment_status,
        'payment_method': p.payment_method,
        'paid_at': p.paid_at,
        'contract_amount': p.contract_amount,
        'notes': p.notes,
        'is_active': p.is_active,
    }


def _stop_crew_dict(s: DispatchRunStop):
    return {
        'id': s.id,
        'sequence': s.sequence,
        'status': s.status,
        'kind': s.kind,
        'work_type': s.work_type,
        'house_type': s.house_type,
        'service_minutes': s.service_minutes,
        'address_line1': s.address_line1,
        'address_line2': s.address_line2,
        'city': s.city,
        'postal': s.postal,
        'latitude': s.latitude,
        'longitude': s.longitude,
        'notes': s.notes,
        'eta_at': s.eta_at,
        'customer_first_name': (s.customer.full_name or '').split(' ')[0] if s.customer_id else '',
        'photo_count': s.photos.count() if hasattr(s, '_prefetched_objects_cache') or True else 0,
    }


class DispatchSettingsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        return Response({
            'snow_threshold_cm': org.snow_threshold_cm,
            'snow_plow_speed_kmh': org.snow_plow_speed_kmh,
            'snow_road_factor': org.snow_road_factor,
            'snow_duration_matrix': org.snow_duration_matrix,
            'snow_late_start_alert_enabled': org.snow_late_start_alert_enabled,
            'snow_late_start_alert_minutes': org.snow_late_start_alert_minutes,
            'snow_extra_crew_seats': org.snow_extra_crew_seats,
            'crew_seats_allowed': OrganizationMembership.crew_seats_allowed(org),
            'crew_seats_used': OrganizationMembership.crew_seats_used(org),
        })

    def patch(self, request, slug):
        org, _ = _org(request.user, slug, owner=True)
        data = request.data
        fields = []
        if 'snow_threshold_cm' in data:
            org.snow_threshold_cm = Decimal(str(data['snow_threshold_cm']))
            fields.append('snow_threshold_cm')
        if 'snow_plow_speed_kmh' in data:
            org.snow_plow_speed_kmh = int(data['snow_plow_speed_kmh'])
            fields.append('snow_plow_speed_kmh')
        if 'snow_road_factor' in data:
            org.snow_road_factor = Decimal(str(data['snow_road_factor']))
            fields.append('snow_road_factor')
        if 'snow_duration_matrix' in data:
            try:
                org.snow_duration_matrix = validate_duration_matrix(data['snow_duration_matrix'])
            except ValueError as exc:
                raise ValidationError({'snow_duration_matrix': str(exc)}) from exc
            fields.append('snow_duration_matrix')
        if 'snow_late_start_alert_enabled' in data:
            org.snow_late_start_alert_enabled = bool(data['snow_late_start_alert_enabled'])
            fields.append('snow_late_start_alert_enabled')
        if 'snow_late_start_alert_minutes' in data:
            org.snow_late_start_alert_minutes = int(data['snow_late_start_alert_minutes'])
            fields.append('snow_late_start_alert_minutes')
        if fields:
            org.save(update_fields=[*fields, 'updated_at'])
        return self.get(request, slug)


class DispatchRegionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        rows = ServiceRegion.objects.filter(organization=org).order_by('name')
        return Response([
            {
                'id': r.id,
                'name': r.name,
                'is_active': r.is_active,
                'depot_latitude': r.depot_latitude,
                'depot_longitude': r.depot_longitude,
            }
            for r in rows
        ])

    def post(self, request, slug):
        org, _ = _org(request.user, slug, owner=True)
        name = (request.data.get('name') or '').strip()
        if not name:
            raise ValidationError({'name': 'Required.'})
        r = ServiceRegion.objects.create(
            organization=org,
            name=name,
            depot_latitude=request.data.get('depot_latitude'),
            depot_longitude=request.data.get('depot_longitude'),
        )
        return Response({'id': r.id, 'name': r.name}, status=201)


class DispatchRegionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, slug, region_id):
        org, _ = _org(request.user, slug, owner=True)
        r = ServiceRegion.objects.filter(organization=org, pk=region_id).first()
        if not r:
            raise Http404()
        for field in ('name', 'is_active', 'depot_latitude', 'depot_longitude'):
            if field in request.data:
                setattr(r, field, request.data[field])
        r.save()
        return Response({'id': r.id, 'name': r.name, 'is_active': r.is_active})

    def delete(self, request, slug, region_id):
        org, _ = _org(request.user, slug, owner=True)
        r = ServiceRegion.objects.filter(organization=org, pk=region_id).first()
        if not r:
            raise Http404()
        if r.properties.exists():
            raise ValidationError({'detail': 'Move or delete properties first.'})
        r.delete()
        return Response(status=204)


class DispatchPropertiesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        today = org_today(org)
        qs = ServiceProperty.objects.filter(organization=org).select_related(
            'region', 'customer'
        )
        region = request.query_params.get('region')
        if region:
            qs = qs.filter(region_id=region)
        frequency = request.query_params.get('frequency')
        if frequency:
            qs = qs.filter(frequency=frequency)
        payment = request.query_params.get('payment_status')
        if payment:
            qs = qs.filter(payment_status=payment)
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(service_address_line1__icontains=q)
        status_f = request.query_params.get('status')
        rows = []
        for p in qs[:500]:
            st = p.contract_status(today)
            if status_f and st != status_f:
                continue
            rows.append(_property_dict(p, today))
        return Response(rows)

    def post(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        data = request.data
        region = ServiceRegion.objects.filter(
            organization=org, pk=data.get('region_id')
        ).first()
        if not region:
            raise ValidationError({'region_id': 'Required.'})
        customer_id = data.get('customer_id')
        if not customer_id:
            raise ValidationError({'customer_id': 'Required.'})
        if not OrganizationMembership.objects.filter(
            organization=org,
            user_id=customer_id,
            role=OrganizationMembership.Role.CUSTOMER,
        ).exists():
            raise ValidationError({'customer_id': 'Customer must be on your Clients list.'})
        prop = ServiceProperty(
            organization=org,
            region=region,
            customer_id=customer_id,
            service_address_line1=(data.get('service_address_line1') or '').strip(),
            service_address_line2=(data.get('service_address_line2') or '').strip(),
            service_city=(data.get('service_city') or '').strip(),
            service_region=(data.get('service_region') or '').strip(),
            service_postal=(data.get('service_postal') or '').strip(),
            service_country=(data.get('service_country') or 'CA').strip(),
            house_type=data.get('house_type') or ServiceProperty.HouseType.DETACHED,
            work_type=data.get('work_type') or ServiceProperty.WorkType.DRIVEWAY,
            frequency=data.get('frequency') or ServiceProperty.Frequency.SEASONAL,
            contract_start=data.get('contract_start') or None,
            contract_end=data.get('contract_end') or None,
            payment_status=data.get('payment_status') or 'unpaid',
            payment_method=data.get('payment_method') or '',
            notes=(data.get('notes') or '')[:300],
        )
        if not prop.service_address_line1:
            raise ValidationError({'service_address_line1': 'Required.'})
        if prop.frequency != ServiceProperty.Frequency.ONE_TIME and not prop.contract_end:
            raise ValidationError({'contract_end': 'Required for seasonal/monthly.'})
        prop.save()
        try:
            geocode_property(prop)
        except Exception:
            pass
        return Response(_property_dict(prop), status=201)


class DispatchPropertyDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, slug, property_id):
        org, _ = _org(request.user, slug, staff=True)
        prop = ServiceProperty.objects.filter(organization=org, pk=property_id).select_related(
            'region', 'customer'
        ).first()
        if not prop:
            raise Http404()
        data = request.data
        for field in (
            'service_address_line1', 'service_address_line2', 'service_city',
            'service_region', 'service_postal', 'service_country',
            'house_type', 'work_type', 'frequency', 'contract_start', 'contract_end',
            'payment_status', 'payment_method', 'paid_at', 'contract_amount',
            'notes', 'is_active', 'service_minutes_override',
        ):
            if field in data:
                setattr(prop, field, data[field])
        if 'region_id' in data:
            region = ServiceRegion.objects.filter(organization=org, pk=data['region_id']).first()
            if region:
                prop.region = region
        prop.save()
        addr_keys = {
            'service_address_line1', 'service_address_line2', 'service_city',
            'service_region', 'service_postal', 'service_country',
        }
        if addr_keys & set(data.keys()):
            try:
                geocode_property(prop)
            except Exception:
                pass
        return Response(_property_dict(prop))

    def delete(self, request, slug, property_id):
        org, _ = _org(request.user, slug, staff=True)
        prop = ServiceProperty.objects.filter(organization=org, pk=property_id).first()
        if not prop:
            raise Http404()
        prop.is_active = False
        prop.save(update_fields=['is_active', 'updated_at'])
        return Response(status=204)


class DispatchCrewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        crews = OrganizationMembership.objects.filter(
            organization=org, role=OrganizationMembership.Role.CREW
        ).select_related('user')
        invites = StaffInvitation.objects.filter(
            organization=org, accepted_at__isnull=True, role=OrganizationMembership.Role.CREW
        )
        return Response({
            'seats_allowed': OrganizationMembership.crew_seats_allowed(org),
            'seats_used': OrganizationMembership.crew_seats_used(org),
            'extra_seats': org.snow_extra_crew_seats,
            'crew': [
                {
                    'membership_id': m.id,
                    'user_id': m.user_id,
                    'email': m.user.email,
                    'name': m.user.full_name,
                }
                for m in crews
            ],
            'pending_invites': [
                {'id': i.id, 'email': i.email, 'created_at': i.created_at}
                for i in invites
            ],
        })

    def post(self, request, slug):
        """Invite crew by email (owner)."""
        org, _ = _org(request.user, slug, owner=True)
        # Reuse invite-staff endpoint logic via internal call pattern
        from .views import OrganizationViewSet

        view = OrganizationViewSet()
        view.request = request
        view.kwargs = {'slug': slug}
        request._full_data = {**(request.data or {}), 'role': 'crew', 'email': request.data.get('email')}
        # Simpler: duplicate minimal invite
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            raise ValidationError({'email': 'Required.'})
        if OrganizationMembership.crew_seats_used(org) >= OrganizationMembership.crew_seats_allowed(org):
            raise ValidationError({
                'detail': 'No free crew seats. Add seats ($15/mo) or remove a crew member.',
                'code': 'crew_limit_reached',
            })
        invite, _ = StaffInvitation.objects.get_or_create(
            organization=org,
            email=email,
            defaults={'invited_by': request.user, 'role': OrganizationMembership.Role.CREW},
        )
        if invite.accepted_at:
            raise ValidationError({'email': 'Already accepted.'})
        invite.role = OrganizationMembership.Role.CREW
        invite.invited_by = request.user
        invite.save()
        from django.core.mail import send_mail

        accept_url = (
            f'{settings.PUBLIC_APP_URL.rstrip("/")}/accept-staff-invite?token={invite.token}'
        )
        try:
            send_mail(
                subject=f'Join {org.name} as crew',
                message=f'You were invited as crew.\n\n{accept_url}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
        except Exception:
            pass
        return Response({'detail': 'Invitation sent.', 'email': email})

    def delete(self, request, slug):
        org, _ = _org(request.user, slug, owner=True)
        membership_id = request.data.get('membership_id') or request.query_params.get('membership_id')
        m = OrganizationMembership.objects.filter(
            organization=org, pk=membership_id, role=OrganizationMembership.Role.CREW
        ).first()
        if not m:
            raise Http404()
        m.delete()
        return Response(status=204)


class DispatchCrewRemoveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, membership_id):
        org, _ = _org(request.user, slug, owner=True)
        m = OrganizationMembership.objects.filter(
            organization=org, pk=membership_id, role=OrganizationMembership.Role.CREW
        ).first()
        if not m:
            raise Http404()
        m.delete()
        return Response(status=204)


class DispatchRunsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        runs = DispatchRun.objects.filter(organization=org).select_related('region')[:50]
        return Response([
            {
                'id': r.id,
                'region_id': r.region_id,
                'region_name': r.region.name,
                'run_date': r.run_date,
                'scheduled_start': r.scheduled_start,
                'status': r.status,
                'forecast_snow_cm': r.forecast_snow_cm,
                'stop_count': r.stops.count(),
                'route_count': r.routes.count(),
            }
            for r in runs
        ])

    def post(self, request, slug):
        org, m = _org(request.user, slug, staff=True)
        region = ServiceRegion.objects.filter(
            organization=org, pk=request.data.get('region_id')
        ).first()
        if not region:
            raise ValidationError({'region_id': 'Required.'})
        start = request.data.get('scheduled_start')
        if not start:
            raise ValidationError({'scheduled_start': 'Required.'})
        if isinstance(start, str):
            start = datetime.fromisoformat(start.replace('Z', '+00:00'))
        run = DispatchRun.objects.create(
            organization=org,
            region=region,
            run_date=start.date(),
            scheduled_start=start,
            forecast_snow_cm=request.data.get('forecast_snow_cm'),
            created_by=request.user,
            status=DispatchRun.Status.DRAFT,
        )
        crew_ids = request.data.get('crew_membership_ids') or []
        for i, mid in enumerate(crew_ids):
            memb = OrganizationMembership.objects.filter(
                organization=org,
                pk=mid,
                role__in=(OrganizationMembership.Role.CREW, OrganizationMembership.Role.OWNER),
            ).first()
            if memb:
                DispatchRoute.objects.create(
                    run=run, crew_membership=memb, vehicle_index=i
                )
        include_seasonal = bool(request.data.get('include_seasonal', True))
        if include_seasonal:
            for prop in live_optimize_properties(org, region):
                DispatchRunStop.objects.create(
                    run=run,
                    property=prop,
                    customer=prop.customer,
                    kind=(
                        DispatchRunStop.Kind.MONTHLY
                        if prop.frequency == ServiceProperty.Frequency.MONTHLY
                        else DispatchRunStop.Kind.SEASONAL
                    ),
                    work_type=prop.work_type,
                    house_type=prop.house_type,
                    service_minutes=prop.resolve_service_minutes(),
                    address_line1=prop.service_address_line1,
                    latitude=prop.latitude,
                    longitude=prop.longitude,
                )
        return Response({'id': run.id, 'status': run.status}, status=201)


class DispatchRunDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, run_id):
        org, _ = _org(request.user, slug, staff=True)
        run = DispatchRun.objects.filter(organization=org, pk=run_id).prefetch_related(
            'routes__crew_membership__user', 'stops'
        ).first()
        if not run:
            raise Http404()
        return Response({
            'id': run.id,
            'status': run.status,
            'region_id': run.region_id,
            'run_date': run.run_date,
            'scheduled_start': run.scheduled_start,
            'forecast_snow_cm': run.forecast_snow_cm,
            'solver_meta': run.solver_meta,
            'routes': [
                {
                    'id': rt.id,
                    'vehicle_index': rt.vehicle_index,
                    'status': rt.status,
                    'crew_name': rt.crew_membership.user.full_name,
                    'crew_membership_id': rt.crew_membership_id,
                    'last_latitude': rt.last_latitude,
                    'last_longitude': rt.last_longitude,
                    'stop_count': rt.stops.count(),
                    'done_count': rt.stops.filter(status=DispatchRunStop.Status.DONE).count(),
                }
                for rt in run.routes.all()
            ],
            'stops': [
                {
                    **_stop_crew_dict(s),
                    'route_id': s.route_id,
                    'property_id': s.property_id,
                    'payment_status': (
                        s.property.payment_status if s.property_id else None
                    ),
                }
                for s in run.stops.all()
            ],
        })

    def patch(self, request, slug, run_id):
        org, _ = _org(request.user, slug, staff=True)
        run = DispatchRun.objects.filter(organization=org, pk=run_id).first()
        if not run or run.status != DispatchRun.Status.DRAFT:
            raise ValidationError({'status': 'Only draft runs can be edited.'})
        if 'scheduled_start' in request.data:
            start = request.data['scheduled_start']
            if isinstance(start, str):
                start = datetime.fromisoformat(start.replace('Z', '+00:00'))
            run.scheduled_start = start
            run.run_date = start.date()
            run.save(update_fields=['scheduled_start', 'run_date', 'updated_at'])
        if 'crew_membership_ids' in request.data:
            run.routes.all().delete()
            for i, mid in enumerate(request.data['crew_membership_ids'] or []):
                memb = OrganizationMembership.objects.filter(organization=org, pk=mid).first()
                if memb:
                    DispatchRoute.objects.create(run=run, crew_membership=memb, vehicle_index=i)
        if 'add_property_ids' in request.data:
            for pid in request.data['add_property_ids'] or []:
                prop = ServiceProperty.objects.filter(organization=org, pk=pid).first()
                if not prop:
                    continue
                DispatchRunStop.objects.get_or_create(
                    run=run,
                    property=prop,
                    defaults={
                        'customer': prop.customer,
                        'kind': DispatchRunStop.Kind.ONE_TIME
                        if prop.frequency == ServiceProperty.Frequency.ONE_TIME
                        else DispatchRunStop.Kind.SEASONAL,
                        'work_type': prop.work_type,
                        'house_type': prop.house_type,
                        'service_minutes': prop.resolve_service_minutes(),
                        'address_line1': prop.service_address_line1,
                        'latitude': prop.latitude,
                        'longitude': prop.longitude,
                    },
                )
        if 'remove_stop_ids' in request.data:
            run.stops.filter(id__in=request.data['remove_stop_ids'] or []).delete()
        return self.get(request, slug, run_id)


class DispatchRunActionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _run(self, request, slug, run_id):
        org, _ = _org(request.user, slug, staff=True)
        run = DispatchRun.objects.filter(organization=org, pk=run_id).first()
        if not run:
            raise Http404()
        return org, run

    def _live_payload(self, run):
        routes = []
        for rt in run.routes.select_related('crew_membership__user'):
            total = rt.stops.count()
            done = rt.stops.filter(
                status__in=(DispatchRunStop.Status.DONE, DispatchRunStop.Status.SKIPPED)
            ).count()
            routes.append({
                'id': rt.id,
                'crew_name': rt.crew_membership.user.full_name,
                'status': rt.status,
                'percent': int(100 * done / total) if total else 0,
                'last_latitude': rt.last_latitude,
                'last_longitude': rt.last_longitude,
                'last_ping_at': rt.last_ping_at,
            })
        overall_total = run.stops.count()
        overall_done = run.stops.filter(
            status__in=(DispatchRunStop.Status.DONE, DispatchRunStop.Status.SKIPPED)
        ).count()
        return {
            'status': run.status,
            'overall_percent': int(100 * overall_done / overall_total) if overall_total else 0,
            'routes': routes,
        }

    def get(self, request, slug, run_id, action):
        _, run = self._run(request, slug, run_id)
        if action == 'candidates':
            return Response({'candidates': candidates_with_detour(run)})
        if action == 'live':
            return Response(self._live_payload(run))
        raise ValidationError({'action': 'Unknown.'})

    def post(self, request, slug, run_id, action):
        _, run = self._run(request, slug, run_id)
        if action == 'candidates':
            return Response({'candidates': candidates_with_detour(run)})
        if action == 'optimize':
            result = optimize_run(run, persist=True)
            return Response(result)
        if action == 'commit':
            commit_run(run)
            return Response({'id': run.id, 'status': run.status})
        if action == 'cancel':
            run.status = DispatchRun.Status.CANCELLED
            run.save(update_fields=['status', 'updated_at'])
            return Response({'id': run.id, 'status': run.status})
        if action == 'live':
            return Response(self._live_payload(run))
        raise ValidationError({'action': 'Unknown.'})


class DispatchMyRoutesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, m = _org(request.user, slug, crew=True)
        if m.role == OrganizationMembership.Role.CREW:
            routes = DispatchRoute.objects.filter(
                crew_membership=m,
                run__organization=org,
                run__status__in=(
                    DispatchRun.Status.SCHEDULED,
                    DispatchRun.Status.IN_PROGRESS,
                ),
            ).select_related('run').prefetch_related('stops')
        else:
            routes = DispatchRoute.objects.filter(
                run__organization=org,
                run__status__in=(
                    DispatchRun.Status.SCHEDULED,
                    DispatchRun.Status.IN_PROGRESS,
                ),
            ).select_related('run')[:20]
        return Response([
            {
                'id': rt.id,
                'run_id': rt.run_id,
                'run_date': rt.run.run_date,
                'scheduled_start': rt.run.scheduled_start,
                'status': rt.status,
                'percent': int(
                    100
                    * rt.stops.filter(status=DispatchRunStop.Status.DONE).count()
                    / max(1, rt.stops.count())
                ),
                'stops': [_stop_crew_dict(s) for s in rt.stops.order_by('sequence')],
            }
            for rt in routes
        ])


class DispatchRouteStartAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, route_id):
        org, _ = _org(request.user, slug, crew=True)
        route = DispatchRoute.objects.filter(run__organization=org, pk=route_id).first()
        if not route:
            raise Http404()
        start_route(route, crew_user=request.user)
        return Response({'id': route.id, 'status': route.status})


class DispatchRouteLocationAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, route_id):
        org, _ = _org(request.user, slug, crew=True)
        route = DispatchRoute.objects.filter(run__organization=org, pk=route_id).first()
        if not route or route.crew_membership.user_id != request.user.id:
            raise Http404()
        if route.last_ping_at and (timezone.now() - route.last_ping_at).total_seconds() < 60:
            return Response({'detail': 'Throttled'}, status=429)
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat is None or lng is None:
            raise ValidationError({'latitude': 'Required.', 'longitude': 'Required.'})
        route.last_latitude = Decimal(str(lat))
        route.last_longitude = Decimal(str(lng))
        route.last_ping_at = timezone.now()
        route.save(update_fields=['last_latitude', 'last_longitude', 'last_ping_at'])
        return Response({'ok': True})


class DispatchStopDoneAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, stop_id):
        org, _ = _org(request.user, slug, crew=True)
        stop = DispatchRunStop.objects.filter(run__organization=org, pk=stop_id).first()
        if not stop:
            raise Http404()
        complete_stop(stop, crew_user=request.user)
        return Response({'id': stop.id, 'status': stop.status})


class DispatchStopSkipAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, stop_id):
        org, _ = _org(request.user, slug, crew=True)
        stop = DispatchRunStop.objects.filter(run__organization=org, pk=stop_id).first()
        if not stop:
            raise Http404()
        skip_stop(stop, crew_user=request.user, reason=request.data.get('reason') or '')
        return Response({'id': stop.id, 'status': stop.status})


class DispatchStopPhotosAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, stop_id):
        org, _ = _org(request.user, slug, crew=True)
        stop = DispatchRunStop.objects.filter(run__organization=org, pk=stop_id).first()
        if not stop or not stop.route or stop.route.crew_membership.user_id != request.user.id:
            raise Http404()
        f = request.FILES.get('photo') or request.FILES.get('file')
        if not f:
            raise ValidationError({'photo': 'Required.'})
        photo = save_stop_photo(stop, uploaded_by=request.user, file_obj=f)
        return Response({'id': photo.id}, status=201)


class DispatchPhotosAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        qs = DispatchStopPhoto.objects.filter(organization=org).select_related('stop')
        date = request.query_params.get('date')
        if date:
            qs = qs.filter(created_at__date=date)
        return Response([
            {
                'id': p.id,
                'stop_id': p.stop_id,
                'address': p.stop.address_line1,
                'created_at': p.created_at,
                'size_bytes': p.size_bytes,
            }
            for p in qs[:200]
        ])

    def post(self, request, slug):
        """Bulk delete (also mounted at …/photos/delete/)."""
        return self._bulk_delete(request, slug)

    def delete(self, request, slug):
        return self._bulk_delete(request, slug)

    def _bulk_delete(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        ids = request.data.get('ids') or []
        date = request.data.get('date')
        qs = DispatchStopPhoto.objects.filter(organization=org)
        if ids:
            qs = qs.filter(id__in=ids)
        elif date:
            qs = qs.filter(created_at__date=date)
        else:
            raise ValidationError({'detail': 'Provide ids or date.'})
        root = getattr(settings, 'PRIVATE_MEDIA_ROOT', None) or os.path.join(
            settings.BASE_DIR, 'private_media'
        )
        for p in qs:
            path = os.path.join(str(root), p.relative_path)
            if os.path.isfile(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
            p.delete()
        return Response({'deleted': True})


class DispatchWeatherWeekAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org, _ = _org(request.user, slug, staff=True)
        region = org.service_regions.filter(is_active=True).order_by('id').first()
        lat = region.depot_latitude if region and region.depot_latitude is not None else org.service_latitude
        lng = region.depot_longitude if region and region.depot_longitude is not None else org.service_longitude
        if lat is None or lng is None:
            return Response({'days': [], 'threshold_cm': org.snow_threshold_cm})
        days = get_daily_snowfall_cm(
            float(lat), float(lng), days=7, tz=org.timezone or 'America/Toronto'
        )
        thr = float(org.snow_threshold_cm or 2)
        return Response({
            'threshold_cm': thr,
            'days': [
                {**d, 'over_threshold': float(d['snowfall_cm']) >= thr}
                for d in days
            ],
        })


class PublicSnowStopAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        stop = DispatchRunStop.objects.filter(
            customer_view_token=token
        ).select_related('route', 'run__organization').first()
        if not stop:
            raise Http404()
        crew_location = None
        route = stop.route
        if (
            route
            and route.status == DispatchRoute.Status.IN_PROGRESS
            and stop.status == DispatchRunStop.Status.PENDING
            and route.last_latitude is not None
            and stop.latitude is not None
        ):
            from .dispatch_optimizer import haversine_km

            km = haversine_km(
                float(route.last_latitude),
                float(route.last_longitude),
                float(stop.latitude),
                float(stop.longitude),
            )
            if km <= 5.0:
                crew_location = {
                    'latitude': route.last_latitude,
                    'longitude': route.last_longitude,
                    'km': round(km, 2),
                    'ping_at': route.last_ping_at,
                }
        return Response({
            'status': stop.status,
            'eta_at': stop.eta_at,
            'organization_name': stop.run.organization.name,
            'address_line1': stop.address_line1,
            'run_date': stop.run.run_date,
            'crew_location': crew_location,
        })
