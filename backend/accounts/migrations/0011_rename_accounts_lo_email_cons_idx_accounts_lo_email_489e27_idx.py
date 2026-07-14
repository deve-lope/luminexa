from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_logincode_model'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='logincode',
            new_name='accounts_lo_email_489e27_idx',
            old_name='accounts_lo_email_cons_idx',
        ),
    ]
