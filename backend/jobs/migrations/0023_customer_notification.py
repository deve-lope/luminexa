from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0014_businesstype_location_kind'),
        ('jobs', '0022_service_fulfillment_kind'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('booking_confirmed', 'Booking confirmed'), ('booking_declined', 'Booking declined'), ('booking_cancelled', 'Booking cancelled'), ('booking_rescheduled', 'Booking rescheduled'), ('booking_completed', 'Booking completed'), ('invoice_ready', 'Invoice ready')], max_length=40)),
                ('title', models.CharField(max_length=200)),
                ('message', models.CharField(max_length=500)),
                ('link_path', models.CharField(blank=True, default='', max_length=300)),
                ('dismissed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('booking', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customer_notifications', to='jobs.booking')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customer_notifications', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='customer_notifications', to='businesses.organization')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='customernotification',
            index=models.Index(fields=['customer', 'dismissed_at', '-created_at'], name='jobs_custom_custome_7c8a1d_idx'),
        ),
    ]
