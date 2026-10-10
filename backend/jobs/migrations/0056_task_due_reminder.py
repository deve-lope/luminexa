from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0055_booking_job_title_inquiry_gig_quote'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='due_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When staff were reminded ~24h before this task’s due time.',
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
                    ('task_due', 'Task due soon'),
                    ('subscription_ending', 'Subscription ending'),
                    ('new_gig_in_area', 'New gig in your area'),
                    ('gig_quote_accepted', 'Gig quote accepted'),
                    ('new_gig_comment', 'New comment on gig'),
                    ('gig_quote_countered', 'Customer countered your gig bid'),
                    ('gig_quote_rejected', 'Customer rejected your gig bid'),
                ],
                max_length=40,
            ),
        ),
    ]
