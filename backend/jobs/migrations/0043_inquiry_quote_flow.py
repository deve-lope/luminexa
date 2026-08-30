from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0042_service_always_show_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='quote_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Provider quote amount awaiting customer acceptance.',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='quote_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='quoted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='quote_accepted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='booking',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='source_inquiry',
                to='jobs.booking',
            ),
        ),
        migrations.AlterField(
            model_name='customerserviceinquiry',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('active', 'Active'),
                    ('quoted', 'Quote sent'),
                    ('quote_accepted', 'Quote accepted'),
                    ('completed', 'Completed'),
                    ('declined', 'Declined'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
