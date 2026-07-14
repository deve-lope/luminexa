"""Recurring task rollover and dashboard refresh."""

import calendar
from datetime import timedelta

from django.utils import timezone

from .models import Task


def _add_months(dt, months: int):
    """Advance datetime by N calendar months (keeps time-of-day)."""
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


def advance_due_at(due_at, recurrence: str):
    if recurrence == Task.Recurrence.DAILY:
        return due_at + timedelta(days=1)
    if recurrence == Task.Recurrence.WEEKLY:
        return due_at + timedelta(weeks=1)
    if recurrence == Task.Recurrence.MONTHLY:
        return _add_months(due_at, 1)
    return due_at


def refresh_recurring_tasks(organization, *, now=None) -> int:
    """
    Re-open recurring tasks after their due time has passed so they appear again.
    Returns count updated.
    """
    now = now or timezone.now()
    updated = 0
    qs = Task.objects.filter(
        organization=organization,
        is_done=True,
    ).exclude(recurrence=Task.Recurrence.NONE).exclude(due_at__isnull=True)

    for task in qs:
        if now < task.due_at:
            continue
        next_due = task.due_at
        while next_due <= now:
            next_due = advance_due_at(next_due, task.recurrence)
        task.is_done = False
        task.done_at = None
        task.due_at = next_due
        task.save(update_fields=['is_done', 'done_at', 'due_at', 'updated_at'])
        updated += 1
    return updated
