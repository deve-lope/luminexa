from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0005_customerserviceinquiry'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='recurrence',
            field=models.CharField(
                choices=[
                    ('none', 'One-time'),
                    ('daily', 'Daily'),
                    ('weekly', 'Weekly'),
                    ('monthly', 'Monthly'),
                ],
                default='none',
                max_length=10,
            ),
        ),
    ]
