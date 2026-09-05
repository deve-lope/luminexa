from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0049_incomplete_job_task_reminder'),
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
                    ('customer_reported_no_show', 'Customer reported no-show'),
                    ('incomplete_job_tasks', 'Incomplete job tasks'),
                    ('subscription_ending', 'Subscription ending'),
                ],
                max_length=40,
            ),
        ),
    ]
