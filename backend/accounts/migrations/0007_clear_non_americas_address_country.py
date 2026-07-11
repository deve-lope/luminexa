from django.db import migrations


def clear_non_americas_countries(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    supported = {
        'canada', 'united states', 'mexico', 'belize', 'costa rica', 'el salvador',
        'guatemala', 'honduras', 'nicaragua', 'panama', 'antigua and barbuda', 'bahamas',
        'barbados', 'cuba', 'dominica', 'dominican republic', 'grenada', 'haiti', 'jamaica',
        'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines',
        'trinidad and tobago', 'argentina', 'bolivia', 'brazil', 'chile', 'colombia',
        'ecuador', 'guyana', 'paraguay', 'peru', 'suriname', 'uruguay', 'venezuela',
    }
    for user in User.objects.exclude(address_country='').iterator():
        if user.address_country.strip().lower() not in supported:
            user.address_country = ''
            user.save(update_fields=['address_country'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_user_address_country'),
    ]

    operations = [
        migrations.RunPython(clear_non_americas_countries, migrations.RunPython.noop),
    ]
