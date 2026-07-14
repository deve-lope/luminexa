from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_public_ref'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='default_service_address',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Customer default address for service visits',
            ),
        ),
    ]
