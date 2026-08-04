# Generated manually for ProviderDeletionFeedback

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_user_deleted_at'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProviderDeletionFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(choices=[('too_expensive', 'Too expensive / not worth the price'), ('not_enough_customers', 'Not enough customers or bookings'), ('switching_tool', 'Switching to another tool'), ('business_closed', 'Business closed or pausing'), ('missing_features', 'Missing features I need'), ('hard_to_use', 'Too hard to use'), ('didnt_need_pro', 'Didn’t need Pro / trial was enough'), ('temporary', 'Temporary — may come back'), ('other', 'Other')], max_length=40)),
                ('detail', models.TextField(blank=True, default='', max_length=2000)),
                ('channel', models.CharField(choices=[('in_app', 'In-app account page'), ('public_link', 'Public deletion link')], default='in_app', max_length=20)),
                ('user_id_snapshot', models.PositiveIntegerField(help_text='User pk at deletion time (row may later be anonymized).')),
                ('was_owner', models.BooleanField(default=False)),
                ('had_active_subscription', models.BooleanField(default=False)),
                ('subscription_status', models.CharField(blank=True, default='', max_length=32)),
                ('subscription_plan', models.CharField(blank=True, default='', max_length=32)),
                ('subscription_source', models.CharField(blank=True, default='', max_length=32)),
                ('organization_slug', models.CharField(blank=True, default='', max_length=120)),
                ('organization_name', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['-created_at'], name='accounts_pr_created_7c2f8a_idx'),
                    models.Index(fields=['reason'], name='accounts_pr_reason_8b1e4d_idx'),
                ],
            },
        ),
    ]
