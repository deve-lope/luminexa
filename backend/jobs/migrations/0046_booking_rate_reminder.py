from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0045_booking_customer_attendance'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='rate_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the customer was nudged to rate this completed job.',
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='customernotification',
            name='kind',
            field=models.CharField(
                choices=[
                    ('booking_confirmed', 'Booking confirmed'),
                    ('booking_declined', 'Booking declined'),
                    ('booking_cancelled', 'Booking cancelled'),
                    ('booking_rescheduled', 'Booking rescheduled'),
                    ('booking_time_change', 'Provider proposed a new time'),
                    ('booking_completed', 'Booking completed'),
                    ('rate_service', 'Rate your service'),
                    ('invoice_ready', 'Invoice ready'),
                    ('payment_confirmed', 'Payment confirmed'),
                    ('new_message', 'New message'),
                    ('quote_details_requested', 'Quote details requested'),
                ],
                max_length=40,
            ),
        ),
    ]
