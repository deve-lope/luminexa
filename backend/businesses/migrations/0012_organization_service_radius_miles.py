from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('businesses', '0011_organization_public_ref'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='service_radius_miles',
            field=models.DecimalField(
                decimal_places=1,
                default=25,
                help_text='How far from the map center this provider serves customers',
                max_digits=5,
            ),
        ),
    ]
