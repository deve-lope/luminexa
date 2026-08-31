from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0046_booking_rate_reminder'),
    ]

    operations = [
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
                    ('booking_reminder', 'Appointment reminder'),
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
