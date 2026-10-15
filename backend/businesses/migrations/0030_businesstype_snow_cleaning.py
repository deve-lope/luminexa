from django.db import migrations


def add_snow_cleaning(apps, schema_editor):
    BusinessType = apps.get_model('businesses', 'BusinessType')
    BusinessType.objects.update_or_create(
        slug='snow-cleaning',
        defaults={
            'name': 'Snow cleaning',
            'description': 'Driveway, walkway, and seasonal snow clearing',
            'icon': '❄️',
            'sort_order': 25,
            'location_kind': 'mobile',
            'is_active': True,
        },
    )
    # Keep yard catalog text aligned with seed_demo (snow is its own type).
    BusinessType.objects.filter(slug='yard-outdoors').update(
        description='Mowing, leaf cleanup, hedges, and garden care',
    )


def remove_snow_cleaning(apps, schema_editor):
    BusinessType = apps.get_model('businesses', 'BusinessType')
    BusinessType.objects.filter(slug='snow-cleaning').update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0029_snow_route_foundation'),
    ]

    operations = [
        migrations.RunPython(add_snow_cleaning, remove_snow_cleaning),
    ]
