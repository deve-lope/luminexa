from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0006_task_recurrence'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ChecklistItem',
        ),
    ]
