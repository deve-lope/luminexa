# Invoice QuickBooks sync ids

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0035_job_costing_and_invoice_reminders'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='qbo_invoice_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='invoice',
            name='qbo_payment_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='invoice',
            name='qbo_synced_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
