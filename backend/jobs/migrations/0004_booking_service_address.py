from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0003_unavailableblock'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='service_address',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Where the service will take place (customer-provided).',
            ),
        ),
    ]
