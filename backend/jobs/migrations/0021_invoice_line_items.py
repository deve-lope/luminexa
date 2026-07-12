# Generated manually for invoice line_items (parts / extras on the bill).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0020_invoice_tax_breakdown'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='line_items',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Additional bill lines (parts, materials, etc.).',
            ),
        ),
    ]
