# Generated for promo_offer ProviderNotification kind

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0037_provider_notification_quote_accepted'),
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
                ],
                max_length=40,
            ),
        ),
    ]
