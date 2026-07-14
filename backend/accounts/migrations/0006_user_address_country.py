from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_backfill_empty_user_public_refs'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='address_country',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Preferred country for address search and geocoding (e.g. Canada)',
                max_length=80,
            ),
        ),
    ]
