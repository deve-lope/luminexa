from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0005_organization_scheduling_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='schedule_valid_from',
            field=models.DateField(blank=True, help_text='First date to generate or offer availability', null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='schedule_valid_until',
            field=models.DateField(blank=True, help_text='Last date to generate or offer availability', null=True),
        ),
    ]
