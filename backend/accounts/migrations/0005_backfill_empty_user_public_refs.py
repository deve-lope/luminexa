import re

from django.db import migrations

_USER_REF_RE = re.compile(r'^cus(\d+)$')


def backfill_empty_user_public_refs(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    refs = (
        User.objects.exclude(public_ref='')
        .values_list('public_ref', flat=True)
    )
    max_n = 0
    for ref in refs:
        m = _USER_REF_RE.fullmatch(ref or '')
        if m:
            max_n = max(max_n, int(m.group(1)))
    for user in User.objects.filter(public_ref=''):
        max_n += 1
        user.public_ref = f'cus{max_n}'
        user.save(update_fields=['public_ref'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_default_service_address'),
    ]

    operations = [
        migrations.RunPython(backfill_empty_user_public_refs, migrations.RunPython.noop),
    ]
