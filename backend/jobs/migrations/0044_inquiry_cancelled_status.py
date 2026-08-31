from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0043_inquiry_quote_flow'),
    ]

    operations = [
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
                    ('cancelled', 'Cancelled'),
                    ('declined', 'Declined'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
