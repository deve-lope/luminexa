import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BookingContactForm from '../../components/BookingContactForm';
import BookingServiceLocationSection from '../../components/customer/BookingServiceLocationSection';
import CustomerServiceDetailsForm from '../../components/customer/CustomerServiceDetailsForm';
import {
  validateServiceLocationValue,
} from '../../components/customer/ServiceLocationInput';
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
import { customerPolicyLabel } from '../../constants/bookingPolicies';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import { serviceDetail, customerBookings } from '../../utils/customerPaths';
import { formatServiceMeta, formatFulfillmentDescription, isShopService, serviceRequiresQuote } from '../../utils/serviceDisplay';
import { calendarDataForMonth, firstBookableDayKey, normalizeBookingCalendar } from '../../utils/slotCalendar';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../contexts/ToastContext';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Request failed.';
}

export default function CustomerBookServicePage() {
  const { orgSlug, slug, providerKey, serviceId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const businessSlug = providerKey || orgSlug || slug;
  const { memberships, user, setUserFromProfile, refreshSession } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [storefront, setStorefront] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [calendarFetching, setCalendarFetching] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [serviceLabel, setServiceLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceAddress, setServiceAddress] = useState(
    () => (user?.default_service_address || '').trim()
  );
  const [quoteAnswers, setQuoteAnswers] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingConfirmSlot, setBookingConfirmSlot] = useState(null);
  const [successPopup, setSuccessPopup] = useState(null);
  const [alertPopup, setAlertPopup] = useState(null);
  const confirmPanelRef = useRef(null);

  useEffect(() => {
    const saved = (user?.default_service_address || '').trim();
    if (saved && !serviceAddress) {
      setServiceAddress(saved);
    }
  }, [user?.default_service_address, serviceAddress]);

  useEffect(() => {
    setSelectedSlot(null);
    setBookingConfirmSlot(null);
  }, [selectedDay, year, month]);

  const membership = getCustomerMembership(memberships, businessSlug);
  const staffOfOrg = isOrgStaff(memberships, businessSlug);
  const bookingPolicy = storefront?.booking_policy;
  const connectionFromMembership = customerConnectionState(bookingPolicy, membership);
  const mustConnect =
    needsExplicitConnect(bookingPolicy) && connectionFromMembership === 'disconnected';
  const mayLoadCalendar = canViewBookingCalendar({
    isAuthenticated: true,
    isStaff: staffOfOrg,
  });

  const listedService = useMemo(() => {
    const list = storefront?.services || [];
    return list.find((s) => String(s.id) === String(serviceId));
  }, [storefront?.services, serviceId]);

  const serviceIsShop = isShopService(listedService || calendar?.service);
  const shopLocation =
    (listedService || calendar?.service)?.shop_location ||
    [
      storefront?.organization?.service_address,
      storefront?.organization?.service_city,
      storefront?.organization?.service_state,
      storefront?.organization?.service_postal_code,
    ]
      .filter(Boolean)
      .join(', ');

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
    setCalendarFetching(true);
    setCalendarError(null);
    businessesAPI
      .getServiceCalendar(businessSlug, serviceId, { year, month })
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
      .catch((e) => {
        const msg = parseApiError(e);
        setCalendarError(msg);
        setError(msg);
      })
      .finally(() => setCalendarFetching(false));
  }, [mayLoadCalendar, mustConnect, businessSlug, serviceId, year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const service = calendar?.service || listedService;
  const bookingCtx = calendar?.booking;
  const requiresQuote =
    Boolean(bookingCtx?.requires_quote) ||
    serviceRequiresQuote(service) ||
    bookingPolicy === 'quote';
  const quoteQuestionList = useMemo(() => {
    const fromCtx = bookingCtx?.service_quote_questions;
    const fromService = service?.quote_questions;
    const raw = Array.isArray(fromCtx) && fromCtx.length
      ? fromCtx
      : Array.isArray(fromService)
        ? fromService
        : [];
    return raw
      .map((q) => (typeof q === 'string' ? q : q?.question || ''))
      .map((q) => q.trim())
      .filter(Boolean);
  }, [bookingCtx?.service_quote_questions, service?.quote_questions]);

  useEffect(() => {
    setQuoteAnswers((prev) => {
      const next = {};
      quoteQuestionList.forEach((q, i) => {
        const key = `q${i + 1}`;
        next[key] = prev[key] || '';
      });
      return next;
    });
  }, [quoteQuestionList]);

  const canBook = bookingCtx?.can_book ?? false;
  const needsContact = !user?.has_booking_contact;
  const connection =
    bookingCtx?.is_blocked || connectionFromMembership === 'blocked'
      ? 'blocked'
      : connectionFromMembership;

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

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const calendarInSync = calendar?.year === year && calendar?.month === month;
  const hasOpenDays = useMemo(
    () => Object.values(calendarDays).some((d) => d?.status === 'available'),
    [calendarDays]
  );

  const slotsForDay = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((s) => s.available);
  }, [slotsByDay, selectedDay]);

  const canSubmitBooking = canBook && !needsContact;
  const selectedDayLabel = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const scrollToConfirmPanel = useCallback(() => {
    window.setTimeout(() => {
      confirmPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const showAlertPopup = useCallback((messageText) => {
    if (!messageText) return;
    setAlertPopup({
      title: 'Complete required details',
      message: messageText,
    });
  }, []);

  const validateBookingDetails = useCallback(() => {
    if (!serviceIsShop) {
      if (!serviceAddress.trim()) {
        showAlertPopup('Please enter the job location where the provider should come.');
        return false;
      }
      const locationCheck = validateServiceLocationValue(serviceAddress);
      if (!locationCheck.valid) {
        showAlertPopup(locationCheck.error || 'Please enter a valid postal code.');
        return false;
      }
    }
    if (requiresQuote && quoteQuestionList.length) {
      const missing = quoteQuestionList.find((_, i) => !(quoteAnswers[`q${i + 1}`] || '').trim());
      if (missing) {
        showAlertPopup(`Please answer: ${missing}`);
        return false;
      }
    }
    if (!canSubmitBooking) {
      showAlertPopup('Complete the steps above before booking.');
      return false;
    }
    return true;
  }, [
    serviceAddress,
    canSubmitBooking,
    showAlertPopup,
    serviceIsShop,
    requiresQuote,
    quoteQuestionList,
    quoteAnswers,
  ]);

  const handleSlotTap = useCallback(
    (slot) => {
      setError(null);
      setSelectedSlot(slot);
      scrollToConfirmPanel();
    },
    [scrollToConfirmPanel]
  );

  const promptBookingConfirm = useCallback(
    (slot) => {
      if (!slot || !validateBookingDetails()) return;
      setBookingConfirmSlot(slot);
    },
    [validateBookingDetails]
  );

  const requestSlot = useCallback(
    async (slot) => {
      if (!slot) return;

      setSubmittingId(slot.id);
      setError(null);
      try {
        const label = serviceLabel.trim();
        const detail = notes.trim();
        const combinedNotes = [label && `Service: ${label}`, detail].filter(Boolean).join('\n\n');
        await jobsAPI.requestBooking({
          slot_id: slot.id,
          service: Number(serviceId),
          customer_notes: combinedNotes,
          service_address: serviceIsShop ? '' : serviceAddress.trim(),
          quote_answers: requiresQuote
            ? quoteQuestionList.map((question, i) => ({
                id: `q${i + 1}`,
                question,
                answer: (quoteAnswers[`q${i + 1}`] || '').trim(),
              }))
            : undefined,
        });
        const instant = bookingCtx?.instant_confirm && !requiresQuote;
        const quote = requiresQuote;
        const successTitle = instant ? 'Booking confirmed' : 'Request sent';
        const successMessage = instant
          ? 'Your appointment is confirmed.'
          : quote
            ? 'Your time request was sent. Watch Bookings for a quote you can accept or decline.'
            : 'Your booking request was sent to the provider for approval.';
        const successDetail = `${selectedDayLabel} · ${formatTimeRange(slot.start_at, slot.end_at)}`;
        const toastMessage = instant
          ? `Booking confirmed for ${successDetail}`
          : `Request sent for ${successDetail}`;

        setMessage(
          instant
            ? `Booking confirmed for ${successDetail}.`
            : quote
              ? `Request sent for ${successDetail}. You'll get a quote to review in Bookings.`
              : `Request sent for ${successDetail}. The provider will confirm your appointment.`
        );
        showToast(toastMessage, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSuccessPopup({
          title: successTitle,
          message: `${successMessage}\n\n${successDetail}`,
        });
        setNotes('');
        setQuoteAnswers({});
        setSelectedSlot(null);
        loadCalendar();
      } catch (e) {
        showAlertPopup(parseApiError(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [
      notes,
      serviceLabel,
      serviceId,
      serviceAddress,
      bookingCtx?.instant_confirm,
      requiresQuote,
      quoteQuestionList,
      quoteAnswers,
      selectedDayLabel,
      loadCalendar,
      showAlertPopup,
      showToast,
      serviceIsShop,
    ]
  );

  const bookingConfirmLabel = bookingConfirmSlot
    ? `${selectedDayLabel} · ${formatTimeRange(bookingConfirmSlot.start_at, bookingConfirmSlot.end_at)}`
    : '';

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
        <section className="lx-card">
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
              <p className="mt-2 text-sm font-medium text-slate-700">
                {formatFulfillmentDescription(service)}
              </p>
            </div>
          </div>
        </section>
      )}

      {bookingPolicy && customerPolicyLabel(bookingPolicy) && (
        <p className="text-xs text-slate-500">{customerPolicyLabel(bookingPolicy)}</p>
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
          Pick a date and time below, then complete your booking details.
        </p>
      )}

      {message && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          <p className="font-semibold">{message}</p>
          <Link to={customerBookings()} className="mt-2 inline-block font-medium text-emerald-700 underline">
            View my bookings
          </Link>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!staffOfOrg && !mustConnect && (
        <>
          {needsContact && (
            <BookingContactForm
              user={user}
              onSaved={(profile) => {
                setUserFromProfile(profile);
                setServiceAddress((profile.default_service_address || '').trim());
                setMessage('Contact details saved.');
                loadCalendar();
              }}
            />
          )}

          {connection === 'blocked' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              You cannot book with this business. Contact them if you think this is a mistake.
            </p>
          )}

          {connection === 'pending' && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This business reviews new customers. Pick a time and send a booking request — they
              will accept or decline it.
            </p>
          )}

          {!needsContact && serviceIsShop && (
            <section className="lx-card">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Job location</h2>
              <p className="mt-1 text-sm text-slate-600">
                This is an in-shop service. Come to this address for your appointment.
              </p>
              <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Come to the shop</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {shopLocation || 'Shop address will be confirmed by the business.'}
                </p>
              </div>
            </section>
          )}

          {!needsContact && !serviceIsShop && (
            <BookingServiceLocationSection
              user={user}
              value={serviceAddress}
              onChange={setServiceAddress}
              label="Job location"
              hint="Where should the provider come for this job?"
            />
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Choose a date</h2>
            {calendarFetching ? (
              <p className="text-sm text-slate-500">Loading calendar…</p>
            ) : !calendarInSync ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{calendarError || 'Could not load availability.'}</p>
                {calendarError && (
                  <p className="mt-2 text-xs text-red-600">
                    On your phone, open the app using your computer&apos;s network address (e.g.
                    http://192.168.x.x:3000), not localhost.
                  </p>
                )}
                <button
                  type="button"
                  onClick={loadCalendar}
                  className="mt-3 min-h-[44px] rounded-lg bg-red-100 px-4 text-sm font-medium text-red-800"
                >
                  Try again
                </button>
              </div>
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
                {!hasOpenDays && (
                  <p className="mt-3 text-sm text-slate-500">
                    No open appointments this month. Try another month or ask the business to add
                    availability.
                  </p>
                )}
              </>
            )}
          </section>

          {selectedDay && (
            <section className="lx-card">
              <h3 className="text-sm font-semibold text-slate-800">
                Available times —{' '}
                {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Times already started, or starting within the next 2 hours, are not available to book.
              </p>
              {slotsForDay.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No open slots this day.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slotsForDay.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <li key={slot.id}>
                        <button
                          type="button"
                          onClick={() => handleSlotTap(slot)}
                          className={`w-full min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                            isSelected
                              ? 'border-violet-600 bg-violet-50 text-violet-900 ring-2 ring-violet-200'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-violet-300 hover:bg-violet-50/50'
                          }`}
                        >
                          <span className="block">{formatTimeRange(slot.start_at, slot.end_at)}</span>
                          {Number(slot.capacity) > 1 && Number(slot.remaining_capacity) > 0 && (
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                              {slot.remaining_capacity} of {slot.capacity} spots left
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {selectedSlot && (
            <section
              ref={confirmPanelRef}
              className="lx-card space-y-4 border-2 border-violet-200 scroll-mt-24"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Complete your booking</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Selected time:{' '}
                  <span className="font-medium text-slate-800">
                    {selectedDayLabel}{' '}
                    · {formatTimeRange(selectedSlot.start_at, selectedSlot.end_at)}
                  </span>
                </p>
              </div>

              {needsContact && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Add your phone number in the contact section above to continue.
                </div>
              )}

              <CustomerServiceDetailsForm
                serviceLabel={serviceLabel}
                onServiceLabelChange={setServiceLabel}
                message={notes}
                onMessageChange={setNotes}
                serviceAddress={serviceAddress}
                onServiceAddressChange={setServiceAddress}
                showServiceLabel
                showLocation={false}
                showAddressPreview={Boolean((serviceAddress || '').trim())}
                compact
                requireMessage={false}
              />

              {requiresQuote && quoteQuestionList.length > 0 && (
                <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                    Details for your quote
                  </p>
                  {quoteQuestionList.map((question, i) => {
                    const key = `q${i + 1}`;
                    return (
                      <div key={key}>
                        <label htmlFor={`quote-ans-${key}`} className="mb-1 block text-sm font-medium text-slate-800">
                          {question}
                        </label>
                        <textarea
                          id={`quote-ans-${key}`}
                          rows={2}
                          value={quoteAnswers[key] || ''}
                          onChange={(e) =>
                            setQuoteAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Your answer"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {!canSubmitBooking && connection === 'blocked' && (
                <p className="text-sm text-red-800">
                  You cannot book with this business.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={submittingId != null}
                  onClick={() => promptBookingConfirm(selectedSlot)}
                  className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60"
                >
                  {submittingId === selectedSlot.id
                    ? 'Booking…'
                    : bookingCtx?.instant_confirm && !requiresQuote
                      ? 'Confirm booking'
                      : 'Request appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="lx-btn-ghost min-h-[48px]"
                >
                  Change time
                </button>
              </div>

            </section>
          )}

          {selectedSlot && (
            <div className="fixed inset-x-0 bottom-20 z-40 px-4 sm:hidden">
              <div className="mx-auto max-w-lg rounded-2xl border border-violet-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Time selected
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedDayLabel} · {formatTimeRange(selectedSlot.start_at, selectedSlot.end_at)}
                </p>
                <button
                  type="button"
                  onClick={scrollToConfirmPanel}
                  className="lx-btn-primary mt-3 min-h-[44px] w-full"
                >
                  Review & confirm booking
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!bookingConfirmSlot}
        title={
          bookingCtx?.instant_confirm && !requiresQuote
            ? 'Confirm booking?'
            : 'Send booking request?'
        }
        message={`Book ${service?.name || 'this service'} for:\n\n${bookingConfirmLabel}`}
        confirmLabel={
          bookingCtx?.instant_confirm && !requiresQuote ? 'Confirm booking' : 'Send request'
        }
        cancelLabel="Go back"
        tone="default"
        busy={submittingId != null}
        onConfirm={() => {
          const slot = bookingConfirmSlot;
          setBookingConfirmSlot(null);
          requestSlot(slot);
        }}
        onClose={() => !submittingId && setBookingConfirmSlot(null)}
      />
      <ConfirmDialog
        open={!!successPopup}
        title={successPopup?.title}
        message={successPopup?.message}
        confirmLabel="View my bookings"
        cancelLabel="OK"
        tone="success"
        onConfirm={() => {
          setSuccessPopup(null);
          navigate(customerBookings());
        }}
        onClose={() => setSuccessPopup(null)}
      />
      <ConfirmDialog
        open={!!alertPopup}
        title={alertPopup?.title}
        message={alertPopup?.message}
        confirmLabel="OK"
        cancelLabel=""
        tone="default"
        onConfirm={() => setAlertPopup(null)}
        onClose={() => setAlertPopup(null)}
      />
    </div>
  );
}
