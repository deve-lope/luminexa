import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0010_booking_reminder_sent_at'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BookingStatusEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('created', 'Created'), ('accepted', 'Accepted'), ('declined', 'Declined'), ('cancelled', 'Cancelled'), ('completed', 'Completed'), ('rescheduled', 'Rescheduled'), ('no_show', 'No-show')], max_length=20)),
                ('old_status', models.CharField(blank=True, default='', max_length=20)),
                ('new_status', models.CharField(blank=True, default='', max_length=20)),
                ('note', models.CharField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='booking_status_events', to=settings.AUTH_USER_MODEL)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_events', to='jobs.booking')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
