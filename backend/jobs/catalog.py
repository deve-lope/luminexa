"""Group active services by category for public/provider catalog views."""

from django.db.models import Count

from businesses.models import BusinessType, Organization

from .models import Booking, Service, ServiceCategory


def ensure_org_categories_from_business_types(organization):
    """
    Keep per-org ServiceCategory rows aligned with the platform BusinessType catalog.

    Providers select from these; only platform admins add/rename types (Django admin /
    staff BusinessType API).
    """
    active_types = list(
        BusinessType.objects.filter(is_active=True).order_by('sort_order', 'name')
    )
    if not active_types:
        return ServiceCategory.objects.none()

    keep_names = {bt.name for bt in active_types}
    for bt in active_types:
        cat, created = ServiceCategory.objects.get_or_create(
            organization=organization,
            name=bt.name,
            defaults={
                'sort_order': bt.sort_order,
                'is_active': True,
            },
        )
        updates = []
        if cat.sort_order != bt.sort_order:
            cat.sort_order = bt.sort_order
            updates.append('sort_order')
        if not cat.is_active:
            cat.is_active = True
            updates.append('is_active')
        if updates:
            cat.save(update_fields=updates)

    # Hide org categories that are no longer in the platform catalog (keep rows for FKs).
    ServiceCategory.objects.filter(organization=organization, is_active=True).exclude(
        name__in=keep_names
    ).update(is_active=False)

    return ServiceCategory.objects.filter(organization=organization, is_active=True)


def organizations_with_services_for_business_type(business_type):
    """
    Public orgs that list ≥1 active service under the category matching this
    platform browse type (by category name). Org business_types tags alone are
    not enough — customers must see a real catalog in that category.
    """
    return (
        Organization.objects.filter(
            is_active=True,
            profile_public=True,
            services__is_active=True,
            services__category__is_active=True,
            services__category__name__iexact=business_type.name,
        )
        .distinct()
        .order_by('name')
    )


def business_types_with_service_provider_counts(*, require_providers=True):
    """
    Platform BusinessTypes with provider_count = distinct public orgs that have
    at least one active service in a matching ServiceCategory name.

    Also sets booking_count (non-cancelled bookings for services in that category)
    and returns types ordered most-booked first, then sort_order, then name.
    """
    counts = {
        (name or '').strip().lower(): n
        for name, n in (
            Service.objects.filter(
                is_active=True,
                organization__is_active=True,
                organization__profile_public=True,
                category__is_active=True,
            )
            .values('category__name')
            .annotate(c=Count('organization_id', distinct=True))
            .values_list('category__name', 'c')
        )
    }
    booking_counts = {
        (name or '').strip().lower(): n
        for name, n in (
            Booking.objects.exclude(status=Booking.Status.CANCELLED)
            .filter(
                service__is_active=True,
                service__category__is_active=True,
                organization__is_active=True,
                organization__profile_public=True,
            )
            .values('service__category__name')
            .annotate(c=Count('id'))
            .values_list('service__category__name', 'c')
        )
    }
    result = []
    for bt in BusinessType.objects.filter(is_active=True).order_by('sort_order', 'name'):
        key = (bt.name or '').strip().lower()
        count = counts.get(key, 0)
        bt.provider_count = count
        bt.booking_count = booking_counts.get(key, 0)
        if require_providers and count <= 0:
            continue
        result.append(bt)
    result.sort(key=lambda t: (-t.booking_count, t.sort_order, (t.name or '').lower()))
    return result


def build_service_catalog(organization, service_serializer, *, active_only=True):
    """
    Return categories with nested serialized services plus uncategorized bucket.

    service_serializer: callable(queryset) -> list[dict]
    """
    ensure_org_categories_from_business_types(organization)

    svc_qs = Service.objects.filter(organization=organization).select_related('category')
    if active_only:
        svc_qs = svc_qs.filter(is_active=True)

    cat_qs = ServiceCategory.objects.filter(organization=organization)
    if active_only:
        cat_qs = cat_qs.filter(is_active=True)
    cat_qs = cat_qs.order_by('sort_order', 'name')

    by_category = {c.id: [] for c in cat_qs}
    uncategorized = []

    for svc in svc_qs.order_by('sort_order', 'name'):
        if svc.category_id and svc.category_id in by_category:
            by_category[svc.category_id].append(svc)
        else:
            uncategorized.append(svc)

    categories = []
    for cat in cat_qs:
        services = by_category.get(cat.id) or []
        if not services:
            continue
        categories.append({
            'id': cat.id,
            'name': cat.name,
            'sort_order': cat.sort_order,
            'services': service_serializer(services),
        })

    return {
        'categories': categories,
        'uncategorized_services': service_serializer(uncategorized),
    }
