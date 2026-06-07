from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0007_organization_service_location'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='service_postal_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='PIN / postal code for the primary service area',
                max_length=12,
            ),
        ),
    ]
