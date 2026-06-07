from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0004_organizationgalleryimage'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='scheduling_mode',
            field=models.CharField(
                choices=[('recurring', 'Weekly schedule (auto slots)'), ('flexi', 'Flexi (open slots manually)')],
                default='flexi',
                max_length=20,
            ),
        ),
    ]
