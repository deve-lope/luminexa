from django.db.models import Avg, Count

RATING_DIMENSIONS = ('communication', 'price', 'punctual', 'quality')


def aggregate_service_ratings(reviews_qs):
    agg = reviews_qs.aggregate(
        count=Count('id'),
        communication=Avg('communication'),
        price=Avg('price'),
        punctual=Avg('punctual'),
        quality=Avg('quality'),
    )
    count = agg['count'] or 0
    if count == 0:
        return {
            'count': 0,
            'average': None,
            'communication': None,
            'price': None,
            'punctual': None,
            'quality': None,
        }
    dims = {
        dim: round(agg[dim], 1) if agg[dim] is not None else None
        for dim in RATING_DIMENSIONS
    }
    dim_values = [dims[d] for d in RATING_DIMENSIONS if dims[d] is not None]
    average = round(sum(dim_values) / len(dim_values), 1) if dim_values else None
    return {'count': count, 'average': average, **dims}


def customer_can_rate_service(service, user):
    if not user or not user.is_authenticated:
        return False
    if service.reviews.filter(customer=user).exists():
        return False
    return service.bookings.filter(
        customer=user,
        status=service.bookings.model.Status.COMPLETED,
    ).exists()
