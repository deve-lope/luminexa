from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0002_booking_policy_customer_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='BusinessType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=80, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('description', models.CharField(blank=True, max_length=400)),
                ('icon', models.CharField(blank=True, help_text='Emoji or short label', max_length=16)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.AddField(
            model_name='organization',
            name='business_types',
            field=models.ManyToManyField(blank=True, related_name='organizations', to='businesses.businesstype'),
        ),
    ]
