from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0031_booking_provider_time_change_acceptance'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='customer_messages_read_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the customer last opened this booking conversation.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='provider_messages_read_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When provider staff last opened this booking conversation.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='customer_messages_read_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the customer last opened this inquiry conversation.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='provider_messages_read_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When provider staff last opened this inquiry conversation.',
                null=True,
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
                    ('payment_received', 'Payment received'),
                    ('new_message', 'New message'),
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
                ],
                max_length=40,
            ),
        ),
    ]
