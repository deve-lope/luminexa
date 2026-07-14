from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0014_businesstype_location_kind'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='cancel_cutoff_hours',
            field=models.PositiveIntegerField(
                default=24,
                help_text=(
                    'Customers cannot cancel confirmed bookings within this many hours of start. '
                    '0 = no cutoff (cancel anytime before start).'
                ),
            ),
        ),
        migrations.AlterField(
            model_name='organizationmembership',
            name='customer_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('pending', 'Pending approval'),
                    ('approved', 'Approved'),
                    ('blocked', 'Blocked'),
                ],
                default='',
                max_length=20,
            ),
        ),
    ]
