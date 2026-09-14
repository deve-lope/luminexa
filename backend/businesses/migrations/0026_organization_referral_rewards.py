# Generated manually for referral reward settings on Organization

from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0025_subscription_ending_reminders'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='referral_rewards_enabled',
            field=models.BooleanField(
                default=False,
                help_text='When on, customers can share a code and earn coupon credit after a referred job is completed.',
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='referral_reward_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Coupon credit granted per successful referral (referred customer completes a job).',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='referral_max_earnings_per_referrer',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Lifetime coupon credit one customer can earn from referrals at this business.',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
    ]
