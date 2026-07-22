from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_onboarding_completed_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='deleted_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Set when the account is deleted / anonymized on user request.',
                null=True,
            ),
        ),
    ]
