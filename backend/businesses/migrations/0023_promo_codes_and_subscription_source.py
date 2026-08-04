# Generated manually for promo codes + subscription_source

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0022_organization_quickbooks'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='subscription_source',
            field=models.CharField(
                blank=True,
                default='none',
                help_text='none | stripe | promo — how Pro access was granted',
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name='PromoCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(
                    db_index=True,
                    help_text='Stored uppercase. Providers enter case-insensitively.',
                    max_length=64,
                    unique=True,
                )),
                ('grant_weeks', models.PositiveIntegerField(
                    help_text='Weeks of Pro access granted on each successful redemption.',
                )),
                ('valid_from', models.DateTimeField(
                    blank=True,
                    help_text='If set, code cannot be redeemed before this time.',
                    null=True,
                )),
                ('valid_until', models.DateTimeField(
                    blank=True,
                    help_text='If set, code cannot be redeemed after this time.',
                    null=True,
                )),
                ('max_redemptions', models.PositiveIntegerField(
                    blank=True,
                    help_text='Optional cap on total redemptions. Blank = unlimited.',
                    null=True,
                )),
                ('is_active', models.BooleanField(default=True)),
                ('note', models.CharField(
                    blank=True,
                    default='',
                    help_text='Internal memo for admins.',
                    max_length=255,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='promo_codes_created',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PromoRedemption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('granted_until', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='promo_redemptions',
                    to='businesses.organization',
                )),
                ('promo_code', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='redemptions',
                    to='businesses.promocode',
                )),
                ('redeemed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='promo_redemptions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('promo_code', 'organization'),
                        name='uniq_promo_redemption_per_org',
                    ),
                ],
            },
        ),
    ]
