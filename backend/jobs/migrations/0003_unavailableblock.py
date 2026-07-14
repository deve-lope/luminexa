from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0006_organization_schedule_dates'),
        ('jobs', '0002_weekly_schedule_notifications'),
    ]

    operations = [
        migrations.CreateModel(
            name='UnavailableBlock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_at', models.DateTimeField()),
                ('end_at', models.DateTimeField()),
                ('note', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='unavailable_blocks_created',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='unavailable_blocks',
                    to='businesses.organization',
                )),
            ],
            options={
                'ordering': ['start_at'],
                'indexes': [models.Index(fields=['organization', 'start_at'], name='jobs_unavail_org_start_idx')],
            },
        ),
    ]
