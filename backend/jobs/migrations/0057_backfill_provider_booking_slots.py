from django.db import migrations


ACTIVE = ('requested', 'confirmed', 'in_progress', 'needs_return', 'quoted')


def backfill_slots(apps, schema_editor):
    """Attach AvailabilitySlots to active bookings that were created without one."""
    Booking = apps.get_model('jobs', 'Booking')
    AvailabilitySlot = apps.get_model('jobs', 'AvailabilitySlot')

    qs = (
        Booking.objects.filter(
            availability_slot__isnull=True,
            status__in=ACTIVE,
        )
        .exclude(start_at__isnull=True)
        .exclude(end_at__isnull=True)
        .iterator()
    )
    for booking in qs:
        if booking.start_at >= booking.end_at:
            continue
        slot = AvailabilitySlot.objects.create(
            organization_id=booking.organization_id,
            service_id=booking.service_id,
            start_at=booking.start_at,
            end_at=booking.end_at,
            status='booked' if booking.status in (
                'confirmed', 'in_progress', 'needs_return',
            ) else 'pending',
        )
        booking.availability_slot_id = slot.id
        booking.save(update_fields=['availability_slot_id'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0056_task_due_reminder'),
    ]

    operations = [
        migrations.RunPython(backfill_slots, noop_reverse),
    ]
