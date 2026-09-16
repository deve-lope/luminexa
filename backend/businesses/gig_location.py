"""Gig post visibility filtering based on dual-radius location matching."""

from businesses.location import haversine_miles, parse_radius_miles
from jobs.models import GigPost


def visible_gig_posts_for_organization(organization, base_qs=None):
    """
    Return gig posts visible to this provider based on dual-radius matching.
    
    A post matches if ANY active org location satisfies BOTH:
    1. distance <= post.search_radius_miles (customer's search area)
    2. distance <= location.radius_miles (provider's service area)
    
    This mirrors the dual-radius logic used in organization_distances_within_radius
    from businesses.location, but filters gig posts instead of organizations.
    
    Args:
        organization: Organization instance
        base_qs: Optional GigPost queryset to filter (defaults to all open posts)
    
    Returns:
        Filtered QuerySet of GigPost
    
    Example:
        >>> from businesses.models import Organization
        >>> from businesses.gig_location import visible_gig_posts_for_organization
        >>> org = Organization.objects.get(slug='acme-plumbing')
        >>> visible_posts = visible_gig_posts_for_organization(org)
        >>> print(f"Found {visible_posts.count()} visible gig posts")
    """
    qs = base_qs if base_qs is not None else GigPost.objects.filter(status='open')
    
    visible_ids = set()
    
    # Get all active locations for this organization
    locations = organization.locations.filter(is_active=True)
    
    # If no locations, try legacy Organization.service_* fields
    if not locations.exists():
        if organization.service_latitude and organization.service_longitude:
            locations = [{
                'latitude': organization.service_latitude,
                'longitude': organization.service_longitude,
                'radius_miles': organization.service_radius_miles or 25,
            }]
        else:
            # No geocoded locations, no matches
            return qs.none()
    
    for loc in locations:
        # Handle both location objects and legacy dict
        if isinstance(loc, dict):
            loc_lat = loc['latitude']
            loc_lng = loc['longitude']
            loc_radius = loc['radius_miles']
        else:
            loc_lat = loc.latitude
            loc_lng = loc.longitude
            loc_radius = loc.radius_miles or 25
        
        if loc_lat is None or loc_lng is None:
            continue
        
        # Get all posts with coordinates
        posts = qs.exclude(location_latitude__isnull=True).exclude(
            location_longitude__isnull=True
        )
        
        for post in posts:
            # Calculate distance between provider location and gig post location
            dist = haversine_miles(
                float(loc_lat), float(loc_lng),
                float(post.location_latitude), float(post.location_longitude)
            )
            
            # Check dual radius constraint
            post_radius = parse_radius_miles(post.search_radius_miles)
            provider_radius = parse_radius_miles(loc_radius)
            
            if dist <= post_radius and dist <= provider_radius:
                visible_ids.add(post.id)
    
    return qs.filter(id__in=visible_ids)
