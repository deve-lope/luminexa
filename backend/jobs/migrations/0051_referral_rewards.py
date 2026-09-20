# Generated manually for referral codes, referrals, coupons, and invoice.discount

from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0026_organization_referral_rewards'),
        ('jobs', '0050_subscription_ending_reminders'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='discount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Referral coupon credit applied to this invoice (pre-tax).',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        migrations.CreateModel(
            name='ReferralCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=16, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referral_codes',
                    to='businesses.organization',
                )),
                ('referrer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referral_codes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='Referral',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending completion'),
                        ('rewarded', 'Rewarded'),
                        ('capped', 'Cap reached'),
                        ('invalid', 'Invalid'),
                    ],
                    db_index=True,
                    default='pending',
                    max_length=16,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('rewarded_at', models.DateTimeField(blank=True, null=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referrals',
                    to='businesses.organization',
                )),
                ('qualifying_booking', models.ForeignKey(
                    blank=True,
                    help_text='First completed booking by the referred customer that unlocked the reward.',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='qualified_referrals',
                    to='jobs.booking',
                )),
                ('referral_code', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referrals',
                    to='jobs.referralcode',
                )),
                ('referred_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referrals_received',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('referrer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referrals_made',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='ReferralCoupon',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(
                    decimal_places=2,
                    help_text='Original grant amount.',
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                )),
                ('remaining', models.DecimalField(
                    decimal_places=2,
                    help_text='Unused credit still available.',
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
                )),
                ('status', models.CharField(
                    choices=[
                        ('available', 'Available'),
                        ('applied', 'Fully applied'),
                    ],
                    db_index=True,
                    default='available',
                    max_length=16,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('last_applied_invoice', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referral_coupons_applied',
                    to='jobs.invoice',
                )),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referral_coupons',
                    to='businesses.organization',
                )),
                ('owner', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referral_coupons',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('referral', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='coupon',
                    to='jobs.referral',
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='referralcode',
            constraint=models.UniqueConstraint(
                fields=('organization', 'referrer'),
                name='uniq_referral_code_per_org_referrer',
            ),
        ),
        migrations.AddConstraint(
            model_name='referral',
            constraint=models.UniqueConstraint(
                fields=('organization', 'referred_user'),
                name='uniq_referral_per_org_referred_user',
            ),
        ),
    ]
