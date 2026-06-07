"""Group active services by category for public/provider catalog views."""

from .models import Service, ServiceCategory


def build_service_catalog(organization, service_serializer, *, active_only=True):
    """
    Return categories with nested serialized services plus uncategorized bucket.

    service_serializer: callable(queryset) -> list[dict]
    """
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
