from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0017_organizationlocation'),
    ]

    operations = [
        migrations.AlterField(
            model_name='organization',
            name='booking_policy',
            field=models.CharField(
                choices=[
                    ('instant', 'Open — instant confirmation'),
                    ('approval', 'Open — requires approval'),
                    ('clients_only', 'By invitation only — approved customers'),
                    ('quote', 'Quote before confirm — price then accept'),
                ],
                default='approval',
                max_length=20,
            ),
        ),
    ]
