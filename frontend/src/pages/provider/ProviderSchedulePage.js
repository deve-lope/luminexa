import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BookingCalendar from '../../components/booking/BookingCalendar';
import InteractiveDayTimeline from '../../components/scheduling/InteractiveDayTimeline';
import DayBookingsSummary from '../../components/scheduling/DayBookingsSummary';
import QuickAddServicePanel from '../../components/scheduling/QuickAddServicePanel';
import BookCustomerForm from '../../components/scheduling/BookCustomerForm';
import ScheduleAddSheet from '../../components/scheduling/ScheduleAddSheet';
import SchedulingModeBanner from '../../components/provider/SchedulingModeBanner';
import {
  providerClients,
  providerRequests,
  providerSchedule,
  providerSettings,
} from '../../utils/providerPaths';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { buildProviderScheduleDays, slotLocalDayKey } from '../../utils/slotCalendar';
import { formatLocalDateKey, parseLocalDateKey } from '../../utils/dateRange';
import LinkShareBar from '../../components/LinkShareBar';
import ConfirmDialog from '../../components/ConfirmDialog';
import { defaultDayBounds } from '../../utils/dayTimeline';
import { normalizeRange, suggestDefaultDraftRange } from '../../utils/timelineInteraction';
import {
  isScheduleDayKey,
  readRememberedScheduleDay,
  rememberScheduleDay,
} from '../../utils/scheduleDayMemory';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  if (!d || typeof d !== 'object') return 'Something went wrong.';
  for (const key of ['email', 'full_name', 'phone', 'customer', 'service', 'non_field_errors']) {
    const val = d[key];
    if (Array.isArray(val) && val[0]) return String(val[0]);
    if (typeof val === 'string' && val) return val;
  }
  const first = Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Something went wrong.';
}

/** Keep last month paint so Show more → Back doesn’t blank the day list. */
const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000;
const schedulePageCache = new Map();

function scheduleCacheKey(orgSlug, year, month) {
  return `${orgSlug || ''}:${year}:${month}`;
}

function readScheduleCache(orgSlug, year, month) {
  const key = scheduleCacheKey(orgSlug, year, month);
  const hit = schedulePageCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SCHEDULE_CACHE_TTL_MS) {
    schedulePageCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeScheduleCache(orgSlug, year, month, data) {
  if (!orgSlug) return;
  schedulePageCache.set(scheduleCacheKey(orgSlug, year, month), {
    at: Date.now(),
    data,
  });
}

export default function ProviderSchedulePage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const dayFromUrl = searchParams.get('day');
  const initialDay = (() => {
    if (isScheduleDayKey(dayFromUrl)) return dayFromUrl;
    return readRememberedScheduleDay(orgSlug);
  })();
  const initialDate = initialDay ? parseLocalDateKey(initialDay) : null;
  const today = new Date();
  const bootYear = initialDate ? initialDate.getFullYear() : today.getFullYear();
  const bootMonth = initialDate ? initialDate.getMonth() + 1 : today.getMonth() + 1;
  const cachedMonth = readScheduleCache(orgSlug, bootYear, bootMonth);
  const [calYear, setCalYear] = useState(() => bootYear);
  const [calMonth, setCalMonth] = useState(() => bootMonth);
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const [services, setServices] = useState(() => cachedMonth?.services || []);
  const [customers, setCustomers] = useState(() => cachedMonth?.customers || []);
  const [slots, setSlots] = useState(() => cachedMonth?.slots || []);
  const [monthBookings, setMonthBookings] = useState(() => cachedMonth?.monthBookings || []);
  const [unavailable, setUnavailable] = useState(() => cachedMonth?.unavailable || []);
  const [weeklyBlocks, setWeeklyBlocks] = useState(() => cachedMonth?.weeklyBlocks || []);
  const [pendingCustomers, setPendingCustomers] = useState(
    () => cachedMonth?.pendingCustomers || [],
  );
  const [loading, setLoading] = useState(() => !cachedMonth);
  const [message, setMessage] = useState(null);
  const [customerShareUrl, setCustomerShareUrl] = useState('');
  const [customerSharePhone, setCustomerSharePhone] = useState('');
  const [customerShareEmail, setCustomerShareEmail] = useState('');
  const [error, setError] = useState(null);

  const [slotService, setSlotService] = useState(() => cachedMonth?.slotService || '');
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [schedulingMode, setSchedulingMode] = useState(
    () => cachedMonth?.schedulingMode || 'flexi',
  );

  const [addMode, setAddMode] = useState(null);
  const [draftRange, setDraftRange] = useState(null);
  const [deletingUnavailableId, setDeletingUnavailableId] = useState(null);
  const [pendingDeleteUnavailableId, setPendingDeleteUnavailableId] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug || !activeOrg) return;
    // Soft refresh when we already painted this month (Back from Show more).
    if (!readScheduleCache(orgSlug, calYear, calMonth)) {
      setLoading(true);
    }
    setError(null);
    try {
      // Visible month only — recurring shops can have thousands of slots across the range.
      const monthStart = new Date(calYear, calMonth - 1, 1);
      const monthEnd = new Date(calYear, calMonth, 0);
      const from = formatLocalDateKey(monthStart);
      const until = formatLocalDateKey(monthEnd);

      const [svcRes, custRes, slotRes, pendingCustRes, unavailRes, schedRes, bookRes] =
        await Promise.all([
          jobsAPI.listServices({ organization: orgSlug }),
          jobsAPI.listOrgCustomers(orgSlug),
          jobsAPI.listSlots({ organization: orgSlug, from, until }),
          jobsAPI.listOrgCustomers(orgSlug, { status: 'pending' }),
          jobsAPI.listUnavailableBlocks({ organization: orgSlug }),
          jobsAPI.getSchedulingSettings(orgSlug),
          jobsAPI.listBookings({
            organization: orgSlug,
            from,
            until,
            status: 'requested,quoted,confirmed,in_progress,needs_return',
          }),
        ]);
      const svcList = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.results || [];
      setServices(svcList);
      setCustomers(custRes.data || []);
      const slotPayload = slotRes.data;
      let loadedSlots = slotPayload?.slots ?? (Array.isArray(slotPayload) ? slotPayload : []);
      if (!Array.isArray(loadedSlots)) loadedSlots = [];
      const bookPayload = bookRes.data;
      const loadedBookings = Array.isArray(bookPayload)
        ? bookPayload
        : bookPayload?.results || [];
      setMonthBookings(Array.isArray(loadedBookings) ? loadedBookings : []);

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
      const loadedUnavailable = Array.isArray(unavailPayload)
        ? unavailPayload
        : unavailPayload?.results || [];
      setUnavailable(loadedUnavailable);
      const loadedPending = pendingCustRes.data || [];
      setPendingCustomers(loadedPending);
      let resolvedSlotService = '';
      setSlotService((prev) => {
        resolvedSlotService = prev || (svcList[0] ? String(svcList[0].id) : '');
        return resolvedSlotService;
      });
      writeScheduleCache(orgSlug, calYear, calMonth, {
        services: svcList,
        customers: custRes.data || [],
        slots: loadedSlots,
        monthBookings: Array.isArray(loadedBookings) ? loadedBookings : [],
        unavailable: loadedUnavailable,
        weeklyBlocks: blocks,
        pendingCustomers: loadedPending,
        schedulingMode: mode,
        slotService: resolvedSlotService,
      });
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

  const scheduleDays = useMemo(() => buildProviderScheduleDays(slots), [slots]);

  // Prefer ?day= (and in-month selection). Never overwrite with "today" while a day is set.
  useEffect(() => {
    const prefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;

    if (isScheduleDayKey(dayFromUrl)) {
      rememberScheduleDay(orgSlug, dayFromUrl);
      const d = parseLocalDateKey(dayFromUrl);
      if (d) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        if (calYear !== y) setCalYear(y);
        if (calMonth !== m) setCalMonth(m);
      }
      if (selectedDay !== dayFromUrl) setSelectedDay(dayFromUrl);
      return;
    }

    if (selectedDay && selectedDay.startsWith(prefix)) {
      rememberScheduleDay(orgSlug, selectedDay);
      if (dayFromUrl !== selectedDay) {
        setSearchParams({ day: selectedDay }, { replace: true });
      }
      return;
    }

    // Month changed (selection cleared) — pick a day in this month only.
    if (loading) return;
    const preferred = firstOpenOrFutureDayInMonth(calYear, calMonth, scheduleDays);
    if (!preferred) return;
    rememberScheduleDay(orgSlug, preferred);
    setSelectedDay(preferred);
    setSearchParams({ day: preferred }, { replace: true });
  }, [
    loading,
    calYear,
    calMonth,
    scheduleDays,
    selectedDay,
    dayFromUrl,
    orgSlug,
    firstOpenOrFutureDayInMonth,
    setSearchParams,
  ]);

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

  const requestDeleteUnavailable = (blockId) => {
    if (!blockId) return;
    setPendingDeleteUnavailableId(blockId);
  };

  const confirmDeleteUnavailable = async () => {
    const blockId = pendingDeleteUnavailableId;
    if (!blockId) return;
    setDeletingUnavailableId(blockId);
    setError(null);
    try {
      await jobsAPI.deleteUnavailableBlock(blockId);
      setMessage('Unavailable block removed. That time can be opened or booked again.');
      setCustomerShareUrl('');
      setCustomerSharePhone('');
      setCustomerShareEmail('');
      setPendingDeleteUnavailableId(null);
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setDeletingUnavailableId(null);
    }
  };

  const startBookCustomer = () => {
    if (!selectedDay) return;
    setError(null);
    setMessage(null);
    setAddMode('book');
    const svc = services.find((s) => String(s.id) === String(slotService));
    setDraftRange(
      suggestDefaultDraftRange({
        dayKey: selectedDay,
        weeklyBlocks,
        durationMinutes: Number(svc?.duration_minutes) || 60,
      }),
    );
  };

  const selectDay = (day) => {
    setSelectedDay(day);
    resetAddFlow();
    setError(null);
    if (isScheduleDayKey(day)) {
      rememberScheduleDay(orgSlug, day);
      setSearchParams({ day }, { replace: true });
    }
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
    setSearchParams({}, { replace: true });
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
    newCustomer,
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
        setCustomerSharePhone('');
        setCustomerShareEmail('');
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
        setCustomerSharePhone('');
        setCustomerShareEmail('');
      } else if (mode === 'book') {
        const payload = {
          organization: activeOrg.organization,
          service: serviceId,
          start_at,
          end_at,
          customer_notes: bookNotes || '',
        };
        if (customerId) {
          payload.customer = customerId;
        } else if (newCustomer?.email) {
          payload.full_name = newCustomer.full_name;
          payload.email = newCustomer.email;
          payload.phone = newCustomer.phone || '';
        } else {
          setError('Pick a client or enter new caller details.');
          setSlotSubmitting(false);
          return;
        }
        const bookRes = await jobsAPI.providerBook(payload);
        const url = bookRes.data?.customer_view_url || '';
        setCustomerShareUrl(url);
        setCustomerSharePhone(
          bookRes.data?.customer_phone || newCustomer?.phone || '',
        );
        setCustomerShareEmail(
          bookRes.data?.customer_email || newCustomer?.email || '',
        );
        setMessage(
          url
            ? 'Invite sent by email. Share the link below by text if you have their number.'
            : 'Invite sent. They’ll confirm via the email we sent.'
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
                text="Here is your appointment — confirm here:"
                phone={customerSharePhone}
                email={customerShareEmail}
                showInput={false}
                copyLabel="Copy link"
                shareLabel="Share"
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
          days={scheduleDays}
          selectedDay={selectedDay}
          onSelectDay={selectDay}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          allowSelectFutureDays
          showWorkLoad
          size="full"
        />

        {selectedDay && (
          <div className="mt-3 space-y-3">
            <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 ring-1 ring-violet-100">
              Selected: {dayLabel}
            </p>
            {!addMode && (
              <DayBookingsSummary
                orgSlug={orgSlug}
                dayKey={selectedDay}
                bookings={monthBookings}
                slots={daySlotsAll}
                returnTo={providerSchedule(orgSlug, { day: selectedDay })}
              />
            )}
            {services.length > 0 && addMode !== 'book' && (
              <button
                type="button"
                onClick={startBookCustomer}
                className="lx-btn-primary w-full min-h-[52px] text-base"
              >
                Book for a customer
              </button>
            )}
          </div>
        )}

        {selectedDay && services.length > 0 && addMode === 'book' && (
          <div className="mt-3">
            <BookCustomerForm
              dayKey={selectedDay}
              dayLabel={dayLabel}
              draftRange={draftRange}
              onDraftRangeChange={setDraftRange}
              onRangeError={setError}
              weeklyBlocks={weeklyBlocks}
              slots={daySlotsAll}
              unavailable={unavailable}
              services={services}
              serviceId={slotService}
              onServiceChange={(id) => {
                setSlotService(id);
                if (!draftRange || !selectedDay) return;
                const svc = services.find((s) => String(s.id) === String(id));
                const durationMs = (Number(svc?.duration_minutes) || 60) * 60 * 1000;
                const next = normalizeRange(
                  draftRange.startMs,
                  draftRange.startMs + durationMs,
                  defaultDayBounds(selectedDay, weeklyBlocks),
                );
                if (next) {
                  setDraftRange(next);
                  setError(null);
                }
              }}
              customers={customers}
              submitting={slotSubmitting}
              error={slotSubmitting ? null : error}
              onCancel={resetAddFlow}
              onSubmit={(payload) =>
                handleConfirmAdd({
                  mode: 'book',
                  ...payload,
                })
              }
            />
          </div>
        )}

        {selectedDay && services.length > 0 && addMode !== 'book' && (
          <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
            <ScheduleAddSheet
              activeMode={addMode}
              onSelectMode={(mode) => {
                setAddMode(mode);
                setError(null);
                setDraftRange(
                  suggestDefaultDraftRange({
                    dayKey: selectedDay,
                    weeklyBlocks,
                    durationMinutes: 60,
                  }),
                );
              }}
              onCancelMode={resetAddFlow}
              draftRange={draftRange}
              onDraftRangeChange={setDraftRange}
              onRangeError={setError}
              dayKey={selectedDay}
              weeklyBlocks={weeklyBlocks}
              slots={daySlotsAll}
              unavailable={unavailable}
              onConfirm={handleConfirmAdd}
              submitting={slotSubmitting}
              error={slotSubmitting ? null : error}
            />

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <h3 className="text-sm font-semibold text-slate-800">{dayLabel}</h3>
              <div className="mt-2 sm:mt-3">
                <InteractiveDayTimeline
                  dayKey={selectedDay}
                  slots={daySlotsAll}
                  unavailable={unavailable}
                  weeklyBlocks={weeklyBlocks}
                  onDeleteUnavailable={requestDeleteUnavailable}
                  deletingUnavailableId={deletingUnavailableId}
                />
              </div>
            </div>
          </div>
        )}

        {!selectedDay && !loading && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Select a day on the calendar to book a customer or manage times.
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

      <ConfirmDialog
        open={Boolean(pendingDeleteUnavailableId)}
        title="Remove unavailable time?"
        message="This block will be deleted. That time can be opened or booked again."
        confirmLabel="Remove block"
        cancelLabel="Keep"
        tone="danger"
        busy={Boolean(deletingUnavailableId)}
        onConfirm={confirmDeleteUnavailable}
        onClose={() => {
          if (deletingUnavailableId) return;
          setPendingDeleteUnavailableId(null);
        }}
      />
    </div>
  );
}
