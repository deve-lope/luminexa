# Generated for quote clarification notification kinds + status events

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0038_provider_notification_promo_offer'),
    ]

    operations = [
        migrations.AlterField(
            model_name='providernotification',
            name='kind',
            field=models.CharField(
                choices=[
                    ('flexi_no_slots_next_week', 'No slots open next week'),
                    ('new_customer_booking', 'New customer booking'),
                    ('customer_cancelled_booking', 'Customer cancelled booking'),
                    ('customer_reschedule_request', 'Customer reschedule request'),
                    ('quote_accepted', 'Quote accepted'),
                    ('payment_received', 'Payment received'),
                    ('new_message', 'New message'),
                    ('promo_offer', 'Promo offer'),
                    ('quote_answers_received', 'Quote answers received'),
                ],
                max_length=40,
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
                    ('invoice_ready', 'Invoice ready'),
                    ('payment_confirmed', 'Payment confirmed'),
                    ('new_message', 'New message'),
                    ('quote_details_requested', 'Quote details requested'),
                ],
                max_length=40,
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
                    ('quoted', 'Quote sent'),
                    ('quote_details_asked', 'Quote details asked'),
                    ('quote_answered', 'Quote questions answered'),
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
