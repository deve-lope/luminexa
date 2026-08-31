import React, { useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import { needsAttendancePrompt } from '../../utils/customerBookings';

export default function ProviderAttendancePrompt({ booking, onAnswered, compact = false }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!needsAttendancePrompt(booking)) return null;

  const submit = async (showedUp) => {
    setBusy(true);
    try {
      const res = await jobsAPI.reportBookingAttendance(booking.id, { showed_up: showedUp });
      showToast(
        showedUp ? 'Thanks for confirming.' : 'We notified the business.',
        'success',
      );
      onAnswered?.(res.data);
    } catch (err) {
      showToast(parseApiError(err, 'Could not save your response.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const orgName = booking.organization_name || 'the provider';

  if (compact) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
        <p className="text-sm font-semibold text-slate-900">Did {orgName} show up?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(true)}
            className="lx-btn-primary min-h-[40px] px-4 text-sm"
          >
            Yes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="lx-btn-secondary min-h-[40px] px-4 text-sm"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm ring-1 ring-amber-100"
      aria-label="Provider attendance"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800">
        After your appointment
      </p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">Did the provider show up?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your scheduled time with {orgName} has ended. Let us know whether they arrived.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(true)}
          className="lx-btn-primary min-h-[48px] px-6"
        >
          Yes, they showed up
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(false)}
          className="lx-btn-secondary min-h-[48px] px-6"
        >
          No, they did not
        </button>
      </div>
    </section>
  );
}
