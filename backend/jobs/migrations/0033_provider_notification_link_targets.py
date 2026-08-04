import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0032_message_notifications_and_read_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='providernotification',
            name='booking',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='provider_notifications',
                to='jobs.booking',
            ),
        ),
        migrations.AddField(
            model_name='providernotification',
            name='inquiry',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='provider_notifications',
                to='jobs.customerserviceinquiry',
            ),
        ),
        migrations.AddField(
            model_name='providernotification',
            name='link_path',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
    ]
