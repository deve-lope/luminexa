# Generated manually for BusinessType.location_kind (office vs mobile).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0013_organization_timezone_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='businesstype',
            name='location_kind',
            field=models.CharField(
                choices=[('office', 'Business office'), ('mobile', 'Mobile service')],
                default='mobile',
                help_text='Office types need a fixed business address for billing; mobile types do not.',
                max_length=16,
            ),
        ),
    ]
