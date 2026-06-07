from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='booking_policy',
            field=models.CharField(
                choices=[
                    ('instant', 'Open — instant confirmation'),
                    ('approval', 'Open — requires approval'),
                    ('clients_only', 'Clients only — approved customers'),
                ],
                default='approval',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='organizationmembership',
            name='customer_status',
            field=models.CharField(
                blank=True,
                choices=[('pending', 'Pending approval'), ('approved', 'Approved')],
                default='',
                max_length=20,
            ),
        ),
    ]
