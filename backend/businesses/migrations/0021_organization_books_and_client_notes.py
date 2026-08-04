# Generated manually for provider books settings + client notes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0020_organization_stripe_billing'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='default_labor_rate',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Default hourly labor rate for job costing (optional).',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='invoice_followup_days',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Days after issue to send payment reminders, e.g. [3, 7, 14]. Empty uses defaults.',
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='invoice_followup_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Email customers automatic reminders for unpaid invoices.',
            ),
        ),
        migrations.AddField(
            model_name='organizationmembership',
            name='provider_notes',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Internal notes about this customer (staff only).',
            ),
        ),
    ]
