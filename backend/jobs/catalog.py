"""Group active services by category for public/provider catalog views."""

from businesses.models import BusinessType

from .models import Service, ServiceCategory


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
