from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0024_organization_external_website_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='subscription_ending_reminder_30d_for',
            field=models.DateTimeField(
                blank=True,
                help_text='Period end this ~30-day subscription-ending reminder was sent for.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='subscription_ending_reminder_7d_for',
            field=models.DateTimeField(
                blank=True,
                help_text='Period end this ~7-day subscription-ending reminder was sent for.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='subscription_ending_reminder_2d_for',
            field=models.DateTimeField(
                blank=True,
                help_text='Period end this ~2-day subscription-ending reminder was sent for.',
                null=True,
            ),
        ),
    ]
