from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0005_organization_scheduling_mode'),
        ('jobs', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WeeklyScheduleBlock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('weekday', models.PositiveSmallIntegerField(help_text='0=Monday … 6=Sunday (Python weekday)')),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='weekly_schedule_blocks', to='businesses.organization')),
            ],
            options={
                'ordering': ['weekday', 'start_time'],
            },
        ),
        migrations.CreateModel(
            name='ProviderNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('flexi_no_slots_next_week', 'No slots open next week')], max_length=40)),
                ('message', models.CharField(max_length=500)),
                ('week_start', models.DateField(blank=True, null=True)),
                ('dismissed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='provider_notifications', to='businesses.organization')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='weeklyscheduleblock',
            constraint=models.UniqueConstraint(fields=('organization', 'weekday', 'start_time', 'end_time'), name='uniq_weekly_block'),
        ),
        migrations.AddIndex(
            model_name='providernotification',
            index=models.Index(fields=['organization', 'kind', 'week_start'], name='jobs_provid_organiz_8e0f0d_idx'),
        ),
    ]
