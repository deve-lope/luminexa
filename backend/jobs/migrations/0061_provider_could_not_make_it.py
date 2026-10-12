from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0060_provider_job_nudges'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bookingstatusevent',
            name='action',
            field=models.CharField(
                choices=[
                    ('created', 'Created'),
                    ('accepted', 'Accepted'),
                    ('declined', 'Declined'),
                    ('cancelled', 'Cancelled'),
                    ('quoted', 'Quote sent'),
                    ('quote_details_asked', 'Quote details asked'),
                    ('quote_answered', 'Quote questions answered'),
                    ('quote_accepted', 'Quote accepted'),
                    ('started', 'Started'),
                    ('completed', 'Completed'),
                    ('rescheduled', 'Rescheduled'),
                    ('no_show', 'No-show'),
                    ('customer_no_show_reported', 'Customer reported no-show'),
                    ('provider_could_not_make_it', 'Provider could not make it'),
                    ('incomplete', 'Marked incomplete'),
                    ('return_scheduled', 'Return visit scheduled'),
                    ('on_the_way', 'On the way'),
                    ('en_route_stopped', 'Stopped sharing location'),
                ],
                max_length=32,
            ),
        ),
    ]
