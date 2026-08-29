import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookingCalendar from '../../components/booking/BookingCalendar';
import InteractiveDayTimeline from '../../components/scheduling/InteractiveDayTimeline';
import QuickAddServicePanel from '../../components/scheduling/QuickAddServicePanel';
import ScheduleAddSheet from '../../components/scheduling/ScheduleAddSheet';
import SchedulingModeBanner from '../../components/provider/SchedulingModeBanner';
import { providerClients, providerRequests, providerSettings } from '../../utils/providerPaths';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { buildOpenSlotDays, slotLocalDayKey } from '../../utils/slotCalendar';
import { formatLocalDateKey } from '../../utils/dateRange';
import TimelineTimeAdjust from '../../components/scheduling/TimelineTimeAdjust';
import LinkShareBar from '../../components/LinkShareBar';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Something went wrong.';
}

export default function ProviderSchedulePage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(null);

  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [weeklyBlocks, setWeeklyBlocks] = useState([]);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [customerShareUrl, setCustomerShareUrl] = useState('');
  const [error, setError] = useState(null);

  const [slotService, setSlotService] = useState('');
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [schedulingMode, setSchedulingMode] = useState('flexi');

  const [addMode, setAddMode] = useState(null);
  const [draftRange, setDraftRange] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug || !activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      // Visible month only — recurring shops can have thousands of slots across the range.
      const monthStart = new Date(calYear, calMonth - 1, 1);
      const monthEnd = new Date(calYear, calMonth, 0);
      const from = formatLocalDateKey(monthStart);
      const until = formatLocalDateKey(monthEnd);

      const [svcRes, custRes, slotRes, pendingCustRes, unavailRes, schedRes] =
        await Promise.all([
          jobsAPI.listServices({ organization: orgSlug }),
          jobsAPI.listOrgCustomers(orgSlug),
          jobsAPI.listSlots({ organization: orgSlug, from, until }),
          jobsAPI.listOrgCustomers(orgSlug, { status: 'pending' }),
          jobsAPI.listUnavailableBlocks({ organization: orgSlug }),
          jobsAPI.getSchedulingSettings(orgSlug),
        ]);
      const svcList = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.results || [];
      setServices(svcList);
      setCustomers(custRes.data || []);
      const slotPayload = slotRes.data;
      let loadedSlots = slotPayload?.slots ?? (Array.isArray(slotPayload) ? slotPayload : []);
      if (!Array.isArray(loadedSlots)) loadedSlots = [];

      const mode = schedRes.data?.scheduling_mode || 'flexi';
      const blocks = schedRes.data?.weekly_blocks || [];
      setWeeklyBlocks(blocks);
      setSchedulingMode(mode);

      const hasOpenInMonth = loadedSlots.some(
        (s) => s.status === 'open' && new Date(s.start_at) > new Date()
      );
      if (mode === 'recurring' && blocks.length > 0 && svcList.length > 0 && !hasOpenInMonth) {
        try {
          await jobsAPI.syncRecurringSlots(orgSlug);
          const refreshed = await jobsAPI.listSlots({ organization: orgSlug, from, until });
          const refreshedPayload = refreshed.data;
          loadedSlots =
            refreshedPayload?.slots ?? (Array.isArray(refreshedPayload) ? refreshedPayload : []);
          if (!Array.isArray(loadedSlots)) loadedSlots = [];
        } catch {
          // Sync may be queued; keep whatever we already have.
        }
      }

      setSlots(loadedSlots);
      const unavailPayload = unavailRes.data;
      setUnavailable(
        Array.isArray(unavailPayload) ? unavailPayload : unavailPayload?.results || []
      );
      setPendingCustomers(pendingCustRes.data || []);
      if (svcList.length && !slotService) setSlotService(String(svcList[0].id));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, activeOrg, calYear, calMonth]);

  useEffect(() => {
    if (!services.length || slotService) return;
    setSlotService(String(services[0].id));
  }, [services, slotService]);

  useEffect(() => {
    load();
  }, [load]);

  const firstOpenOrFutureDayInMonth = useCallback((y, m, openDaysMap) => {
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    const openKeys = Object.keys(openDaysMap || {})
      .filter((k) => k.startsWith(prefix) && (openDaysMap[k]?.open_count || 0) > 0)
      .sort();
    if (openKeys.length) return openKeys[0];
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1) {
      const cellDate = new Date(y, m - 1, d);
      if (cellDate >= t) return formatLocalDateKey(cellDate);
    }
    return null;
  }, []);

  const openSlots = useMemo(
    () => slots.filter((s) => s.status === 'open' && new Date(s.start_at) > new Date()),
    [slots]
  );
  const openSlotDays = useMemo(() => buildOpenSlotDays(openSlots), [openSlots]);

  useEffect(() => {
    if (loading) return;
    const prefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;
    const preferred = firstOpenOrFutureDayInMonth(calYear, calMonth, openSlotDays);
    if (!preferred) return;
    const selectionInMonth = selectedDay && selectedDay.startsWith(prefix);
    const selectionHasOpen = selectionInMonth && (openSlotDays[selectedDay]?.open_count || 0) > 0;
    const monthHasOpen = Object.keys(openSlotDays).some(
      (k) => k.startsWith(prefix) && (openSlotDays[k]?.open_count || 0) > 0
    );
    if (!selectionInMonth || (monthHasOpen && !selectionHasOpen)) {
      setSelectedDay(preferred);
    }
  }, [loading, calYear, calMonth, openSlotDays, selectedDay, firstOpenOrFutureDayInMonth]);

  const daySlotsAll = useMemo(
    () =>
      selectedDay
        ? slots.filter((s) => slotLocalDayKey(s.start_at) === selectedDay)
        : [],
    [slots, selectedDay]
  );

  const attentionCount = pendingCustomers.length;

  const resetAddFlow = () => {
    setAddMode(null);
    setDraftRange(null);
  };

  const shiftMonth = (delta) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalMonth(m);
    setCalYear(y);
    setSelectedDay(null);
    resetAddFlow();
  };

  const addService = async (payload) => {
    if (!activeOrg) return;
    setServiceSubmitting(true);
    setError(null);
    try {
      const res = await jobsAPI.createService({
        ...payload,
        organization: activeOrg.organization,
        sort_order: services.length,
      });
      setMessage(`Service "${res.data.name}" created.`);
      await load();
      if (res.data?.id) setSlotService(String(res.data.id));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleConfirmAdd = async ({
    mode,
    startMs,
    endMs,
    serviceId,
    customerId,
    note,
    bookNotes,
  }) => {
    if (!activeOrg || !selectedDay) return;
    const start_at = new Date(startMs).toISOString();
    const end_at = new Date(endMs).toISOString();
    if (new Date(end_at) <= new Date(start_at)) {
      setError('End time must be after start time.');
      return;
    }

    setSlotSubmitting(true);
    setError(null);
    try {
      if (mode === 'open') {
        await jobsAPI.createSlot({
          organization: activeOrg.organization,
          start_at,
          end_at,
        });
        setMessage('Open slot saved — customers can book this time.');
        setCustomerShareUrl('');
      } else if (mode === 'unavailable') {
        const unavailRes = await jobsAPI.createUnavailableBlock({
          organization: activeOrg.organization,
          start_at,
          end_at,
          note: note || '',
        });
        const removed = unavailRes.data?.open_slots_removed ?? 0;
        const declined = unavailRes.data?.pending_requests_declined ?? 0;
        let unavailMsg = 'Unavailable time blocked.';
        if (removed > 0) {
          unavailMsg += ` ${removed} open slot${removed === 1 ? '' : 's'} removed.`;
        }
        if (declined > 0) {
          unavailMsg += ` ${declined} pending request${declined === 1 ? '' : 's'} declined.`;
        }
        setMessage(unavailMsg);
        setCustomerShareUrl('');
      } else if (mode === 'book') {
        const bookRes = await jobsAPI.providerBook({
          organization: activeOrg.organization,
          service: serviceId,
          customer: customerId,
          start_at,
          end_at,
          customer_notes: bookNotes || '',
        });
        const url = bookRes.data?.customer_view_url || '';
        setCustomerShareUrl(url);
        setMessage(
          url
            ? 'Appointment booked for customer. Copy the link below to send them.'
            : 'Appointment booked for customer.'
        );
      }
      resetAddFlow();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSlotSubmitting(false);
    }
  };

  if (!activeOrg) {
    return <p className="py-12 text-center text-slate-500">Loading schedule…</p>;
  }

  const dayLabel = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="space-y-4 pb-8 sm:space-y-6">
      <SchedulingModeBanner orgSlug={orgSlug} />

      {message && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:px-4 sm:py-3">
          <p>{message}</p>
          {customerShareUrl && (
            <div className="mt-3">
              <LinkShareBar
                url={customerShareUrl}
                title="Your Luminexa booking"
                text="Here is your appointment"
                showInput={false}
                copyLabel="Copy link"
                compact
              />
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:px-4 sm:py-3">{error}</p>
      )}
      {loading && <p className="text-center text-slate-500">Loading…</p>}

      {!loading && attentionCount > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {attentionCount} customer approval{attentionCount === 1 ? '' : 's'} waiting
          </p>
          <p className="mt-1 text-amber-800">
            Review them in{' '}
            <Link
              to={`${providerClients(orgSlug)}?status=pending`}
              className="font-medium text-luminexa-accent"
            >
              Clients
            </Link>
            . Booking requests are in{' '}
            <Link to={providerRequests(orgSlug)} className="font-medium text-luminexa-accent">
              Service requests
            </Link>
            .
          </p>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs text-slate-600 sm:mb-3 sm:text-sm">
          <span className="hidden sm:inline">
            Pick a day, tap <strong>Add</strong>, choose open slot / unavailable / book customer,
            then drag on the timeline to set the time (pull the edges to adjust).
          </span>
          <span className="sm:hidden">
            Pick a day → <strong>Add</strong> → drag the timeline to set times.
          </span>
        </p>

        {services.length === 0 && !loading && (
          <QuickAddServicePanel
            onCreate={addService}
            submitting={serviceSubmitting}
            className="mb-4"
          />
        )}

        <BookingCalendar
          year={calYear}
          month={calMonth}
          days={openSlotDays}
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            resetAddFlow();
            setError(null);
          }}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          allowSelectFutureDays
          size="full"
        />

        {selectedDay && (
          <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 ring-1 ring-violet-100">
            Selected: {dayLabel}
            {schedulingMode === 'recurring' &&
              (openSlotDays[selectedDay]?.open_count || 0) === 0 && (
                <span className="mt-1 block text-xs font-normal text-violet-800">
                  No open bookable times left on this day (past hours are skipped). Try a later
                  day with a green mark on the calendar.
                </span>
              )}
          </p>
        )}

        {selectedDay && services.length > 0 && (
          <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
            <ScheduleAddSheet
              activeMode={addMode}
              onSelectMode={(mode) => {
                setAddMode(mode);
                setDraftRange(null);
                setError(null);
              }}
              onCancelMode={resetAddFlow}
              draftRange={draftRange}
              services={services}
              serviceId={slotService}
              onServiceChange={setSlotService}
              customers={customers}
              onConfirm={handleConfirmAdd}
              submitting={slotSubmitting}
              error={slotSubmitting ? null : undefined}
            />

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <h3 className="text-sm font-semibold text-slate-800">{dayLabel}</h3>
              {addMode && (
                <div className="mt-3">
                  <TimelineTimeAdjust
                    dayKey={selectedDay}
                    draftRange={draftRange}
                    onDraftRangeChange={setDraftRange}
                    onRangeError={setError}
                    addMode={addMode}
                    slots={daySlotsAll}
                    unavailable={unavailable}
                    weeklyBlocks={weeklyBlocks}
                    disabled={slotSubmitting}
                  />
                </div>
              )}
              <div className="mt-2 sm:mt-3">
                <InteractiveDayTimeline
                  dayKey={selectedDay}
                  slots={daySlotsAll}
                  unavailable={unavailable}
                  weeklyBlocks={weeklyBlocks}
                  addMode={addMode}
                  draftRange={draftRange}
                  onDraftRangeChange={setDraftRange}
                  onClearDraft={() => setDraftRange(null)}
                />
              </div>
            </div>
          </div>
        )}

        {!selectedDay && !loading && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Select a day on the calendar to manage times.
          </p>
        )}
      </section>

      {schedulingMode === 'recurring' && (
        <p className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm text-slate-700">
          Weekly auto-slots in{' '}
          <Link to={providerSettings(orgSlug)} className="font-medium text-luminexa-accent">
            Availability settings
          </Link>
          . You can still add manual slots above.
        </p>
      )}
    </div>
  );
}
