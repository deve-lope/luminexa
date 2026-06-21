import React, { useMemo, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

const FALLBACK_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Halifax',
  'America/St_Johns',
  'UTC',
];

export function listTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_TIMEZONES;
}

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export function formatTimezoneLabel(tz) {
  if (!tz) return '';
  return tz.replace(/_/g, ' ');
}

export default function OrganizationTimezoneField({
  orgSlug,
  timezone,
  onTimezoneChange,
  schedulingMode = 'flexi',
  isOwner = true,
  onSaved,
  onError,
}) {
  const [saving, setSaving] = useState(false);

  const tzOptions = useMemo(() => {
    const all = listTimezones();
    return timezone && !all.includes(timezone) ? [timezone, ...all] : all;
  }, [timezone]);

  const detected = detectTimezone();

  const saveTimezone = async (nextTz) => {
    if (!orgSlug || nextTz === timezone) return;
    setSaving(true);
    onError?.(null);
    try {
      await jobsAPI.saveSchedulingSettings(orgSlug, { timezone: nextTz });
      onTimezoneChange?.(nextTz);
      let created = 0;
      if (schedulingMode === 'recurring') {
        const sync = await jobsAPI.syncRecurringSlots(orgSlug);
        created = sync.data?.created ?? 0;
      }
      onSaved?.(
        created
          ? `Timezone updated. ${created} slots regenerated.`
          : 'Timezone updated.'
      );
    } catch (e) {
      onError?.(parseApiError(e) || 'Could not update timezone.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Timezone</h2>
      <p className="mt-1 text-sm text-slate-600">
        Weekly hours and generated slots use this timezone.
      </p>

      {isOwner ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={timezone || 'America/New_York'}
            disabled={saving}
            onChange={(e) => saveTimezone(e.target.value)}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {formatTimezoneLabel(tz)}
              </option>
            ))}
          </select>
          {detected && detected !== timezone && (
            <button
              type="button"
              disabled={saving}
              onClick={() => saveTimezone(detected)}
              className="min-h-[44px] rounded-lg border border-luminexa-accent px-3 text-sm font-medium text-luminexa-accent disabled:opacity-60"
            >
              Use {detected.split('/').pop().replace(/_/g, ' ')}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-slate-900">
          {formatTimezoneLabel(timezone || 'America/New_York')}
        </p>
      )}

      {saving && (
        <p className="mt-2 text-xs text-slate-500">Saving timezone…</p>
      )}
    </section>
  );
}
