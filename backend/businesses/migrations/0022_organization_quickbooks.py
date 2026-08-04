# QuickBooks + instant payout related fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0021_organization_books_and_client_notes'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='qbo_access_token',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='organization',
            name='qbo_connected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='qbo_realm_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='organization',
            name='qbo_refresh_token',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='organization',
            name='qbo_token_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='organizationmembership',
            name='qbo_customer_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='QuickBooks Online Customer Id when synced.',
                max_length=64,
            ),
        ),
    ]
