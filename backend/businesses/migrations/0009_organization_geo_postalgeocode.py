from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0008_organization_service_postal_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='service_latitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Geocoded from postal code for radius search',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='service_longitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Geocoded from postal code for radius search',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.CreateModel(
            name='PostalGeocode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lookup_key', models.CharField(db_index=True, max_length=160, unique=True)),
                ('postal_code', models.CharField(db_index=True, max_length=12)),
                ('city', models.CharField(blank=True, default='', max_length=120)),
                ('state', models.CharField(blank=True, default='', max_length=80)),
                ('country', models.CharField(blank=True, default='', max_length=80)),
                ('latitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('longitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('source', models.CharField(default='nominatim', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['postal_code'],
            },
        ),
    ]
