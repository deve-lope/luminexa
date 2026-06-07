from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0013_availabilityslot_service_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='preferred_date',
            field=models.DateField(
                blank=True,
                help_text='Customer-preferred date for the job (not a confirmed slot).',
                null=True,
            ),
        ),
    ]
