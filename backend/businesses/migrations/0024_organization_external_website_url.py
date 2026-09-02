from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0023_promo_codes_and_subscription_source'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='external_website_url',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Optional link to the provider’s own website (shown on their public page).',
                max_length=500,
            ),
        ),
    ]
