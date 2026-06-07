from django.core.management.base import BaseCommand

from businesses.location import assign_org_coordinates
from businesses.models import Organization


class Command(BaseCommand):
    help = 'Geocode organization postal codes to latitude/longitude for radius search.'

    def handle(self, *args, **options):
        qs = Organization.objects.exclude(service_postal_code='')
        ok = 0
        fail = 0
        for org in qs.iterator():
            if assign_org_coordinates(org):
                ok += 1
                self.stdout.write(f'  {org.slug}: {org.service_latitude}, {org.service_longitude}')
            else:
                fail += 1
                self.stdout.write(self.style.WARNING(f'  {org.slug}: geocode failed'))
        self.stdout.write(self.style.SUCCESS(f'Done: {ok} geocoded, {fail} failed.'))
