"""Close expired gig posts and notify customers."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from jobs.gig_notifications import notify_gig_expired
from jobs.models import GigPost, GigQuote


class Command(BaseCommand):
    help = 'Close expired gig posts and notify customers'

    def handle(self, *args, **options):
        now = timezone.now()
        expired = GigPost.objects.filter(
            expires_at__lte=now,
            status__in=[GigPost.Status.OPEN, GigPost.Status.QUOTED],
        )
        count = 0
        for post in expired:
            quote_count = post.quotes.filter(status=GigQuote.Status.SUBMITTED).count()
            post.status = GigPost.Status.CLOSED
            post.save(update_fields=['status', 'updated_at'])
            notify_gig_expired(post, quote_count=quote_count)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Closed {count} expired gig post(s)'))
