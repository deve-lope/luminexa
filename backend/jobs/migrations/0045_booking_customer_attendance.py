from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0044_inquiry_cancelled_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='customer_confirmed_attendance_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Customer confirmed the provider showed up for this appointment.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='customer_reported_no_show_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Customer reported the provider did not show up.',
                null=True,
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
                    ('customer_no_show_reported', 'Customer reported no-show'),
                    ('incomplete', 'Marked incomplete'),
                    ('return_scheduled', 'Return visit scheduled'),
                ],
                max_length=32,
            ),
        ),
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
                    ('customer_reported_no_show', 'Customer reported no-show'),
                ],
                max_length=40,
            ),
        ),
    ]
