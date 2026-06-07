import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { providerSchedule } from '../../utils/providerPaths';
import { parseApiError } from '../../utils/taskDisplay';
import { todayKey } from '../../utils/dateRange';

export default function FlexiQuickOpenSlots({ orgSlug, organizationId }) {
  const [day, setDay] = useState(todayKey);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const addSlot = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!organizationId) {
      setError('Organization not loaded.');
      return;
    }
    if (!day || !startTime || !endTime) {
      setError('Pick a date and start/end times.');
      return;
    }
    const start_at = new Date(`${day}T${startTime}`).toISOString();
    const end_at = new Date(`${day}T${endTime}`).toISOString();
    if (new Date(end_at) <= new Date(start_at)) {
      setError('End time must be after start time.');
      return;
    }

    setSubmitting(true);
    try {
      await jobsAPI.createSlot({
        organization: organizationId,
        start_at,
        end_at,
      });
      const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      setMessage(`Open slot added for ${label}, ${startTime}–${endTime}. Customers can book it on Schedule.`);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Flexi mode: add <strong>one date at a time</strong> below, or use{' '}
        <Link to={providerSchedule(orgSlug)} className="font-medium text-luminexa-accent">
          Schedule
        </Link>{' '}
        to drag times on the calendar.
      </p>
      <form onSubmit={addSlot} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          Date
          <input
            type="date"
            value={day}
            min={todayKey()}
            onChange={(e) => setDay(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-slate-600">
            From
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Until
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add open time for this date'}
        </button>
      </form>
    </div>
  );
}
