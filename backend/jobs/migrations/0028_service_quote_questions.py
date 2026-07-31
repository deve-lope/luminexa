from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0027_quote_followup_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='service',
            name='quote_questions',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'Template questions for quote-priced services (list of strings). '
                    'Customers answer these when requesting; providers can edit on the quote.'
                ),
            ),
        ),
    ]
