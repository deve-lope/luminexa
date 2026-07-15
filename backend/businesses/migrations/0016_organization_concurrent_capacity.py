from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0015_cancel_cutoff_and_blocked_customer'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='concurrent_capacity',
            field=models.PositiveIntegerField(
                default=1,
                help_text=(
                    'How many people can work at the same time. '
                    'Each open slot can accept this many simultaneous bookings '
                    '(e.g. 2 employees → 2 customers at the same time).'
                ),
            ),
        ),
    ]
