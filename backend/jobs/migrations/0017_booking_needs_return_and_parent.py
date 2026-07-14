# Generated manually for needs_return status + parent_booking link

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0016_booking_started_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='parent_booking',
            field=models.ForeignKey(
                blank=True,
                help_text='Original booking when this is a return visit for incomplete work.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='return_visits',
                to='jobs.booking',
            ),
        ),
        migrations.AlterField(
            model_name='booking',
            name='status',
            field=models.CharField(
                choices=[
                    ('requested', 'Requested'),
                    ('confirmed', 'Confirmed'),
                    ('in_progress', 'In progress'),
                    ('needs_return', 'Needs return visit'),
                    ('completed', 'Completed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='requested',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='bookingstatusevent',
            name='action',
            field=models.CharField(
                choices=[
                    ('created', 'Created'),
                    ('accepted', 'Accepted'),
                    ('declined', 'Declined'),
                    ('cancelled', 'Cancelled'),
                    ('started', 'Started'),
                    ('completed', 'Completed'),
                    ('rescheduled', 'Rescheduled'),
                    ('no_show', 'No-show'),
                    ('incomplete', 'Marked incomplete'),
                    ('return_scheduled', 'Return visit scheduled'),
                ],
                max_length=24,
            ),
        ),
    ]
