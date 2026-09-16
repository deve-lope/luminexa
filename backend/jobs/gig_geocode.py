"""Geocoding helpers for gig posts."""

from businesses.geocode import resolve_coordinates
from businesses.location import quantize_coordinate


def assign_gig_coordinates(gig_post, *, save: bool = True) -> bool:
    """
    Geocode gig post location and store lat/lng.
    
    Args:
        gig_post: GigPost instance
        save: If True, save the gig_post after setting coordinates
    
    Returns:
        True if coordinates were successfully assigned, False otherwise
    """
    postal = (gig_post.location_postal_code or '').strip()
    if len(postal) < 3:
        return False
    
    coords = resolve_coordinates(
        postal,
        city=gig_post.location_city or '',
        state=gig_post.location_state or '',
    )
    
    if not coords:
        return False
    
    lat, lng = coords
    gig_post.location_latitude = quantize_coordinate(lat)
    gig_post.location_longitude = quantize_coordinate(lng)
    
    if save:
        gig_post.save(update_fields=['location_latitude', 'location_longitude', 'updated_at'])
    
    return True
