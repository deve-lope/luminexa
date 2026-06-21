from datetime import datetime, time

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from jobs.booking_services import customer_can_book
from jobs.models import AvailabilitySlot, Booking, Service
from jobs.serializers import BookingSerializer, PublicServiceReadSerializer

from .models import BusinessType, Organization, OrganizationMembership
from .geocode import lookup_postal_location, resolve_coordinates, reverse_geocode, search_locations
from .location import organization_distances_within_radius, parse_radius_miles
from .postal import normalize_postal_code, picker_postal_codes
from .region_codes import (
    city_matches,
    merge_unique_sorted,
    reference_cities,
    reference_postal_codes,
    state_matches,
)
from .serializers import (
    BusinessTypeCreateSerializer,
    BusinessTypeSerializer,
    OrganizationMembershipReadSerializer,
    PublicProviderCardSerializer,
)
from .utils import organization_location_full, organization_location_short


def _unique_business_type_slug(name: str) -> str:
    base = slugify(name)[:70] or 'business-type'
    slug = base
    n = 1
    while BusinessType.objects.filter(slug=slug).exists():
        slug = f'{base}-{n}'
        n += 1
    return slug


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def business_types_list_api(request):
    if request.method == 'POST':
        ser = BusinessTypeCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        bt = BusinessType.objects.create(
            slug=_unique_business_type_slug(data['name']),
            name=data['name'],
            description=data.get('description') or '',
            icon=(data.get('icon') or '').strip(),
            sort_order=BusinessType.objects.count(),
            is_active=True,
        )
        return Response(BusinessTypeSerializer(bt).data, status=status.HTTP_201_CREATED)

    for_registration = request.query_params.get('for_registration', '').lower() == 'true'
    for_browse = request.query_params.get('browse', '').lower() == 'true'
    qs = BusinessType.objects.filter(is_active=True).order_by('sort_order', 'name')
    if for_registration:
        data = BusinessTypeSerializer(qs, many=True).data
        return Response(data)

    qs = qs.annotate(
        provider_count=Count(
            'organizations',
            filter=Q(organizations__is_active=True, organizations__profile_public=True),
            distinct=True,
        )
    )
    if for_browse:
        return Response(BusinessTypeSerializer(qs, many=True).data)

    qs = qs.filter(provider_count__gt=0)
    return Response(BusinessTypeSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def location_options_api(request):
    """Cities and postal codes for the location picker, filtered by province/state."""
    state = (request.query_params.get('state') or '').strip()
    city = (request.query_params.get('city') or '').strip()
    return Response(_location_picker_payload(state=state, city=city))


@api_view(['GET'])
@permission_classes([AllowAny])
def postal_lookup_api(request):
    postal = (
        request.query_params.get('postal')
        or request.query_params.get('zip')
        or request.query_params.get('pin')
        or ''
    )
    postal = normalize_postal_code(postal)
    if len(postal) < 3:
        return Response({'detail': 'Enter at least 3 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    country = (request.query_params.get('country') or '').strip()
    location = lookup_postal_location(postal, country=country)
    if not location:
        return Response({'detail': 'Could not find that postal code.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'postal_code': location['postal_code'],
        'city': location.get('city') or '',
        'state': location.get('state') or '',
        'province': location.get('state') or '',
        'country': location.get('country') or '',
        'latitude': location.get('latitude'),
        'longitude': location.get('longitude'),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def reverse_geocode_api(request):
    try:
        lat = float(request.query_params.get('lat'))
        lng = float(request.query_params.get('lng'))
    except (TypeError, ValueError):
        return Response({'detail': 'lat and lng are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return Response({'detail': 'Invalid coordinates.'}, status=status.HTTP_400_BAD_REQUEST)

    location = reverse_geocode(lat, lng)
    if not location:
        return Response({
            'display_name': f'{lat:.6f}, {lng:.6f}',
            'latitude': lat,
            'longitude': lng,
            'city': '',
            'state': '',
            'province': '',
            'postal_code': '',
            'country': '',
        })

    return Response({
        **location,
        'province': location.get('state') or '',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def map_search_api(request):
    query = (request.query_params.get('q') or '').strip()
    if len(query) < 3:
        return Response({'results': []})
    results = search_locations(query)
    return Response({
        'results': [
            {
                **item,
                'province': item.get('state') or '',
            }
            for item in results
        ]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def business_type_providers_api(request, slug):
    try:
        business_type = BusinessType.objects.get(slug=slug, is_active=True)
    except BusinessType.DoesNotExist:
        return Response({'detail': 'Business type not found.'}, status=404)

    orgs = (
        Organization.objects.filter(
            is_active=True,
            profile_public=True,
            business_types=business_type,
        )
        .distinct()
        .order_by('name')
    )
    ctx = {'request': request}
    return Response({
        'business_type': BusinessTypeSerializer(business_type).data,
        'providers': PublicProviderCardSerializer(orgs, many=True, context=ctx).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_memberships_api(request):
    qs = OrganizationMembership.objects.filter(user=request.user).select_related('organization')
    return Response(OrganizationMembershipReadSerializer(qs, many=True).data)


def _business_types_for_discover():
    return (
        BusinessType.objects.filter(is_active=True)
        .annotate(
            provider_count=Count(
                'organizations',
                filter=Q(organizations__is_active=True, organizations__profile_public=True),
                distinct=True,
            )
        )
        .filter(provider_count__gt=0)
        .order_by('sort_order', 'name')
    )


def _serialize_bookable_service(service, *, ctx):
    org = service.organization
    types = [
        {'slug': t.slug, 'name': t.name, 'icon': t.icon}
        for t in org.business_types.all()
    ]
    dist_map = ctx.get('distance_by_org_id') or {}
    payload = {
        'id': service.id,
        'name': service.name,
        'description': service.description or '',
        'duration_minutes': service.duration_minutes,
        'base_price': str(service.base_price),
        'show_price': service.show_price,
        'image_url': PublicServiceReadSerializer(service, context=ctx).data.get('image_url'),
        'rating_summary': PublicServiceReadSerializer(service, context=ctx).data.get('rating_summary'),
        'organization_slug': org.slug,
        'organization_public_ref': org.public_ref,
        'organization_name': org.name,
        'organization_tagline': org.tagline or '',
        'service_city': org.service_city or '',
        'service_state': org.service_state or '',
        'service_postal_code': org.service_postal_code or '',
        'service_address': org.service_address or '',
        'location_short': organization_location_short(org),
        'location': organization_location_full(org) or None,
        'business_types': types,
        'org_lat': float(org.service_latitude) if org.service_latitude is not None else None,
        'org_lng': float(org.service_longitude) if org.service_longitude is not None else None,
    }
    if org.id in dist_map:
        payload['distance_miles'] = dist_map[org.id]
    availability = (ctx.get('availability_by_service_id') or {}).get(service.id)
    if availability:
        payload['availability'] = availability
    return payload


def _bookable_services_queryset():
    return (
        Service.objects.filter(
            is_active=True,
            organization__is_active=True,
            organization__profile_public=True,
        )
        .select_related('organization')
        .prefetch_related('organization__business_types', 'reviews')
        .order_by('organization__service_city', 'organization__name', 'sort_order', 'name')
    )


def _parse_date_key(value):
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def _availability_window_from_params(params):
    date_from_raw = (
        params.get('date_from')
        or params.get('start_date')
        or params.get('date')
        or ''
    ).strip()
    date_to_raw = (
        params.get('date_to')
        or params.get('end_date')
        or ''
    ).strip()
    if not date_from_raw and not date_to_raw:
        return None

    try:
        date_from = _parse_date_key(date_from_raw) or _parse_date_key(date_to_raw)
        date_to = _parse_date_key(date_to_raw) or date_from
    except ValueError:
        return {'error': 'Use dates in YYYY-MM-DD format.'}

    if date_from > date_to:
        date_from, date_to = date_to, date_from

    return {
        'date_from': date_from.isoformat(),
        'date_to': date_to.isoformat(),
        'start': timezone.make_aware(datetime.combine(date_from, time.min)),
        'end': timezone.make_aware(datetime.combine(date_to, time.max)),
    }


def _available_slot_queryset(window):
    return AvailabilitySlot.objects.filter(
        status=AvailabilitySlot.Status.OPEN,
        start_at__gt=timezone.now(),
        start_at__gte=window['start'],
        start_at__lte=window['end'],
        organization__is_active=True,
        organization__profile_public=True,
    )


def _apply_availability_filter(qs, window):
    if not window:
        return qs
    slots = _available_slot_queryset(window)
    service_slot_ids = slots.exclude(service__isnull=True).values_list('service_id', flat=True)
    general_org_ids = slots.filter(service__isnull=True).values_list('organization_id', flat=True)
    return qs.filter(
        Q(id__in=service_slot_ids) | Q(organization_id__in=general_org_ids)
    ).distinct()


def _availability_summary_for_services(services, window):
    if not window or not services:
        return {}

    service_ids = [s.id for s in services]
    org_ids = [s.organization_id for s in services]
    slots = (
        _available_slot_queryset(window)
        .filter(Q(service_id__in=service_ids) | Q(service__isnull=True, organization_id__in=org_ids))
        .order_by('start_at')
    )
    summary = {s.id: {'open_slot_count': 0, 'first_available_at': None} for s in services}
    services_by_org = {}
    for service in services:
        services_by_org.setdefault(service.organization_id, []).append(service.id)

    for slot in slots:
        target_ids = [slot.service_id] if slot.service_id else services_by_org.get(slot.organization_id, [])
        for service_id in target_ids:
            if service_id not in summary:
                continue
            summary[service_id]['open_slot_count'] += 1
            if summary[service_id]['first_available_at'] is None:
                summary[service_id]['first_available_at'] = slot.start_at.isoformat()
    return summary


def _apply_service_filters(
    qs,
    *,
    q='',
    city='',
    state='',
    postal='',
    radius_miles=None,
):
    dist_map = {}
    if postal:
        p = normalize_postal_code(postal)
        if p:
            miles = parse_radius_miles(radius_miles if radius_miles is not None else 25)
            center = resolve_coordinates(p, city=city, state=state)
            if center:
                lat, lng = center
                dist_map = organization_distances_within_radius(
                    lat,
                    lng,
                    miles,
                    base_qs=Organization.objects.filter(
                        is_active=True,
                        profile_public=True,
                    ),
                )
                if dist_map:
                    qs = qs.filter(organization_id__in=dist_map.keys())
                else:
                    qs = qs.none()
            else:
                qs = qs.filter(organization__service_postal_code__istartswith=p)
    if city:
        qs = qs.filter(organization__service_city__icontains=city.strip())
    if state:
        qs = qs.filter(organization__service_state__icontains=state.strip())
    if q:
        ql = q.lower()
        q_postal = normalize_postal_code(q)
        qs = qs.filter(
            Q(name__icontains=q)
            | Q(description__icontains=q)
            | Q(organization__name__icontains=q)
            | Q(organization__tagline__icontains=q)
            | Q(organization__service_city__icontains=q)
            | Q(organization__service_state__icontains=q)
            | Q(organization__service_address__icontains=q)
            | Q(organization__service_postal_code__icontains=q_postal or q)
            | Q(organization__business_types__name__icontains=q)
        ).distinct()
    return qs, dist_map


def _filter_organizations_by_location(orgs, *, postal='', city='', state='', radius_miles=None):
    if not postal:
        return orgs, {}
    p = normalize_postal_code(postal)
    if not p:
        return orgs, {}
    miles = parse_radius_miles(radius_miles if radius_miles is not None else 25)
    center = resolve_coordinates(p, city=city, state=state)
    if center:
        lat, lng = center
        dist_map = organization_distances_within_radius(lat, lng, miles, base_qs=orgs)
        return orgs.filter(id__in=dist_map.keys()) if dist_map else orgs.none(), dist_map
    return orgs.filter(service_postal_code__istartswith=p), {}


def _location_search_meta(postal, city, state, radius_miles, dist_map):
    if not postal:
        return None
    p = normalize_postal_code(postal)
    miles = parse_radius_miles(radius_miles if radius_miles is not None else 25)
    center = resolve_coordinates(p, city=city, state=state) if p else None
    return {
        'postal': p,
        'radius_miles': miles,
        'geocoded': center is not None,
        'result_count': len(dist_map),
    }


def _org_base_filter():
    return Q(is_active=True, profile_public=True, service_city__gt='')


def _orgs_for_location_picker(*, state='', city=''):
    qs = Organization.objects.filter(_org_base_filter()).exclude(service_state='')
    if state:
        qs = [o for o in qs if state_matches(o.service_state, state)]
    else:
        qs = list(qs)
    if city:
        qs = [o for o in qs if city_matches(o.service_city, city)]
    return qs


def _distinct_cities(*, state='', city=''):
    orgs = _orgs_for_location_picker(state=state, city='')
    provider_cities = sorted(
        {o.service_city.strip() for o in orgs if o.service_city},
        key=str.lower,
    )
    return merge_unique_sorted(provider_cities, reference_cities(state=state))


def _distinct_postal_codes(*, state='', city=''):
    orgs = _orgs_for_location_picker(state=state, city=city)
    provider_codes = sorted(
        {o.service_postal_code.strip() for o in orgs if o.service_postal_code},
        key=str.upper,
    )
    merged = merge_unique_sorted(
        provider_codes,
        reference_postal_codes(state=state, city=city),
    )
    return picker_postal_codes(merged, state=state)


def _location_picker_payload(*, state='', city=''):
    return {
        'cities': _distinct_cities(state=state, city=city),
        'postal_codes': _distinct_postal_codes(state=state, city=city),
        'states': merge_unique_sorted(
            list(
                Organization.objects.filter(_org_base_filter())
                .exclude(service_state='')
                .values_list('service_state', flat=True)
                .distinct()
            ),
        ),
    }



def _absolute_media_url(request, field):
    if not field:
        return None
    if request:
        return request.build_absolute_uri(field.url)
    return field.url


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_home_api(request):
    """Dashboard: connected providers, upcoming bookings, browse types."""
    user = request.user
    now = timezone.now()
    ctx = {'request': request}

    active_services = Service.objects.filter(is_active=True).order_by('sort_order', 'name')
    memberships = (
        OrganizationMembership.objects.filter(
            user=user,
            role=OrganizationMembership.Role.CUSTOMER,
            organization__is_active=True,
        )
        .select_related('organization')
        .prefetch_related(
            Prefetch('organization__services', queryset=active_services),
        )
        .order_by('organization__name')
    )

    upcoming_qs = (
        Booking.objects.filter(
            customer=user,
            start_at__gte=now,
        )
        .exclude(status=Booking.Status.CANCELLED)
        .select_related('organization', 'service')
        .order_by('start_at')[:12]
    )
    upcoming_by_org = {}
    for b in upcoming_qs:
        slug = b.organization.slug
        if slug not in upcoming_by_org:
            upcoming_by_org[slug] = {
                'id': b.id,
                'service_name': b.service.name,
                'start_at': b.start_at,
                'status': b.status,
            }

    providers = []
    for m in memberships:
        org = m.organization
        services = PublicServiceReadSerializer(
            list(org.services.all())[:8],
            many=True,
            context=ctx,
        ).data
        providers.append({
            'organization_slug': org.slug,
            'organization_public_ref': org.public_ref,
            'organization_name': org.name,
            'customer_status': m.customer_status or '',
            'can_book': customer_can_book(org, user) and getattr(user, 'has_booking_contact', True),
            'logo_url': _absolute_media_url(request, org.logo),
            'next_booking': upcoming_by_org.get(org.slug),
            'services': services,
        })

    types = BusinessTypeSerializer(_business_types_for_discover(), many=True).data

    return Response({
        'providers': providers,
        'upcoming_bookings': BookingSerializer(upcoming_qs, many=True).data,
        'business_types': types,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def public_services_browse_api(request):
    """Public catalog: service categories + bookable listings with search."""
    q = (request.query_params.get('q') or '').strip()
    city = (request.query_params.get('city') or '').strip()
    state = (request.query_params.get('state') or '').strip()
    postal = (request.query_params.get('postal') or request.query_params.get('pin') or '').strip()
    radius_raw = request.query_params.get('radius_miles') or request.query_params.get('miles')
    radius_miles = parse_radius_miles(radius_raw) if postal else None
    availability_window = _availability_window_from_params(request.query_params)
    if availability_window and availability_window.get('error'):
        return Response({'detail': availability_window['error']}, status=status.HTTP_400_BAD_REQUEST)

    types_qs = BusinessType.objects.filter(is_active=True).annotate(
        provider_count=Count(
            'organizations',
            filter=Q(organizations__is_active=True, organizations__profile_public=True),
            distinct=True,
        )
    ).order_by('sort_order', 'name')
    if q:
        types_qs = types_qs.filter(
            Q(name__icontains=q) | Q(description__icontains=q) | Q(slug__icontains=q.lower()),
        )

    # Allow direct lat/lng from map view (bypasses postal lookup)
    raw_lat = request.query_params.get('lat')
    raw_lng = request.query_params.get('lng')

    if raw_lat and raw_lng and not postal:
        try:
            center_lat = float(raw_lat)
            center_lng = float(raw_lng)
            miles = parse_radius_miles(radius_raw) if radius_raw else 25
            dist_map = organization_distances_within_radius(
                center_lat,
                center_lng,
                miles,
                base_qs=Organization.objects.filter(is_active=True, profile_public=True),
            )
            qs = _bookable_services_queryset()
            qs = qs.filter(organization_id__in=dist_map.keys()) if dist_map else qs.none()
            if q:
                qs = qs.filter(
                    Q(name__icontains=q)
                    | Q(organization__name__icontains=q)
                ).distinct()
            qs = _apply_availability_filter(qs, availability_window)
            service_list = list(qs[:200])
            ctx = {
                'request': request,
                'distance_by_org_id': dist_map,
                'availability_by_service_id': _availability_summary_for_services(
                    service_list, availability_window
                ),
            }
            services = [_serialize_bookable_service(s, ctx=ctx) for s in service_list]
            return Response({
                'services': services,
                'count': len(services),
                'availability_search': (
                    {
                        'date_from': availability_window['date_from'],
                        'date_to': availability_window['date_to'],
                    }
                    if availability_window
                    else None
                ),
            })
        except (ValueError, TypeError):
            pass

    qs, dist_map = _apply_service_filters(
        _bookable_services_queryset(),
        q=q,
        city=city,
        state=state,
        postal=postal,
        radius_miles=radius_miles,
    )
    qs = _apply_availability_filter(qs, availability_window)
    service_list = list(qs[:200])
    ctx = {
        'request': request,
        'distance_by_org_id': dist_map,
        'availability_by_service_id': _availability_summary_for_services(
            service_list, availability_window
        ),
    }
    services = [_serialize_bookable_service(s, ctx=ctx) for s in service_list]
    picker = _location_picker_payload(state=state, city=city)

    return Response({
        'business_types': BusinessTypeSerializer(types_qs, many=True).data,
        'services': services,
        'cities': picker['cities'],
        'states': picker['states'],
        'postal_codes': picker['postal_codes'],
        'count': len(services),
        'location_search': _location_search_meta(postal, city, state, radius_miles, dist_map),
        'availability_search': (
            {
                'date_from': availability_window['date_from'],
                'date_to': availability_window['date_to'],
            }
            if availability_window
            else None
        ),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_services_catalog_api(request):
    """All bookable services with search and location filters."""
    q = (request.query_params.get('q') or '').strip()
    city = (request.query_params.get('city') or '').strip()
    state = (request.query_params.get('state') or '').strip()
    postal = (request.query_params.get('postal') or request.query_params.get('pin') or '').strip()
    radius_raw = request.query_params.get('radius_miles') or request.query_params.get('miles')
    radius_miles = parse_radius_miles(radius_raw) if postal else None

    qs, dist_map = _apply_service_filters(
        _bookable_services_queryset(),
        q=q,
        city=city,
        state=state,
        postal=postal,
        radius_miles=radius_miles,
    )
    ctx = {'request': request, 'distance_by_org_id': dist_map}
    services = [_serialize_bookable_service(s, ctx=ctx) for s in qs[:200]]
    picker = _location_picker_payload(state=state, city=city)

    return Response({
        'services': services,
        'cities': picker['cities'],
        'states': picker['states'],
        'postal_codes': picker['postal_codes'],
        'count': len(services),
        'location_search': _location_search_meta(postal, city, state, radius_miles, dist_map),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_discover_api(request):
    """Search business types, providers, and services by keyword or lat/lng."""
    q = (request.query_params.get('q') or '').strip()
    postal = (request.query_params.get('postal') or request.query_params.get('pin') or '').strip()
    city = (request.query_params.get('city') or '').strip()
    state = (request.query_params.get('state') or '').strip()
    radius_raw = request.query_params.get('radius_miles') or request.query_params.get('miles')
    raw_lat = request.query_params.get('lat')
    raw_lng = request.query_params.get('lng')

    # Support lat/lng direct coordinate search (same as public browse API)
    if raw_lat and raw_lng and not postal:
        try:
            center_lat = float(raw_lat)
            center_lng = float(raw_lng)
            miles = parse_radius_miles(radius_raw) if radius_raw else 25
            dist_map = organization_distances_within_radius(
                center_lat,
                center_lng,
                miles,
                base_qs=Organization.objects.filter(is_active=True, profile_public=True),
            )
            qs = _bookable_services_queryset()
            qs = qs.filter(organization_id__in=dist_map.keys()) if dist_map else qs.none()
            if q:
                qs = qs.filter(
                    Q(name__icontains=q) | Q(organization__name__icontains=q)
                ).distinct()
            ctx = {'request': request, 'distance_by_org_id': dist_map}
            services = [_serialize_bookable_service(s, ctx=ctx) for s in qs[:40]]
            orgs_qs = Organization.objects.filter(
                is_active=True, profile_public=True, id__in=dist_map.keys()
            ).order_by('name')[:15]
            types_qs = _business_types_for_discover()[:12]
            return Response({
                'business_types': BusinessTypeSerializer(types_qs, many=True).data,
                'providers': PublicProviderCardSerializer(orgs_qs, many=True, context=ctx).data,
                'services': services,
            })
        except (ValueError, TypeError):
            pass

    radius_miles = parse_radius_miles(radius_raw) if postal else None
    if len(q) < 2 and not postal:
        return Response({'business_types': [], 'providers': [], 'services': []})

    ql = q.lower()
    q_postal = normalize_postal_code(q) if q else ''

    types_qs = _business_types_for_discover()
    if q:
        types_qs = types_qs.filter(
            Q(name__icontains=q) | Q(description__icontains=q) | Q(slug__icontains=ql),
        )
    types_qs = types_qs[:12]

    orgs = Organization.objects.filter(is_active=True, profile_public=True)
    if postal:
        orgs, dist_map = _filter_organizations_by_location(
            orgs, postal=postal, city=city, state=state, radius_miles=radius_miles,
        )
    elif q:
        orgs = orgs.filter(
            Q(name__icontains=q)
            | Q(tagline__icontains=q)
            | Q(slug__icontains=ql)
            | Q(service_postal_code__icontains=q_postal or q)
        )
        dist_map = {}
    else:
        dist_map = {}
    orgs = orgs.distinct().order_by('name')[:15]

    services_qs, svc_dist = _apply_service_filters(
        _bookable_services_queryset(),
        q=q,
        postal=postal,
        city=city,
        state=state,
        radius_miles=radius_miles,
    )
    dist_map = svc_dist or dist_map
    ctx = {'request': request, 'distance_by_org_id': dist_map}
    services = [_serialize_bookable_service(s, ctx=ctx) for s in services_qs[:20]]

    return Response({
        'business_types': BusinessTypeSerializer(types_qs, many=True).data,
        'providers': PublicProviderCardSerializer(orgs, many=True, context=ctx).data,
        'services': services,
        'location_search': _location_search_meta(postal, city, state, radius_miles, dist_map),
    })
