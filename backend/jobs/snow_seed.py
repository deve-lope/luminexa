"""Seed snow org defaults when route optimization is enabled."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from businesses.models import Organization

from .models import Service, ServiceCategory, ServiceRegion
from .snow_defaults import (
    SNOW_CATEGORY_NAME,
    SNOW_SEED_SERVICES,
    default_snow_duration_matrix,
)


@transaction.atomic
def seed_snow_organization(organization: Organization) -> dict:
    """
    Idempotent seed for property_routes + snow:
    - duration matrix (if empty)
    - region "Main"
    - Snow cleaning category + 4 catalog services (placeholder prices)
    """
    updates = []
    if not organization.snow_duration_matrix:
        organization.snow_duration_matrix = default_snow_duration_matrix()
        updates.append('snow_duration_matrix')
    if organization.route_vertical != Organization.RouteVertical.SNOW:
        organization.route_vertical = Organization.RouteVertical.SNOW
        updates.append('route_vertical')
    if organization.provider_mode != Organization.ProviderMode.PROPERTY_ROUTES:
        organization.provider_mode = Organization.ProviderMode.PROPERTY_ROUTES
        updates.append('provider_mode')
    if updates:
        organization.save(update_fields=[*updates, 'updated_at'])

    region, region_created = ServiceRegion.objects.get_or_create(
        organization=organization,
        name='Main',
        defaults={
            'is_active': True,
            'depot_latitude': organization.service_latitude,
            'depot_longitude': organization.service_longitude,
        },
    )

    category, _ = ServiceCategory.objects.get_or_create(
        organization=organization,
        name=SNOW_CATEGORY_NAME,
        defaults={'sort_order': 5, 'is_active': True},
    )
    if not category.is_active:
        category.is_active = True
        category.save(update_fields=['is_active', 'updated_at'])

    services_created = 0
    for spec in SNOW_SEED_SERVICES:
        svc, created = Service.objects.get_or_create(
            organization=organization,
            name=spec['name'],
            defaults={
                'category': category,
                'description': (
                    f'Snow clearing — {spec["work_key"]}. '
                    'Set your price before offering one-time jobs.'
                ),
                'duration_minutes': spec['duration_minutes'],
                'pricing_type': Service.PricingType.FIXED,
                'base_price': Decimal('0.00'),
                'fulfillment_kind': Service.FulfillmentKind.MOBILE,
                'allow_request': False,
                'is_active': True,
                'sort_order': spec['sort_order'],
            },
        )
        if created:
            services_created += 1
        elif not svc.is_active:
            svc.is_active = True
            svc.save(update_fields=['is_active', 'updated_at'])

    return {
        'region_id': region.id,
        'region_created': region_created,
        'services_created': services_created,
        'category_id': category.id,
    }
