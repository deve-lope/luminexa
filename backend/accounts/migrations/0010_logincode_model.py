from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_logincode'),
    ]

    operations = [
        migrations.CreateModel(
            name='LoginCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254)),
                ('code_hash', models.CharField(max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('attempt_count', models.PositiveSmallIntegerField(default=0)),
                ('consumed_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['email', 'consumed_at'], name='accounts_lo_email_cons_idx'),
                ],
            },
        ),
    ]
