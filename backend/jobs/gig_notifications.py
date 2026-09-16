"""In-app notifications for Gig Wall events."""

from .models import CustomerNotification, ProviderNotification


def notify_new_gig_quote(gig_quote):
    """Notify customer when a provider submits a quote."""
    post = gig_quote.gig_post
    CustomerNotification.objects.create(
        customer=post.customer,
        organization=gig_quote.organization,
        kind=CustomerNotification.Kind.NEW_GIG_QUOTE,
        title='New Quote Received',
        message=(
            f'{gig_quote.organization.name} quoted ${gig_quote.price} '
            f'for "{post.title}"'
        ),
        link_path=f'/customer/gigs/{post.id}?tab=quotes',
    )


def notify_quote_accepted(gig_quote):
    """Notify provider when their quote is accepted."""
    post = gig_quote.gig_post
    org = gig_quote.organization
    ProviderNotification.objects.create(
        organization=org,
        kind=ProviderNotification.Kind.GIG_QUOTE_ACCEPTED,
        message=(
            f'Your quote of ${gig_quote.price} was accepted for "{post.title}"'
        ),
        link_path=f'/provider/{org.slug}/gigs/{post.id}',
    )


def notify_new_comment(gig_comment):
    """Notify the other party when a comment is posted."""
    post = gig_comment.gig_post

    if gig_comment.author_id == post.customer_id:
        org_ids = set(
            post.comments.exclude(organization_id__isnull=True)
            .values_list('organization_id', flat=True)
        )
        org_ids.update(
            post.quotes.values_list('organization_id', flat=True)
        )
        # Don't notify the commenter's own org if somehow set
        if gig_comment.organization_id:
            org_ids.discard(gig_comment.organization_id)
        from businesses.models import Organization
        org_slugs = dict(Organization.objects.filter(id__in=org_ids).values_list('id', 'slug'))
        for org_id in org_ids:
            slug = org_slugs.get(org_id, '')
            ProviderNotification.objects.create(
                organization_id=org_id,
                kind=ProviderNotification.Kind.NEW_GIG_COMMENT,
                message=f'Customer replied on "{post.title}"',
                link_path=f'/provider/{slug}/gigs/{post.id}?tab=comments' if slug else f'/customer/gigs/{post.id}?tab=comments',
            )
    else:
        CustomerNotification.objects.create(
            customer=post.customer,
            organization=gig_comment.organization,
            kind=CustomerNotification.Kind.NEW_GIG_COMMENT,
            title='New Comment',
            message=(
                f'{(gig_comment.organization.name if gig_comment.organization_id else "A provider")} '
                f'commented on "{post.title}"'
            ),
            link_path=f'/customer/gigs/{post.id}?tab=comments',
        )


def notify_gig_expired(gig_post, quote_count: int = 0):
    """Notify customer when their gig post expires."""
    CustomerNotification.objects.create(
        customer=gig_post.customer,
        kind=CustomerNotification.Kind.GIG_EXPIRED,
        title='Gig Post Expired',
        message=(
            f'Your gig post "{gig_post.title}" expired with {quote_count} quote(s).'
        ),
        link_path=f'/customer/gigs/{gig_post.id}',
    )
