import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';

const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const DEFAULT_BLOCK = { weekday: 0, start_time: '08:00', end_time: '16:00', is_active: true };

export default function ProviderSchedulingPanel({ orgSlug, onModeChange }) {
  const [mode, setMode] = useState('flexi');
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    try {
      const ctx = await jobsAPI.getBookingContext(orgSlug);
      const m = ctx.data?.scheduling_mode || 'flexi';
      setMode(m);
      onModeChange?.(m);
      if (m === 'recurring') {
        const res = await jobsAPI.getWeeklySchedule(orgSlug);
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length) {
          setBlocks(
            list.map((b) => ({
              weekday: b.weekday,
              start_time: b.start_time?.slice(0, 5) || '08:00',
              end_time: b.end_time?.slice(0, 5) || '16:00',
              is_active: b.is_active,
            }))
          );
        } else {
          setBlocks(
            [0, 1, 2, 3, 4].map((d) => ({ ...DEFAULT_BLOCK, weekday: d }))
          );
        }
      }
    } catch {
      setError('Could not load scheduling settings.');
    }
  }, [orgSlug, onModeChange]);

  useEffect(() => {
    load();
  }, [load]);

  const setSchedulingMode = async (newMode) => {
    setSaving(true);
    setError(null);
    try {
      await jobsAPI.patchOrganization(orgSlug, { scheduling_mode: newMode });
      setMode(newMode);
      onModeChange?.(newMode);
      if (newMode === 'recurring') {
        if (!blocks.length) {
          setBlocks([0, 1, 2, 3, 4].map((d) => ({ ...DEFAULT_BLOCK, weekday: d })));
        }
        await saveWeekly(false);
      }
      setMessage(
        newMode === 'recurring'
          ? 'Weekly schedule mode — slots are generated automatically.'
          : 'Flexi mode — add open slots manually when you are available.'
      );
    } catch {
      setError('Could not update scheduling mode.');
    } finally {
      setSaving(false);
    }
  };

  const saveWeekly = async (showMsg = true) => {
    setSaving(true);
    setError(null);
    try {
      const payload = blocks
        .filter((b) => b.is_active)
        .map((b) => ({
          weekday: b.weekday,
          start_time: b.start_time.length === 5 ? `${b.start_time}:00` : b.start_time,
          end_time: b.end_time.length === 5 ? `${b.end_time}:00` : b.end_time,
          is_active: true,
        }));
      await jobsAPI.saveWeeklySchedule(orgSlug, payload);
      const sync = await jobsAPI.syncRecurringSlots(orgSlug);
      if (showMsg) {
        setMessage(`Schedule saved. ${sync.data?.created ?? 0} new slots generated.`);
      }
    } catch {
      setError('Could not save weekly schedule.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (weekday) => {
    const existing = blocks.find((b) => b.weekday === weekday);
    if (existing) {
      setBlocks(blocks.filter((b) => b.weekday !== weekday));
    } else {
      setBlocks([...blocks, { ...DEFAULT_BLOCK, weekday }].sort((a, b) => a.weekday - b.weekday));
    }
  };

  const updateBlockTime = (weekday, field, value) => {
    setBlocks(
      blocks.map((b) => (b.weekday === weekday ? { ...b, [field]: value } : b))
    );
  };

  const isDayActive = (weekday) => blocks.some((b) => b.weekday === weekday);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Availability mode</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose how customers see bookable times.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setSchedulingMode('recurring')}
          className={`min-h-[52px] rounded-xl border-2 p-3 text-left text-sm transition ${
            mode === 'recurring'
              ? 'border-luminexa-accent bg-violet-50'
              : 'border-slate-200'
          }`}
        >
          <span className="font-semibold text-slate-900">Weekly schedule</span>
          <span className="mt-0.5 block text-xs text-slate-600">Mon–Fri 8–4 style hours, auto slots</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setSchedulingMode('flexi')}
          className={`min-h-[52px] rounded-xl border-2 p-3 text-left text-sm transition ${
            mode === 'flexi'
              ? 'border-luminexa-accent bg-violet-50'
              : 'border-slate-200'
          }`}
        >
          <span className="font-semibold text-slate-900">Flexi</span>
          <span className="mt-0.5 block text-xs text-slate-600">You open slots manually</span>
        </button>
      </div>

      {mode === 'recurring' && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Active days generate bookable slots for each service (using service duration).
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`min-h-[40px] min-w-[48px] rounded-lg text-sm font-medium ${
                  isDayActive(d.value)
                    ? 'bg-luminexa-accent text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {blocks.map((b) => (
            <div key={b.weekday} className="flex items-center gap-2 text-sm">
              <span className="w-10 font-medium text-slate-700">
                {WEEKDAYS.find((d) => d.value === b.weekday)?.label}
              </span>
              <input
                type="time"
                value={b.start_time}
                onChange={(e) => updateBlockTime(b.weekday, 'start_time', e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2"
              />
              <span className="text-slate-400">to</span>
              <input
                type="time"
                value={b.end_time}
                onChange={(e) => updateBlockTime(b.weekday, 'end_time', e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={saving || !blocks.length}
            onClick={() => saveWeekly(true)}
            className="w-full min-h-[44px] rounded-lg bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & generate slots'}
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
