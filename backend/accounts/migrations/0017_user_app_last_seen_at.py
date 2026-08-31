from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_device_push_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='app_last_seen_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Updated when the customer opens the app (session heartbeat).',
                null=True,
            ),
        ),
    ]
