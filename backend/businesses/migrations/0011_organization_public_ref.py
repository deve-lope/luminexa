from django.db import migrations, models


def backfill_organization_public_refs(apps, schema_editor):
    Organization = apps.get_model('businesses', 'Organization')
    import re

    refs = list(
        Organization.objects.exclude(public_ref__isnull=True)
        .exclude(public_ref='')
        .values_list('public_ref', flat=True)
    )
    max_n = 0
    for ref in refs:
        m = re.fullmatch(r'pro(\d+)', ref or '')
        if m:
            max_n = max(max_n, int(m.group(1)))

    qs = Organization.objects.filter(public_ref__isnull=True) | Organization.objects.filter(
        public_ref=''
    )
    for org in qs.order_by('id'):
        max_n += 1
        org.public_ref = f'pro{max_n}'
        org.save(update_fields=['public_ref'])


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0010_staffinvitation'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='public_ref',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Customer-facing ID, e.g. pro1, pro2',
                max_length=16,
                null=True,
            ),
        ),
        migrations.RunPython(backfill_organization_public_refs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='organization',
            name='public_ref',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Customer-facing ID, e.g. pro1, pro2',
                max_length=16,
                unique=True,
            ),
        ),
    ]
