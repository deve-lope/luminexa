import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookingCalendar from '../../components/booking/BookingCalendar';
import InteractiveDayTimeline from '../../components/scheduling/InteractiveDayTimeline';
import QuickAddServicePanel from '../../components/scheduling/QuickAddServicePanel';
import ScheduleAddSheet from '../../components/scheduling/ScheduleAddSheet';
import SchedulingModeBanner from '../../components/provider/SchedulingModeBanner';
import { providerSettings } from '../../utils/providerPaths';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { buildOpenSlotDays } from '../../utils/slotCalendar';
import { formatLocalDateKey } from '../../utils/dateRange';
import TimelineTimeAdjust from '../../components/scheduling/TimelineTimeAdjust';
const MAX_PENDING = 3;

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
  const [pending, setPending] = useState([]);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
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
      const [svcRes, custRes, slotRes, dashRes, pendingCustRes, unavailRes, schedRes] =
        await Promise.all([
          jobsAPI.listServices({ organization: orgSlug }),
          jobsAPI.listOrgCustomers(orgSlug),
          jobsAPI.listSlots({ organization: orgSlug }),
          jobsAPI.getProviderDashboard(orgSlug),
          jobsAPI.listOrgCustomers(orgSlug, { status: 'pending' }),
          jobsAPI.listUnavailableBlocks({ organization: orgSlug }),
          jobsAPI.getSchedulingSettings(orgSlug),
        ]);
      const svcList = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.results || [];
      setServices(svcList);
      setCustomers(custRes.data || []);
      const slotPayload = slotRes.data;
      setSlots(slotPayload?.slots ?? (Array.isArray(slotPayload) ? slotPayload : []));
      const unavailPayload = unavailRes.data;
      setUnavailable(
        Array.isArray(unavailPayload) ? unavailPayload : unavailPayload?.results || []
      );
      setWeeklyBlocks(schedRes.data?.weekly_blocks || []);
      setPendingCustomers(pendingCustRes.data || []);
      setPending(dashRes.data?.pending_requests || []);
      const ctx = await jobsAPI.getBookingContext(orgSlug);
      setSchedulingMode(ctx.data?.scheduling_mode || 'flexi');
      if (svcList.length && !slotService) setSlotService(String(svcList[0].id));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, activeOrg]);

  useEffect(() => {
    if (!services.length || slotService) return;
    setSlotService(String(services[0].id));
  }, [services, slotService]);

  useEffect(() => {
    load();
  }, [load]);

  const firstFutureDayInMonth = useCallback((y, m) => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1) {
      const cellDate = new Date(y, m - 1, d);
      if (cellDate >= t) {
        return formatLocalDateKey(cellDate);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (loading || selectedDay) return;
    const key = firstFutureDayInMonth(calYear, calMonth);
    if (key) setSelectedDay(key);
  }, [loading, selectedDay, calYear, calMonth, firstFutureDayInMonth]);

  const openSlots = useMemo(
    () => slots.filter((s) => s.status === 'open' && new Date(s.start_at) > new Date()),
    [slots]
  );
  const openSlotDays = useMemo(() => buildOpenSlotDays(openSlots), [openSlots]);
  const daySlotsAll = useMemo(
    () => (selectedDay ? slots.filter((s) => s.start_at.startsWith(selectedDay)) : []),
    [slots, selectedDay]
  );

  const pendingShown = pending.slice(0, MAX_PENDING);
  const pendingHidden = pending.length - pendingShown.length;

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
    setSelectedDay(firstFutureDayInMonth(y, m));
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
      } else if (mode === 'book') {
        await jobsAPI.providerBook({
          organization: activeOrg.organization,
          service: serviceId,
          customer: customerId,
          start_at,
          end_at,
          customer_notes: bookNotes || '',
        });
        setMessage('Appointment booked for customer.');
      }
      resetAddFlow();
      await load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSlotSubmitting(false);
    }
  };

  const respond = async (id, action) => {
    try {
      if (action === 'accept') await jobsAPI.acceptBooking(id);
      else await jobsAPI.declineBooking(id);
      setMessage(action === 'accept' ? 'Request confirmed.' : 'Request declined.');
      load();
    } catch (err) {
      setError(parseApiError(err));
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
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:px-4 sm:py-3">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:px-4 sm:py-3">{error}</p>
      )}
      {loading && <p className="text-center text-slate-500">Loading…</p>}

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

      {!!pendingCustomers.length && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Pending customers</h2>
          <ul className="mt-4 space-y-3">
            {pendingCustomers.map((c) => (
              <li
                key={c.membership_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{c.full_name}</p>
                  <p className="truncate text-sm text-slate-600">{c.email}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await jobsAPI.approveCustomer(orgSlug, c.id);
                    setMessage(`${c.full_name} approved.`);
                    load();
                  }}
                  className="min-h-[44px] shrink-0 rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white"
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!pending.length && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Pending requests</h2>
          <ul className="mt-4 space-y-3">
            {pendingShown.map((b) => (
              <li key={b.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{b.service_name}</p>
                <p className="text-sm text-slate-600">{b.customer_name}</p>
                <p className="text-sm text-slate-500">{formatWhen(b.start_at)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respond(b.id, 'accept')}
                    className="min-h-[44px] flex-1 rounded-lg bg-luminexa-accent font-medium text-white"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(b.id, 'decline')}
                    className="min-h-[44px] flex-1 rounded-lg border border-slate-200 text-slate-700"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {pendingHidden > 0 && (
            <p className="mt-2 text-center text-xs text-slate-500">
              +{pendingHidden} more on Today
            </p>
          )}
        </section>
      )}

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
