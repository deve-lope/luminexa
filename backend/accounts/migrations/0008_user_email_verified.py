from django.db import migrations, models


def mark_existing_users_verified(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.all().update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_clear_non_americas_address_country'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verified',
            field=models.BooleanField(
                default=False,
                help_text='True after the user confirms their email address.',
            ),
        ),
        migrations.RunPython(mark_existing_users_verified, migrations.RunPython.noop),
    ]
