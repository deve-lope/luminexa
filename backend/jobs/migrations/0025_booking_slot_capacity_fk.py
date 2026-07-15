import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0024_provider_notification_customer_actions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='availability_slot',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    'Time window this booking occupies. Multiple bookings may share a slot '
                    'up to org capacity.'
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='bookings',
                to='jobs.availabilityslot',
            ),
        ),
    ]
