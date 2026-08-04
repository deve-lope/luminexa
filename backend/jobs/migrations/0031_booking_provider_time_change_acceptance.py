from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0030_payment_confirmation_notifications'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='awaiting_customer_acceptance',
            field=models.BooleanField(
                default=False,
                help_text='True when the provider proposed a new time (and/or quote) and the customer must accept.',
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='prior_availability_slot',
            field=models.ForeignKey(
                blank=True,
                help_text='Previous slot before a provider-proposed time change.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='jobs.availabilityslot',
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='prior_end_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Previous end when the provider proposed a new time.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='prior_start_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Previous start when the provider proposed a new time (awaiting customer accept).',
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
                    ('invoice_ready', 'Invoice ready'),
                    ('payment_confirmed', 'Payment confirmed'),
                ],
                max_length=40,
            ),
        ),
    ]
