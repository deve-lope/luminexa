import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BookingContactForm from '../../components/BookingContactForm';
import BookingServiceLocationSection from '../../components/customer/BookingServiceLocationSection';
import { validateServiceLocationValue } from '../../components/customer/ServiceLocationInput';
import BookingCalendar from '../../components/booking/BookingCalendar';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import {
  canViewBookingCalendar,
  customerConnectionState,
  getCustomerMembership,
  isOrgStaff,
  needsExplicitConnect,
} from '../../utils/bookingAccess';
import { formatServiceMeta, isShopService, isMobileService } from '../../utils/serviceDisplay';
import {
  calendarDataForMonth,
  firstBookableDayKey,
  isSlotBookableForCustomer,
  normalizeBookingCalendar,
} from '../../utils/slotCalendar';
import { customerBookings } from '../../utils/customerPaths';
import { useToast } from '../../contexts/ToastContext';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  if (d?.bookings) {
    const b = d.bookings;
    return Array.isArray(b) ? b[0] : String(b);
  }
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Request failed.';
}

function parseServiceIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Book multiple services from one provider: shared location, then a time per service.
 */
export default function CustomerBookMultipleServicesPage() {
  const { orgSlug, slug, providerKey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const businessSlug = providerKey || orgSlug || slug;
  const { memberships, user, setUserFromProfile, refreshSession } = useAuth();

  const serviceIds = useMemo(
    () => parseServiceIds(searchParams.get('services')),
    [searchParams]
  );

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [notes, setNotes] = useState('');
  const [serviceAddress, setServiceAddress] = useState(
    () => (user?.default_service_address || '').trim()
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [slotByServiceId, setSlotByServiceId] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [calendarFetching, setCalendarFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const membership = getCustomerMembership(memberships, businessSlug);
  const staffOfOrg = isOrgStaff(memberships, businessSlug);
  const bookingPolicy = storefront?.booking_policy;
  const connection = customerConnectionState(bookingPolicy, membership);
  const mustConnect = needsExplicitConnect(bookingPolicy) && connection === 'disconnected';
  const mayLoadCalendar = canViewBookingCalendar({
    isAuthenticated: true,
    isStaff: staffOfOrg,
  });
  const needsContact = !user?.has_booking_contact;

  const selectedServices = useMemo(() => {
    const list = storefront?.services || [];
    return serviceIds
      .map((id) => list.find((s) => Number(s.id) === id))
      .filter(Boolean);
  }, [storefront?.services, serviceIds]);

  const mixedFulfillment =
    selectedServices.some(isShopService) && selectedServices.some(isMobileService);
  const allShop = selectedServices.length > 0 && selectedServices.every(isShopService);
  const needsCustomerAddress = selectedServices.length > 0 && !allShop && !mixedFulfillment;
  const shopLocation =
    [
      storefront?.organization?.service_address,
      storefront?.organization?.service_city,
      storefront?.organization?.service_state,
      storefront?.organization?.service_postal_code,
    ]
      .filter(Boolean)
      .join(', ') ||
    selectedServices.find((s) => s.shop_location)?.shop_location ||
    '';

  const activeService = selectedServices[activeIndex] || null;
  const orgName = storefront?.organization?.name || 'this business';
  const backHref = `/customer/provider/${storefront?.organization?.public_ref || businessSlug}`;

  useEffect(() => {
    const saved = (user?.default_service_address || '').trim();
    if (saved && !serviceAddress) setServiceAddress(saved);
  }, [user?.default_service_address, serviceAddress]);

  useEffect(() => {
    if (!businessSlug) return undefined;
    let cancelled = false;
    setLoading(true);
    businessesAPI
      .getPublicStorefront(businessSlug)
      .then((res) => {
        if (!cancelled) setStorefront(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Provider not found.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessSlug]);

  const loadCalendar = useCallback(() => {
    if (!businessSlug || !activeService || !mayLoadCalendar || mustConnect || staffOfOrg) {
      setCalendar(null);
      return;
    }
    setCalendarFetching(true);
    businessesAPI
      .getServiceCalendar(businessSlug, activeService.id, { year, month })
      .then((res) => {
        setCalendar(res.data);
        const normalized = normalizeBookingCalendar(res.data);
        const days = normalized?.days || {};
        const firstAvailable = firstBookableDayKey(days);
        setSelectedDay((prev) => {
          if (prev && days[prev]?.status === 'available') return prev;
          return firstAvailable || null;
        });
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setCalendarFetching(false));
  }, [businessSlug, activeService, mayLoadCalendar, mustConnect, staffOfOrg, year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    setSelectedDay(null);
    setCalendar(null);
  }, [activeService?.id]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter(isSlotBookableForCustomer);
  }, [slotsByDay, selectedDay]);

  const allSlotsPicked =
    selectedServices.length > 0 &&
    selectedServices.every((s) => slotByServiceId[s.id]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await businessesAPI.connectToOrg(businessSlug);
      await refreshSession();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setConnecting(false);
    }
  };

  const pickSlot = (slot) => {
    if (!activeService) return;
    const taken = Object.entries(slotByServiceId).some(
      ([sid, s]) => Number(sid) !== Number(activeService.id) && s?.id === slot.id
    );
    if (taken) {
      setError('That time is already chosen for another service. Pick a different slot.');
      return;
    }
    setError(null);
    setSlotByServiceId((prev) => ({ ...prev, [activeService.id]: slot }));
  };

  const shiftMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  const submitAll = async () => {
    if (mixedFulfillment) {
      setError(
        'Mobile and in-shop services cannot be booked together. Go back and select one type only.'
      );
      return;
    }
    if (needsContact) {
      setError('Add your contact details before booking.');
      return;
    }
    if (needsCustomerAddress) {
      if (!serviceAddress.trim()) {
        setError('Please enter the job location for mobile services.');
        return;
      }
      const locationCheck = validateServiceLocationValue(serviceAddress);
      if (!locationCheck.valid) {
        setError(locationCheck.error || 'Please enter a valid postal code.');
        return;
      }
    }
    if (!allSlotsPicked) {
      setError('Pick a time for each selected service.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await jobsAPI.requestBookingsBatch({
        service_address: needsCustomerAddress ? serviceAddress.trim() : '',
        customer_notes: notes.trim(),
        bookings: selectedServices.map((svc) => ({
          slot_id: slotByServiceId[svc.id].id,
          service: svc.id,
          service_address: isShopService(svc)
            ? ''
            : serviceAddress.trim(),
        })),
      });
      showToast(
        `${selectedServices.length} booking${selectedServices.length === 1 ? '' : 's'} submitted.`,
        'success'
      );
      navigate(customerBookings(), { replace: true });
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !storefront) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error && !storefront) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!serviceIds.length || selectedServices.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select at least one service from the provider page first.
        </p>
        <Link
          to={backHref}
          className="inline-flex min-h-[44px] items-center font-medium text-luminexa-accent"
        >
          ← Back to {orgName}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <Link
          to={backHref}
          className="inline-flex min-h-[40px] items-center text-sm font-medium text-luminexa-accent"
        >
          ← {orgName}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          Book {selectedServices.length} services
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Shared location for the visit, then choose a time for each service.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {staffOfOrg && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Provider accounts cannot book their own services here.
        </section>
      )}

      {!staffOfOrg && mustConnect && (
        <section className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
          <p className="text-sm font-medium text-violet-900">Request access before booking</p>
          <button
            type="button"
            disabled={connecting}
            onClick={connect}
            className="mt-3 w-full min-h-[44px] rounded-lg bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {connecting ? 'Sending request…' : 'Request access'}
          </button>
        </section>
      )}

      {!staffOfOrg && !mustConnect && (
        <>
          {needsContact && (
            <BookingContactForm
              user={user}
              onSaved={(profile) => {
                setUserFromProfile(profile);
                setServiceAddress((profile.default_service_address || '').trim());
              }}
            />
          )}

          {!needsContact && mixedFulfillment && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Mixed service types</p>
              <p className="mt-1">
                Mobile and in-shop services cannot be booked in one checkout — they happen at
                different locations. Go back and select only mobile, or only in-shop.
              </p>
              <Link
                to={backHref}
                className="mt-3 inline-flex min-h-[40px] items-center text-sm font-medium text-amber-900 underline"
              >
                ← Back to services
              </Link>
            </section>
          )}

          {!needsContact && !mixedFulfillment && allShop && (
            <section className="lx-card">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Job location</h2>
              <p className="mt-1 text-sm text-slate-600">
                These are in-shop services. Come to this address for your appointments.
              </p>
              <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Come to the shop</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {shopLocation || 'Shop address will be confirmed by the business.'}
                </p>
              </div>
            </section>
          )}

          {!needsContact && !mixedFulfillment && needsCustomerAddress && (
            <BookingServiceLocationSection
              user={user}
              value={serviceAddress}
              onChange={setServiceAddress}
              label="Job location"
              hint="Where should the provider come for these jobs?"
            />
          )}

          {!needsContact && !mixedFulfillment && (
            <section className="lx-card">
              <label htmlFor="multi-notes" className="mb-1 block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="multi-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="lx-input"
                placeholder="Anything the provider should know for these jobs"
              />
            </section>
          )}

          {!needsContact && !mixedFulfillment && (
            <section className="lx-card">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Services &amp; times</h2>
              <ul className="mt-3 space-y-2">
                {selectedServices.map((svc, index) => {
                  const slot = slotByServiceId[svc.id];
                  const isActive = index === activeIndex;
                  return (
                    <li key={svc.id}>
                      <button
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left ${
                          isActive
                            ? 'border-luminexa-accent bg-teal-50/50 ring-1 ring-luminexa-accent/20'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {index + 1}. {svc.name}
                          </span>
                          {formatServiceMeta(svc) && (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {formatServiceMeta(svc)}
                            </span>
                          )}
                          {slot ? (
                            <span className="mt-1 block text-xs font-medium text-emerald-700">
                              {formatTimeRange(slot.start_at, slot.end_at)}
                            </span>
                          ) : (
                            <span className="mt-1 block text-xs text-amber-700">Pick a time</span>
                          )}
                        </span>
                        <span className="text-xs font-medium text-luminexa-accent">
                          {isActive ? 'Selecting…' : slot ? 'Change' : 'Select'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!needsContact && !mixedFulfillment && activeService && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase text-slate-500">
                Time for {activeService.name}
              </h2>
              {calendarFetching && !calendar ? (
                <p className="text-sm text-slate-500">Loading calendar…</p>
              ) : (
                <>
                  <BookingCalendar
                    year={year}
                    month={month}
                    days={calendarDays}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    onPrevMonth={() => shiftMonth(-1)}
                    onNextMonth={() => shiftMonth(1)}
                    openOnly
                  />
                  {selectedDay && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Times on {selectedDay}</p>
                      {daySlots.length === 0 ? (
                        <p className="text-sm text-slate-500">No open times this day.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map((slot) => {
                            const picked = slotByServiceId[activeService.id]?.id === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => pickSlot(slot)}
                                className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                                  picked
                                    ? 'bg-luminexa-accent text-white'
                                    : 'border border-slate-200 bg-white text-slate-800 hover:border-luminexa-accent'
                                }`}
                              >
                                {formatTimeRange(slot.start_at, slot.end_at)}
                                {Number(slot.capacity) > 1 && Number(slot.remaining_capacity) > 0
                                  ? ` · ${slot.remaining_capacity} left`
                                  : ''}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-medium disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= selectedServices.length - 1}
                  onClick={() =>
                    setActiveIndex((i) => Math.min(selectedServices.length - 1, i + 1))
                  }
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-medium disabled:opacity-40"
                >
                  Next service
                </button>
              </div>
            </section>
          )}

          {!needsContact && !mixedFulfillment && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <button
                type="button"
                disabled={submitting || !allSlotsPicked}
                onClick={submitAll}
                className="lx-btn-primary w-full min-h-[52px] rounded-xl disabled:opacity-60"
              >
                {submitting
                  ? 'Submitting…'
                  : allSlotsPicked
                    ? `Confirm ${selectedServices.length} bookings`
                    : `Pick times (${Object.keys(slotByServiceId).length}/${selectedServices.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
