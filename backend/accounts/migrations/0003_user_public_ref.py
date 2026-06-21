from django.db import migrations, models


def backfill_user_public_refs(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    import re

    refs = list(
        User.objects.exclude(public_ref__isnull=True)
        .exclude(public_ref='')
        .values_list('public_ref', flat=True)
    )
    max_n = 0
    for ref in refs:
        m = re.fullmatch(r'cus(\d+)', ref or '')
        if m:
            max_n = max(max_n, int(m.group(1)))

    qs = User.objects.filter(public_ref__isnull=True) | User.objects.filter(public_ref='')
    for user in qs.order_by('id'):
        max_n += 1
        user.public_ref = f'cus{max_n}'
        user.save(update_fields=['public_ref'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='public_ref',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Customer account ID, e.g. cus1, cus2',
                max_length=16,
                null=True,
            ),
        ),
        migrations.RunPython(backfill_user_public_refs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='public_ref',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Customer account ID, e.g. cus1, cus2',
                max_length=16,
                unique=True,
            ),
        ),
    ]
