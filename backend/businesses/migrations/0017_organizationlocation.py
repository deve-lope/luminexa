from django.db import migrations, models
import django.db.models.deletion


def copy_org_service_to_locations(apps, schema_editor):
    Organization = apps.get_model('businesses', 'Organization')
    OrganizationLocation = apps.get_model('businesses', 'OrganizationLocation')
    for org in Organization.objects.all().iterator():
        has_data = any([
            (org.service_address or '').strip(),
            (org.service_city or '').strip(),
            (org.service_postal_code or '').strip(),
            org.service_latitude is not None,
            org.service_longitude is not None,
        ])
        if not has_data:
            continue
        if OrganizationLocation.objects.filter(organization_id=org.id).exists():
            continue
        OrganizationLocation.objects.create(
            organization_id=org.id,
            name='Primary',
            is_primary=True,
            address=org.service_address or '',
            city=org.service_city or '',
            state=org.service_state or '',
            postal_code=org.service_postal_code or '',
            latitude=org.service_latitude,
            longitude=org.service_longitude,
            radius_miles=org.service_radius_miles or 25,
            is_active=True,
            sort_order=0,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0016_organization_concurrent_capacity'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationLocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, default='', help_text='Optional label, e.g. Downtown or North branch', max_length=120)),
                ('is_primary', models.BooleanField(default=False, help_text='Primary location is shown on the storefront and used for billing address defaults.')),
                ('address', models.CharField(blank=True, default='', max_length=300)),
                ('city', models.CharField(blank=True, db_index=True, default='', max_length=120)),
                ('state', models.CharField(blank=True, db_index=True, default='', max_length=80)),
                ('postal_code', models.CharField(blank=True, db_index=True, default='', max_length=12)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('radius_miles', models.DecimalField(decimal_places=1, default=25, help_text='How far from this pin the business serves customers.', max_digits=5)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='locations', to='businesses.organization')),
            ],
            options={
                'ordering': ['-is_primary', 'sort_order', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='organizationlocation',
            index=models.Index(fields=['organization', 'is_active'], name='biz_orgloc_org_active_idx'),
        ),
        migrations.AddIndex(
            model_name='organizationlocation',
            index=models.Index(fields=['latitude', 'longitude'], name='biz_orgloc_lat_lng_idx'),
        ),
        migrations.RunPython(copy_org_service_to_locations, noop_reverse),
    ]
