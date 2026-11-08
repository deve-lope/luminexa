import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import RebookReminderFields, { formatDisplayDate } from './RebookReminderFields';

/**
 * Post-complete panel: view / set / cancel a pending rebook reminder.
 */
export default function RebookReminderPanel({ booking, onUpdated }) {
  const canSchedule = Boolean(
    booking?.id &&
      booking?.service &&
      !(booking?.job_title || '').trim() &&
      booking?.service_name !== 'Custom job' &&
      booking?.status === 'completed',
  );

  const existing = booking?.rebook_reminder;
  const isPending = existing?.status === 'pending';
  const [editing, setEditing] = useState(!isPending);
  const [remindOn, setRemindOn] = useState(existing?.remind_on || '');
  const [note, setNote] = useState(existing?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setRemindOn(existing?.remind_on || '');
    setNote(existing?.note || '');
    setEditing(!isPending);
    setError('');
    setMessage('');
  }, [booking?.id, existing?.remind_on, existing?.note, existing?.status, isPending]);

  if (!canSchedule) return null;

  const save = async () => {
    if (!remindOn) {
      setError('Choose a reminder date.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await jobsAPI.setBookingRebookReminder(booking.id, {
        remind_on: remindOn,
        note: note.trim(),
      });
      setMessage('Rebook reminder saved.');
      setEditing(false);
      onUpdated?.(res.data);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await jobsAPI.cancelBookingRebookReminder(booking.id);
      setMessage('Rebook reminder cancelled.');
      setEditing(true);
      setRemindOn('');
      setNote('');
      onUpdated?.(res.data);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Rebook reminder</h2>
      <p className="mt-1 text-sm text-slate-600">
        Nudge this customer to book again on a date you choose (in-app, push, and email).
      </p>

      {isPending && !editing ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-800">
            Scheduled for <span className="font-semibold">{formatDisplayDate(existing.remind_on)}</span>
            {existing.note ? (
              <span className="mt-1 block text-slate-600">“{existing.note}”</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Change date
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="min-h-[44px] rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              Cancel reminder
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {existing?.status === 'sent' && (
            <p className="text-sm text-slate-600">
              Reminder already sent
              {existing.sent_at ? ` on ${formatDisplayDate(String(existing.sent_at).slice(0, 10))}` : ''}.
              You can schedule another date below.
            </p>
          )}
          {existing?.status === 'skipped' && (
            <p className="text-sm text-slate-600">
              Skipped — this customer already booked the same service again. You can set a new date.
            </p>
          )}
          <RebookReminderFields
            enabled
            showToggle={false}
            onEnabledChange={() => {}}
            remindOn={remindOn}
            onRemindOnChange={setRemindOn}
            note={note}
            onNoteChange={setNote}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="min-h-[44px] rounded-xl bg-luminexa-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save reminder'}
            </button>
            {isPending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setRemindOn(existing.remind_on || '');
                  setNote(existing.note || '');
                  setError('');
                }}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Back
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-2 text-sm text-teal-700">{message}</p>}
    </section>
  );
}
