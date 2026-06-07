import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0007_organization_service_location'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0004_booking_service_address'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerServiceInquiry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('service_label', models.CharField(blank=True, default='', help_text='Short label, e.g. Plumbing, Interior car wash', max_length=200)),
                ('message', models.TextField()),
                ('service_address', models.TextField(blank=True, default='')),
                ('dismissed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='service_inquiries', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='service_inquiries', to='businesses.organization')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['organization', 'dismissed_at', '-created_at'], name='jobs_custom_organiz_8f3c2a_idx')],
            },
        ),
    ]
