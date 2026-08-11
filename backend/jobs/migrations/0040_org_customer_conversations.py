# Generated manually for org↔customer conversations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_conversations(apps, schema_editor):
    OrgCustomerConversation = apps.get_model('jobs', 'OrgCustomerConversation')
    ServiceRequestMessage = apps.get_model('jobs', 'ServiceRequestMessage')
    Booking = apps.get_model('jobs', 'Booking')
    CustomerServiceInquiry = apps.get_model('jobs', 'CustomerServiceInquiry')

    # Pair (org_id, customer_id) → conversation
    cache = {}

    def get_conv(org_id, customer_id, *, customer_read=None, provider_read=None):
        key = (org_id, customer_id)
        conv = cache.get(key)
        if conv is None:
            conv, _ = OrgCustomerConversation.objects.get_or_create(
                organization_id=org_id,
                customer_id=customer_id,
            )
            cache[key] = conv
        updates = []
        if customer_read and (
            conv.customer_messages_read_at is None
            or customer_read > conv.customer_messages_read_at
        ):
            conv.customer_messages_read_at = customer_read
            updates.append('customer_messages_read_at')
        if provider_read and (
            conv.provider_messages_read_at is None
            or provider_read > conv.provider_messages_read_at
        ):
            conv.provider_messages_read_at = provider_read
            updates.append('provider_messages_read_at')
        if updates:
            conv.save(update_fields=updates)
        return conv

    for msg in ServiceRequestMessage.objects.select_related('booking', 'inquiry').iterator():
        if msg.booking_id:
            b = msg.booking
            conv = get_conv(
                b.organization_id,
                b.customer_id,
                customer_read=b.customer_messages_read_at,
                provider_read=b.provider_messages_read_at,
            )
        elif msg.inquiry_id:
            iq = msg.inquiry
            conv = get_conv(
                iq.organization_id,
                iq.customer_id,
                customer_read=iq.customer_messages_read_at,
                provider_read=iq.provider_messages_read_at,
            )
        else:
            continue
        if msg.conversation_id != conv.id:
            msg.conversation_id = conv.id
            msg.save(update_fields=['conversation_id'])

    # Ensure conversations exist for bookings/inquiries that never had messages yet
    # (cards will be created at runtime on next open/create).


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0039_quote_clarification_flow'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrgCustomerConversation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('customer_messages_read_at', models.DateTimeField(blank=True, help_text='When the customer last opened this conversation.', null=True)),
                ('provider_messages_read_at', models.DateTimeField(blank=True, help_text='When provider staff last opened this conversation.', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='provider_conversations', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customer_conversations', to='businesses.organization')),
            ],
        ),
        migrations.AddField(
            model_name='servicerequestmessage',
            name='conversation',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='jobs.orgcustomerconversation'),
        ),
        migrations.AddField(
            model_name='servicerequestmessage',
            name='kind',
            field=models.CharField(choices=[('text', 'Text'), ('booking_card', 'Booking card'), ('inquiry_card', 'Inquiry card'), ('system', 'System')], default='text', max_length=20),
        ),
        migrations.AddField(
            model_name='servicerequestmessage',
            name='meta',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='servicerequestmessage',
            name='body',
            field=models.TextField(blank=True),
        ),
        migrations.RemoveConstraint(
            model_name='servicerequestmessage',
            name='service_request_message_one_target',
        ),
        migrations.AddConstraint(
            model_name='servicerequestmessage',
            constraint=models.CheckConstraint(
                check=~(models.Q(('booking__isnull', False), ('inquiry__isnull', False))),
                name='service_request_message_not_both_targets',
            ),
        ),
        migrations.AddConstraint(
            model_name='orgcustomerconversation',
            constraint=models.UniqueConstraint(fields=('organization', 'customer'), name='uniq_org_customer_conversation'),
        ),
        migrations.AddIndex(
            model_name='orgcustomerconversation',
            index=models.Index(fields=['organization', '-updated_at'], name='jobs_orgcus_organiz_7f0c1a_idx'),
        ),
        migrations.AddIndex(
            model_name='orgcustomerconversation',
            index=models.Index(fields=['customer', '-updated_at'], name='jobs_orgcus_custome_4a2e11_idx'),
        ),
        migrations.RunPython(backfill_conversations, noop_reverse),
    ]
