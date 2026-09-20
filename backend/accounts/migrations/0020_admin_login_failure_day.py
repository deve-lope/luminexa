# Generated manually for AdminLoginFailureDay

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_provider_trial_once_per_email'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminLoginFailureDay',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, max_length=320)),
                ('day', models.DateField(db_index=True)),
                ('fail_count', models.PositiveSmallIntegerField(default=0)),
                ('alert_sent_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-day', '-updated_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='adminloginfailureday',
            constraint=models.UniqueConstraint(
                fields=('key', 'day'),
                name='uniq_admin_login_failure_key_day',
            ),
        ),
    ]
