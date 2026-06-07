from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0006_organization_schedule_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='service_address',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Street address or area where services are offered',
                max_length=300,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='service_city',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='City where the business primarily operates',
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='service_state',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='State / province / region',
                max_length=80,
            ),
        ),
    ]
