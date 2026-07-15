from django.core.management.base import BaseCommand

from businesses.location import (
    assign_location_coordinates,
    assign_org_coordinates,
    ensure_primary_location,
    sync_org_primary_from_location,
)
from businesses.models import Organization, OrganizationLocation


class Command(BaseCommand):
    help = 'Geocode organization / location postal codes to latitude/longitude for radius search.'

    def handle(self, *args, **options):
        org_ok = 0
        org_fail = 0
        for org in Organization.objects.exclude(service_postal_code='').iterator():
            ensure_primary_location(org)
            if assign_org_coordinates(org):
                org_ok += 1
                self.stdout.write(f'  org {org.slug}: {org.service_latitude}, {org.service_longitude}')
            else:
                org_fail += 1
                self.stdout.write(self.style.WARNING(f'  org {org.slug}: geocode failed'))

        loc_ok = 0
        loc_fail = 0
        locs = OrganizationLocation.objects.filter(
            latitude__isnull=True,
        ).exclude(postal_code='').select_related('organization')
        for loc in locs.iterator():
            if assign_location_coordinates(loc):
                loc_ok += 1
                if loc.is_primary:
                    sync_org_primary_from_location(loc)
                self.stdout.write(
                    f'  loc {loc.organization.slug}/{loc.id}: {loc.latitude}, {loc.longitude}'
                )
            else:
                loc_fail += 1
                self.stdout.write(
                    self.style.WARNING(f'  loc {loc.organization.slug}/{loc.id}: geocode failed')
                )

        self.stdout.write(self.style.SUCCESS(
            f'Done: orgs {org_ok} geocoded / {org_fail} failed; '
            f'locations {loc_ok} geocoded / {loc_fail} failed.'
        ))
