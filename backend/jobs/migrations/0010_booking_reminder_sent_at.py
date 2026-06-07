from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0009_service_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the 24h reminder email was sent.',
                null=True,
            ),
        ),
    ]
