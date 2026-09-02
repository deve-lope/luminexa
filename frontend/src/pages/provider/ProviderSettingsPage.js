import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookingPolicySettings from '../../components/provider/BookingPolicySettings';
import OrganizationTimezoneField from '../../components/provider/OrganizationTimezoneField';
import ProviderBooksSettings from '../../components/provider/ProviderBooksSettings';
import ProviderServiceAreaSettings from '../../components/provider/ProviderServiceAreaSettings';
import ProviderWebsiteSettings from '../../components/provider/ProviderWebsiteSettings';
import SettingsSectionOverlay from '../../components/provider/SettingsSectionOverlay';
import FlexiQuickOpenSlots from '../../components/scheduling/FlexiQuickOpenSlots';
import { useAuth } from '../../contexts/AuthContext';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerSchedule } from '../../utils/providerPaths';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import DateRangeControl from '../../components/scheduling/DateRangeControl';
import SavingOverlay from '../../components/ui/SavingOverlay';
import { formatLocalDateKey } from '../../utils/dateRange';
import { IconChevronLeft } from '../../components/icons/NavIcons';

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

const SETTINGS_SECTIONS = [
  {
    id: 'availability',
    title: 'Availability',
    hint: 'Timezone, weekly hours, or flexi dates',
  },
  {
    id: 'booking',
    title: 'How customers book',
    hint: 'Approval, jobs at the same time, cancel cutoff',
  },
  {
    id: 'books',
    title: 'Business books',
    hint: 'Invoice reminders and labor rate',
  },
  {
    id: 'locations',
    title: 'Service locations',
    hint: 'Addresses and how far you travel',
  },
  {
    id: 'website',
    title: 'Your website',
    hint: 'Optional link to your own site',
  },
];

function defaultDateRange() {
  const from = new Date();
  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  return { from: formatLocalDateKey(from), until: formatLocalDateKey(until) };
}

export default function ProviderSettingsPage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const { memberships } = useAuth();
  const isOwner = useMemo(
    () => memberships?.some((m) => m.organization_slug === orgSlug && m.role === 'owner'),
    [memberships, orgSlug]
  );
  const [mode, setMode] = useState('flexi');
  const [timezone, setTimezone] = useState('America/New_York');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.getSchedulingSettings(orgSlug);
      const d = res.data;
      setMode(d.scheduling_mode || 'flexi');
      setTimezone(d.timezone || 'America/New_York');
      const defaults = defaultDateRange();
      setValidFrom(d.schedule_valid_from || defaults.from);
      setValidUntil(d.schedule_valid_until || defaults.until);
      const list = d.weekly_blocks || [];
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
        setBlocks([0, 1, 2, 3, 4].map((wd) => ({ ...DEFAULT_BLOCK, weekday: wd })));
      }
    } catch (e) {
      setError(parseApiError(e) || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOrgId(activeOrg?.organization ?? null);
  }, [activeOrg]);

  const save = async () => {
    if (!orgSlug) return;
    if (mode === 'recurring' && validFrom && validUntil && validFrom > validUntil) {
      setError('End date must be on or after start date.');
      return;
    }
    if (mode === 'recurring' && blocks.length === 0) {
      setError('Select at least one weekday for your weekly schedule.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        scheduling_mode: mode,
        schedule_valid_from: mode === 'recurring' ? validFrom || null : null,
        schedule_valid_until: mode === 'recurring' ? validUntil || null : null,
        weekly_blocks:
          mode === 'recurring'
            ? blocks.map((b) => ({
                weekday: b.weekday,
                start_time: b.start_time.length === 5 ? `${b.start_time}:00` : b.start_time,
                end_time: b.end_time.length === 5 ? `${b.end_time}:00` : b.end_time,
                is_active: true,
              }))
            : [],
      };
      const res = await jobsAPI.saveSchedulingSettings(orgSlug, payload);
      setMessage(
        mode === 'recurring'
          ? `Saved. ${res.data?.slots_created ?? 0} new open slots generated for your date range.`
          : 'Flexi mode saved. Add open times for specific dates below, or on Schedule.'
      );
      await load();
    } catch (e) {
      setError(parseApiError(e) || 'Could not save settings.');
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
    setBlocks(blocks.map((b) => (b.weekday === weekday ? { ...b, [field]: value } : b)));
  };

  const isDayActive = (weekday) => blocks.some((b) => b.weekday === weekday);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading settings…</p>;
  }

  return (
    <div className="relative space-y-3">
      {saving && (
        <SavingOverlay
          message="Saving availability"
          submessage={
            mode === 'recurring'
              ? 'Generating open slots for your date range…'
              : 'Updating your schedule settings…'
          }
        />
      )}

      <p className="text-sm text-slate-600">
        Open a section to change it. Only one is shown at a time.
      </p>

      <ul className="space-y-2">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => setOpenSection(section.id)}
              className="flex w-full min-h-[64px] items-center gap-3 overflow-hidden rounded-2xl border border-teal-100/90 bg-gradient-to-br from-white via-luminexa-mist to-teal-50/70 px-4 py-3 text-left shadow-lx-card transition hover:border-teal-300 hover:shadow-lx-elevated"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold tracking-tight text-slate-900">
                  {section.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{section.hint}</span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-teal-800 ring-1 ring-teal-200/70">
                <IconChevronLeft className="h-4 w-4 rotate-180" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {message && !openSection && <p className="text-sm text-emerald-700">{message}</p>}
      {error && !openSection && <p className="text-sm text-red-600">{error}</p>}

      <SettingsSectionOverlay
        open={Boolean(openSection)}
        title={SETTINGS_SECTIONS.find((s) => s.id === openSection)?.title || 'Settings'}
        onClose={() => setOpenSection(null)}
      >
        {openSection === 'availability' && (
          <div className="space-y-6">
            <OrganizationTimezoneField
              orgSlug={orgSlug}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              schedulingMode={mode}
              isOwner={isOwner}
              embedded
              onSaved={(msg) => {
                setMessage(msg);
                setError(null);
              }}
              onError={(msg) => {
                if (msg) setError(msg);
              }}
            />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Availability mode</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('recurring')}
                  className={`min-h-[52px] rounded-xl border-2 p-3 text-left text-sm ${
                    mode === 'recurring' ? 'border-luminexa-accent bg-violet-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="font-semibold text-slate-900">Weekly schedule</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Same hours each week, auto slots
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flexi')}
                  className={`min-h-[52px] rounded-xl border-2 p-3 text-left text-sm ${
                    mode === 'flexi' ? 'border-luminexa-accent bg-violet-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="font-semibold text-slate-900">Flexi</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Pick each date & time yourself
                  </span>
                </button>
              </div>
            </section>

            {mode === 'recurring' && (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Date range</h3>
                  <p className="text-sm text-slate-600">
                    Slide the handles or pick dates — open slots are auto-generated only in this range.
                  </p>
                  <DateRangeControl
                    from={validFrom}
                    until={validUntil}
                    onChange={({ from, until }) => {
                      setValidFrom(from);
                      setValidUntil(until);
                    }}
                    maxSpanDays={365}
                  />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Weekly hours</h3>
                  <p className="text-sm text-slate-600">Start and end time for each working day.</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`min-h-[40px] min-w-[48px] rounded-lg text-sm font-medium ${
                          isDayActive(d.value) ? 'lx-toggle-active' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {blocks.map((b) => (
                      <div
                        key={b.weekday}
                        className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2 text-sm"
                      >
                        <span className="font-medium text-slate-700">
                          {WEEKDAYS.find((d) => d.value === b.weekday)?.label}
                        </span>
                        <div>
                          <label className="sr-only">Start time</label>
                          <input
                            type="time"
                            value={b.start_time}
                            onChange={(e) =>
                              updateBlockTime(b.weekday, 'start_time', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-2"
                          />
                        </div>
                        <span className="text-center text-slate-400">–</span>
                        <div>
                          <label className="sr-only">End time</label>
                          <input
                            type="time"
                            value={b.end_time}
                            onChange={(e) =>
                              updateBlockTime(b.weekday, 'end_time', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {mode === 'flexi' && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Open times by date</h3>
                <FlexiQuickOpenSlots orgSlug={orgSlug} organizationId={orgId} />
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Need multiple blocks on one day, unavailable time, or booking a customer? Use{' '}
                  <Link to={providerSchedule(orgSlug)} className="font-medium text-luminexa-accent">
                    Schedule
                  </Link>{' '}
                  (calendar + timeline).
                </p>
              </section>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={save}
              aria-busy={saving}
              className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-semibold text-white disabled:opacity-60"
            >
              Save availability mode
            </button>

            {message && <p className="text-sm text-emerald-700">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {openSection === 'booking' && (
          <BookingPolicySettings
            orgSlug={orgSlug}
            organizationName={activeOrg?.organization_name}
            isOwner={isOwner}
            embedded
          />
        )}

        {openSection === 'books' && (
          <ProviderBooksSettings orgSlug={orgSlug} isOwner={isOwner} embedded />
        )}

        {openSection === 'locations' && (
          <ProviderServiceAreaSettings orgSlug={orgSlug} isOwner={isOwner} embedded />
        )}

        {openSection === 'website' && (
          <ProviderWebsiteSettings orgSlug={orgSlug} isOwner={isOwner} embedded />
        )}
      </SettingsSectionOverlay>
    </div>
  );
}
