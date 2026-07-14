from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0023_customer_notification'),
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
                ],
                max_length=40,
            ),
        ),
    ]
