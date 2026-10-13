from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0059_booking_rebook_reminder'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='provider_1h_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When staff were reminded ~1 hour before the job.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='provider_en_route_nudge_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When staff were nudged ~30 minutes before to share location / go on the way.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='provider_start_overdue_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When staff were asked if the job started after start time + 30 minutes.',
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
                    ('job_starting_soon', 'Job starting in 1 hour'),
                    ('job_en_route_nudge', 'Share location / on the way?'),
                    ('job_start_overdue', 'Did the job start?'),
                ],
                max_length=40,
            ),
        ),
    ]
