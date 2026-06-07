import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0007_organization_service_location'),
        ('jobs', '0008_service_show_price'),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='service_categories',
                        to='businesses.organization',
                    ),
                ),
            ],
            options={
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='servicecategory',
            constraint=models.UniqueConstraint(
                fields=('organization', 'name'),
                name='uniq_service_category_name_per_org',
            ),
        ),
        migrations.AddField(
            model_name='service',
            name='pricing_type',
            field=models.CharField(
                choices=[('fixed', 'Fixed price'), ('range', 'Price range'), ('quote', 'Quote on request')],
                default='fixed',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='service',
            name='price_max',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Upper bound when pricing_type is range.',
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        migrations.AddField(
            model_name='service',
            name='allow_request',
            field=models.BooleanField(
                default=True,
                help_text='Customers can send a service request for this item.',
            ),
        ),
        migrations.AddField(
            model_name='service',
            name='category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='services',
                to='jobs.servicecategory',
            ),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='service',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inquiries',
                to='jobs.service',
            ),
        ),
    ]
