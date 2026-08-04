# Generated manually for provider books / job costing

from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0034_customer_notification_inquiry'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='last_payment_reminder_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='payment_reminder_count',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='JobCostLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(
                    choices=[('material', 'Material'), ('labor', 'Labor'), ('expense', 'Expense')],
                    default='expense',
                    max_length=16,
                )),
                ('description', models.CharField(max_length=255)),
                ('quantity', models.DecimalField(
                    decimal_places=2,
                    default=Decimal('1.00'),
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                )),
                ('unit_cost', models.DecimalField(
                    decimal_places=2,
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('booking', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='cost_lines',
                    to='jobs.booking',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='job_cost_lines_created',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['id'],
            },
        ),
    ]
