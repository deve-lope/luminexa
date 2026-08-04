import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BusinessTypeSelector from '../components/business/BusinessTypeSelector';
import AddressFields from '../components/location/AddressFields';
import { businessesAPI, userAPI } from '../utils/api';
import { BOOKING_POLICIES } from '../constants/bookingPolicies';
import BackButton from '../components/navigation/BackButton';
import PasswordInput from '../components/ui/PasswordInput';

const BENEFITS = [
  'Publish services and prices customers can see before they book',
  'Open your calendar and take real requests — not endless phone tag',
  'Message customers, complete jobs, and issue invoices in one place',
];

export default function RegisterBusinessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [types, setTypes] = useState([]);
  const [email, setEmail] = useState(() => location.state?.email || '');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [bookingPolicy, setBookingPolicy] = useState('approval');
  const [concurrentCapacity, setConcurrentCapacity] = useState(1);
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [serviceCity, setServiceCity] = useState('');
  const [servicePostalCode, setServicePostalCode] = useState('');
  const [serviceState, setServiceState] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    businessesAPI
      .listBusinessTypes({ for_registration: true })
      .then((res) => setTypes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load business types.'));
  }, []);

  const needsOfficeAddress = useMemo(
    () =>
      selectedSlugs.some((slug) => {
        const t = types.find((x) => x.slug === slug);
        return t && (t.location_kind === 'office' || t.requires_business_address);
      }),
    [selectedSlugs, types]
  );

  useEffect(() => {
    if (!needsOfficeAddress) {
      setServiceCity('');
      setServicePostalCode('');
      setServiceState('');
      setServiceAddress('');
    }
  }, [needsOfficeAddress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedSlugs.length) {
      setError('Select at least one business type.');
      return;
    }
    if (needsOfficeAddress) {
      if (serviceCity.trim().length < 2) {
        setError('Enter your business office / home city for billing.');
        return;
      }
      if (!servicePostalCode.trim()) {
        setError('Enter your business office / home postal code for billing.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        email,
        full_name: fullName,
        password,
        business_name: businessName,
        booking_policy: bookingPolicy,
        concurrent_capacity: Math.max(1, Math.min(50, Number(concurrentCapacity) || 1)),
        business_type_slugs: selectedSlugs,
      };
      if (phone.trim()) payload.phone = phone.trim();
      if (needsOfficeAddress) {
        payload.service_city = serviceCity.trim();
        payload.service_postal_code = servicePostalCode.trim();
        payload.service_state = serviceState.trim();
        if (serviceAddress.trim()) payload.service_address = serviceAddress.trim();
      }
      const { data } = await userAPI.registerBusiness(payload);
      navigate('/check-email', {
        replace: true,
        state: { email: data.email || email, kind: 'business' },
      });
    } catch (err) {
      const d = err.response?.data;
      const msg =
        d?.service_city?.[0] ||
        d?.service_postal_code?.[0] ||
        d?.business_type_slugs?.[0] ||
        d?.business_name?.[0] ||
        d?.booking_policy?.[0] ||
        d?.email?.[0] ||
        d?.detail ||
        (typeof d === 'string' ? d : 'Registration failed.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas bg-lx-mesh text-slate-900 lg:h-[100dvh] lg:overflow-hidden">
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl lg:h-full lg:grid-cols-12">
        <aside className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 px-6 py-8 text-white lg:col-span-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute -right-16 top-20 h-56 w-56 rounded-full bg-teal-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-10 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative flex min-h-full flex-col">
            <Link to="/" className="text-lg font-extrabold tracking-tight">
              Luminexa
            </Link>

            <div className="mt-10 lg:mt-16">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/90">
                For providers
              </p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Put your business where customers can book you.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-teal-50/85 sm:text-base">
                Join Luminexa to publish what you offer, open your schedule, and take bookings with
                clear prices — built for lawn crews, cleaners, mobile techs, and local trades.
              </p>
            </div>

            <ul className="mt-8 hidden space-y-4 lg:block">
              {BENEFITS.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-teal-50/90">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-200" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-auto hidden pt-10 text-sm text-teal-100/70 lg:block">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-white underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </aside>

        <main className="bg-luminexa-canvas lg:col-span-7 lg:h-full lg:overflow-y-auto lg:overscroll-contain">
          <div className="px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <BackButton
              fallback="/"
              className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 hover:text-teal-700"
            >
              ← Back
            </BackButton>

            <div className="mb-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Register your business
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
                Choose office or mobile categories. Office businesses add a home / office address for
                billing; mobile services skip the address.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <p
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                  Business
                </h3>
                <div className="mt-4">
                  <label htmlFor="business_name" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Business name
                  </label>
                  <input
                    id="business_name"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. GreenLine Lawn Co."
                    className="lx-input"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                  How customers book
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
                  Choose the booking flow for this business. You can change this later in settings.
                </p>
                <div className="mt-4 space-y-3">
                  {BOOKING_POLICIES.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                        bookingPolicy === opt.value
                          ? 'border-teal-500 bg-teal-50/80 ring-1 ring-teal-500/30'
                          : 'border-slate-200 bg-slate-50/50 hover:border-teal-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="booking_policy"
                        value={opt.value}
                        checked={bookingPolicy === opt.value}
                        onChange={(e) => setBookingPolicy(e.target.value)}
                        className="mt-1 accent-teal-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 sm:text-sm">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <label
                    htmlFor="register-concurrent-capacity"
                    className="block text-sm font-semibold text-slate-900"
                  >
                    Jobs at the same time
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    How many jobs can overlap on one time slot. Set to 2 if you can run two
                    appointments in parallel. You can change this later in settings.
                  </p>
                  <input
                    id="register-concurrent-capacity"
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={concurrentCapacity}
                    onChange={(e) => setConcurrentCapacity(e.target.value)}
                    className="lx-input mt-3 max-w-[10rem]"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                  What you offer
                </h3>
                <p className="mt-2 mb-4 text-xs leading-relaxed text-slate-500 sm:text-sm">
                  Select categories customers should use to find you. Office types need a billing
                  address; mobile types do not.
                </p>
                <BusinessTypeSelector
                  types={types}
                  onTypesChange={setTypes}
                  selectedSlugs={selectedSlugs}
                  onSelectionChange={setSelectedSlugs}
                  variant="light"
                  allowCreate
                />
              </section>

              {needsOfficeAddress && (
                <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                    Business office address
                  </h3>
                  <p className="mt-2 mb-4 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    Your fixed office or home address is used for billing and tax. Customers still book
                    services at their location when you travel.
                  </p>
                  <AddressFields
                    postalCode={servicePostalCode}
                    onPostalCodeChange={setServicePostalCode}
                    city={serviceCity}
                    onCityChange={setServiceCity}
                    state={serviceState}
                    onStateChange={setServiceState}
                    address={serviceAddress}
                    onAddressChange={setServiceAddress}
                    postalLabel="PIN / postal code"
                    cityLabel="City"
                    stateLabel="Province / state"
                    streetLabel="Street address (optional)"
                    inputClassName="lx-input"
                  />
                </section>
              )}

              <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                  Your account
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Your name
                    </label>
                    <input
                      id="full_name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="lx-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="lx-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Mobile <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="lx-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <PasswordInput
                      id="password"
                      variant="light"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={submitting}
                className="lx-btn-primary w-full min-h-[52px] rounded-xl text-base disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create business account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Booking as a customer?{' '}
              <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-800">
                Create customer account
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-slate-500 lg:hidden">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
                Sign in
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
