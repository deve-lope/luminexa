import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0012_service_gallery_and_reviews'),
    ]

    operations = [
        migrations.AlterField(
            model_name='availabilityslot',
            name='service',
            field=models.ForeignKey(
                blank=True,
                help_text='When empty, the slot is open for any service.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='availability_slots',
                to='jobs.service',
            ),
        ),
    ]
