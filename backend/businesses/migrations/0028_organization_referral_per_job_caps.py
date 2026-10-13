# Per-invoice referral credit caps: percent of pre-tax + max dollars

from decimal import Decimal

import django.core.validators
from django.db import migrations, models


def seed_per_job_caps_for_enabled_programs(apps, schema_editor):
    """Existing enabled programs keep prior “up to full pre-tax” behavior until edited."""
    Organization = apps.get_model('businesses', 'Organization')
    Organization.objects.filter(referral_rewards_enabled=True).update(
        referral_max_credit_percent_per_job=Decimal('100.00'),
        referral_max_credit_amount_per_job=Decimal('100000.00'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0027_alter_organization_concurrent_capacity'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='referral_max_credit_percent_per_job',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('100.00'),
                help_text='Max share of an invoice pre-tax subtotal that referral credit may cover (0–100).',
                max_digits=5,
                validators=[
                    django.core.validators.MinValueValidator(Decimal('0.00')),
                    django.core.validators.MaxValueValidator(Decimal('100.00')),
                ],
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='referral_max_credit_amount_per_job',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Max referral credit dollars applied on a single invoice.',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        migrations.RunPython(
            seed_per_job_caps_for_enabled_programs,
            migrations.RunPython.noop,
        ),
    ]
