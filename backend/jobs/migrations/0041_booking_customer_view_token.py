import secrets

from django.db import migrations, models


def backfill_customer_view_tokens(apps, schema_editor):
    Booking = apps.get_model('jobs', 'Booking')
    used = set(
        Booking.objects.exclude(customer_view_token='')
        .values_list('customer_view_token', flat=True)
    )
    to_update = []
    for booking in Booking.objects.filter(customer_view_token='').iterator():
        token = secrets.token_urlsafe(32)
        while token in used:
            token = secrets.token_urlsafe(32)
        used.add(token)
        booking.customer_view_token = token
        to_update.append(booking)
        if len(to_update) >= 200:
            Booking.objects.bulk_update(to_update, ['customer_view_token'])
            to_update = []
    if to_update:
        Booking.objects.bulk_update(to_update, ['customer_view_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0040_org_customer_conversations'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='customer_view_token',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.RunPython(backfill_customer_view_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='booking',
            name='customer_view_token',
            field=models.CharField(
                db_index=True,
                help_text='Unguessable token for the customer share URL (/b/<token>).',
                max_length=64,
                unique=True,
            ),
        ),
    ]
