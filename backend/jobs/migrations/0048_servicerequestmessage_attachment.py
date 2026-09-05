from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0047_booking_reminder_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicerequestmessage',
            name='attachment',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='chat/attachments/%Y/%m/',
            ),
        ),
    ]
