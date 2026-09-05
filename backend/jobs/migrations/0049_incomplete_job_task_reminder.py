from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0048_servicerequestmessage_attachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='incomplete_tasks_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When staff were reminded about incomplete tasks ~48h before the job.',
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
                    ('quote_accepted', 'Quote accepted'),
                    ('payment_received', 'Payment received'),
                    ('new_message', 'New message'),
                    ('promo_offer', 'Promo offer'),
                    ('quote_answers_received', 'Quote answers received'),
                    ('customer_reported_no_show', 'Customer reported no-show'),
                    ('incomplete_job_tasks', 'Incomplete job tasks'),
                ],
                max_length=40,
            ),
        ),
    ]
