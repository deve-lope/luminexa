from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0007_delete_checklistitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='service',
            name='show_price',
            field=models.BooleanField(
                default=True,
                help_text='When off, price is hidden on the public booking profile.',
            ),
        ),
    ]
