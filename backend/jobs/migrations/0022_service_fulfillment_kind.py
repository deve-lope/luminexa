from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0021_invoice_line_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='service',
            name='fulfillment_kind',
            field=models.CharField(
                choices=[('mobile', 'Mobile — we come to the customer'), ('shop', 'In-shop — customer comes to us')],
                default='mobile',
                help_text='Mobile: provider goes to the customer. Shop: customer comes to the business.',
                max_length=16,
            ),
        ),
    ]
