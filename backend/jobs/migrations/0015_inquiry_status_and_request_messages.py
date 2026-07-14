from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_dismissed_inquiries(apps, schema_editor):
    CustomerServiceInquiry = apps.get_model('jobs', 'CustomerServiceInquiry')
    CustomerServiceInquiry.objects.filter(dismissed_at__isnull=False).update(status='declined')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0014_customerserviceinquiry_preferred_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerserviceinquiry',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('active', 'Active'),
                    ('completed', 'Completed'),
                    ('declined', 'Declined'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_dismissed_inquiries, migrations.RunPython.noop),
        migrations.CreateModel(
            name='ServiceRequestMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('body', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('booking', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='request_messages', to='jobs.booking')),
                ('inquiry', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='request_messages', to='jobs.customerserviceinquiry')),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='service_request_messages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='servicerequestmessage',
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(('booking__isnull', False), ('inquiry__isnull', True)),
                    models.Q(('booking__isnull', True), ('inquiry__isnull', False)),
                    _connector='OR',
                ),
                name='service_request_message_one_target',
            ),
        ),
    ]
