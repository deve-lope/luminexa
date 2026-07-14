# Invoice tax breakdown for POS billing (CA/US from business address)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0019_invoice_tax_breakdown'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='subtotal',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Amount before tax. Null on legacy invoices.',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='tax_country',
            field=models.CharField(blank=True, default='', max_length=2),
        ),
        migrations.AddField(
            model_name='invoice',
            name='tax_region',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Province/state code used for tax (from business address).',
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='tax_total',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='tax_lines',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
