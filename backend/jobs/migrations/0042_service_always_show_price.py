from django.db import migrations, models


def force_show_all_prices(apps, schema_editor):
    Service = apps.get_model('jobs', 'Service')
    Service.objects.filter(show_price=False).update(show_price=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0041_booking_customer_view_token'),
    ]

    operations = [
        migrations.AlterField(
            model_name='service',
            name='show_price',
            field=models.BooleanField(
                default=True,
                help_text='Always true — catalog prices are shown on the public booking profile.',
            ),
        ),
        migrations.RunPython(force_show_all_prices, noop_reverse),
    ]
