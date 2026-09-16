"""Permission checks for gig wall actions."""

from businesses.gig_location import visible_gig_posts_for_organization
from businesses.models import OrganizationMembership
from jobs.models import GigPost


def can_comment_on_gig(user, gig_post, organization=None):
    """
    Check if user can comment on a gig post.
    
    Rules:
    - Post owner (customer) can always comment
    - Provider staff/owner can comment if post is visible to their org
    
    Args:
        user: User instance
        gig_post: GigPost instance
        organization: Organization instance (required if user is provider)
    
    Returns:
        bool
    """
    # If user owns the post
    if gig_post.customer_id == user.id:
        return True
    
    # If provider, check visibility
    if organization:
        visible = visible_gig_posts_for_organization(
            organization,
            GigPost.objects.filter(id=gig_post.id)
        )
        return visible.exists()
    
    return False


def can_quote_on_gig(user, organization, gig_post):
    """
    Check if provider can submit a quote.
    
    Rules:
    - Must be owner or staff of organization
    - Post must be visible to organization
    - Post status must be 'open' or 'quoted'
    
    Args:
        user: User instance
        organization: Organization instance
        gig_post: GigPost instance
    
    Returns:
        bool
    """
    # Check membership
    membership = OrganizationMembership.objects.filter(
        organization=organization,
        user=user,
        role__in=['owner', 'staff']
    ).first()
    
    if not membership:
        return False
    
    # Check visibility
    visible = visible_gig_posts_for_organization(
        organization,
        GigPost.objects.filter(id=gig_post.id)
    )
    if not visible.exists():
        return False
    
    # Check post status
    if gig_post.status not in ['open', 'quoted']:
        return False
    
    return True
