import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import BookingContactForm from '../../components/BookingContactForm';
import CustomerServiceDetailsForm from '../../components/customer/CustomerServiceDetailsForm';
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
import { policyLabel } from '../../constants/bookingPolicies';
import { Link } from 'react-router-dom';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import { serviceDetail } from '../../utils/customerPaths';
import { formatServiceMeta } from '../../utils/serviceDisplay';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Request failed.';
}

export default function CustomerBookServicePage() {
  const { orgSlug, slug, serviceId } = useParams();
  const businessSlug = orgSlug || slug;
  const { memberships, user, setUserFromProfile, refreshSession } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [storefront, setStorefront] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [serviceLabel, setServiceLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  const membership = getCustomerMembership(memberships, businessSlug);
  const staffOfOrg = isOrgStaff(memberships, businessSlug);
  const bookingPolicy = storefront?.booking_policy;
  const connection = customerConnectionState(bookingPolicy, membership);
  const mustConnect = needsExplicitConnect(bookingPolicy) && connection === 'disconnected';
  const mayLoadCalendar = canViewBookingCalendar({
    isAuthenticated: true,
    isStaff: staffOfOrg,
  });

  const listedService = useMemo(() => {
    const list = storefront?.services || [];
    return list.find((s) => String(s.id) === String(serviceId));
  }, [storefront?.services, serviceId]);

  useEffect(() => {
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
    if (!mayLoadCalendar || mustConnect) return;
    setLoading(true);
    setError(null);
    businessesAPI
      .getServiceCalendar(businessSlug, serviceId, { year, month })
      .then((res) => {
        setCalendar(res.data);
        const days = res.data?.days || {};
        const firstAvailable = Object.keys(days).find((k) => days[k].status === 'available');
        setSelectedDay((prev) => {
          if (prev && days[prev]?.status === 'available') return prev;
          return firstAvailable || null;
        });
      })
      .catch((e) => {
        setError(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, [mayLoadCalendar, mustConnect, businessSlug, serviceId, year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const service = calendar?.service || listedService;
  const bookingCtx = calendar?.booking;
  const canBook = bookingCtx?.can_book ?? false;
  const needsContact = !user?.has_booking_contact;

  useEffect(() => {
    if (service?.name && !serviceLabel) {
      setServiceLabel(service.name);
    }
  }, [service?.name, serviceLabel]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await businessesAPI.connectToOrg(businessSlug);
      await refreshSession();
      const status = res.data?.customer_status;
      if (status === 'pending') {
        setMessage('Access request sent. Once the business approves you, you can book a slot.');
      } else {
        setMessage('Connected! Pick a date and time below.');
      }
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setConnecting(false);
    }
  };

  const openOnlyDays = useMemo(() => {
    const days = calendar?.days || {};
    const out = {};
    for (const [key, meta] of Object.entries(days)) {
      if (meta?.status === 'available') out[key] = meta;
    }
    return out;
  }, [calendar]);

  const slotsForDay = useMemo(() => {
    if (!selectedDay || !calendar?.slots_by_day) return [];
    return (calendar.slots_by_day[selectedDay] || []).filter((s) => s.available);
  }, [calendar, selectedDay]);

  const requestSlot = async (slot) => {
    const detail = notes.trim();
    if (detail.length < 10) {
      setError('Please describe what you need in at least 10 characters (Job details section).');
      return;
    }
    if (!serviceAddress.trim()) {
      setError('Please enter the service location.');
      return;
    }
    setSubmittingId(slot.id);
    setError(null);
    try {
      const label = serviceLabel.trim();
      const combinedNotes = [label && `Service: ${label}`, detail].filter(Boolean).join('\n\n');
      await jobsAPI.requestBooking({
        slot_id: slot.id,
        service: Number(serviceId),
        customer_notes: combinedNotes,
        service_address: serviceAddress.trim(),
      });
      const instant = bookingCtx?.instant_confirm;
      setMessage(
        instant
          ? 'Booking confirmed!'
          : 'Request sent. You will see it confirmed once the business accepts.'
      );
      setNotes('');
      loadCalendar();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmittingId(null);
    }
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

  if (loading && !storefront && !calendar) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error && !storefront) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
    );
  }

  return (
    <div className="space-y-4">
      {service && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex gap-4">
            {service.image_url && (
              <img src={service.image_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{service.name}</h1>
              {service.rating_summary?.count > 0 && (
                <div className="mt-2">
                  <ServiceRatingSummary summary={service.rating_summary} compact />
                </div>
              )}
              <Link
                to={serviceDetail(businessSlug, service.id)}
                className="mt-2 inline-block text-sm font-medium text-luminexa-accent"
              >
                Show full details →
              </Link>
              {formatServiceMeta(service) && (
                <p className="mt-2 text-sm text-slate-500">{formatServiceMeta(service)}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {bookingPolicy && (
        <p className="text-xs text-slate-500">{policyLabel(bookingPolicy)}</p>
      )}

      {staffOfOrg && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">You&apos;re signed in as this business</p>
          <p className="mt-1 text-amber-800">
            Provider accounts cannot book their own services here. Sign out and use a customer
            account, or share your booking link for others to book.
          </p>
        </section>
      )}

      {!staffOfOrg && mustConnect && (
        <section className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
          <p className="text-sm font-medium text-violet-900">Request access before booking</p>
          <p className="mt-1 text-sm text-violet-800">
            This business reviews customers first. Send an access request, then book a slot after
            they approve you.
          </p>
          <button
            type="button"
            disabled={connecting}
            onClick={connect}
            className="mt-4 w-full min-h-[44px] rounded-lg bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {connecting ? 'Sending request…' : 'Request access'}
          </button>
        </section>
      )}

      {!staffOfOrg && !mustConnect && connection === 'implicit' && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sign in is all you need — pick a date and time below to book.
        </p>
      )}

      {message && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!staffOfOrg && !mustConnect && (
        <>
          {needsContact && (
            <BookingContactForm
              user={user}
              onSaved={(profile) => {
                setUserFromProfile(profile);
                setMessage('Contact details saved.');
                loadCalendar();
              }}
            />
          )}

          {connection === 'pending' && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Awaiting approval — you can view open times, but booking unlocks once the business
              approves your connection.
            </p>
          )}

          {!needsContact && canBook && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Job details</h2>
              <p className="mt-1 text-sm text-slate-600">
                Tell the business exactly what you need before you pick a time.
              </p>
              <div className="mt-3">
                <CustomerServiceDetailsForm
                  serviceLabel={serviceLabel}
                  onServiceLabelChange={setServiceLabel}
                  message={notes}
                  onMessageChange={setNotes}
                  serviceAddress={serviceAddress}
                  onServiceAddressChange={setServiceAddress}
                  showServiceLabel
                  compact
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Choose a date</h2>
            {loading && !calendar ? (
              <p className="text-sm text-slate-500">Loading calendar…</p>
            ) : (
              <BookingCalendar
                year={year}
                month={month}
                days={openOnlyDays}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onPrevMonth={() => shiftMonth(-1)}
                onNextMonth={() => shiftMonth(1)}
                openOnly
              />
            )}
          </section>

          {selectedDay && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">
                Available times —{' '}
                {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              {slotsForDay.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No open slots this day.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slotsForDay.map((slot) => (
                    <li key={slot.id}>
                      {canBook && !needsContact ? (
                        <button
                          type="button"
                          disabled={submittingId === slot.id}
                          onClick={() => requestSlot(slot)}
                          className="w-full min-h-[44px] rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {submittingId === slot.id
                            ? 'Booking…'
                            : formatTimeRange(slot.start_at, slot.end_at)}
                        </button>
                      ) : (
                        <span className="block rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
                          {formatTimeRange(slot.start_at, slot.end_at)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
