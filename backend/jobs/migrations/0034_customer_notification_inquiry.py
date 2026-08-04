import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0033_provider_notification_link_targets'),
    ]

    operations = [
        migrations.AddField(
            model_name='customernotification',
            name='inquiry',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='customer_notifications',
                to='jobs.customerserviceinquiry',
            ),
        ),
    ]
