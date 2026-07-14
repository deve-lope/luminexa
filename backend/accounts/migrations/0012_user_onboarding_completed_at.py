from django.db import migrations, models
from django.utils import timezone


def backfill_onboarding(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    now = timezone.now()
    for user in User.objects.all().iterator():
        has_name = bool((user.full_name or '').strip())
        has_phone = bool((user.phone or '').strip())
        if has_name and has_phone:
            user.onboarding_completed_at = now
            user.save(update_fields=['onboarding_completed_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_rename_accounts_lo_email_cons_idx_accounts_lo_email_489e27_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='onboarding_completed_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Set when the user finishes first-sign-in profile setup.',
                null=True,
            ),
        ),
        migrations.RunPython(backfill_onboarding, migrations.RunPython.noop),
    ]
