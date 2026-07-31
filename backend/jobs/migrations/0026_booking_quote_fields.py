from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0025_booking_slot_capacity_fk'),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='status',
            field=models.CharField(
                choices=[
                    ('requested', 'Requested'),
                    ('quoted', 'Quote sent'),
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
        migrations.AddField(
            model_name='booking',
            name='quote_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Provider quote amount awaiting customer acceptance.',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='quote_message',
            field=models.TextField(
                blank=True,
                default='',
                help_text='What the quote covers / notes for the customer.',
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='quote_questions',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='[{id, question, answer}] questions the provider asks before/with the quote.',
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='quoted_at',
            field=models.DateTimeField(blank=True, null=True),
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
                    ('quoted', 'Quote sent'),
                    ('quote_accepted', 'Quote accepted'),
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
