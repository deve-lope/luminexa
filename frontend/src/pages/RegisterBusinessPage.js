import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BusinessTypeSelector from '../components/business/BusinessTypeSelector';
import { businessesAPI, userAPI } from '../utils/api';
import { storage } from '../utils/helpers';
import { providerHome } from '../utils/providerPaths';
import AddressFields from '../components/location/AddressFields';
import { BOOKING_POLICIES } from '../constants/bookingPolicies';
import BackButton from '../components/navigation/BackButton';

export default function RegisterBusinessPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [types, setTypes] = useState([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [bookingPolicy, setBookingPolicy] = useState('approval');
  const [serviceCity, setServiceCity] = useState('');
  const [servicePostalCode, setServicePostalCode] = useState('');
  const [serviceState, setServiceState] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    businessesAPI
      .listBusinessTypes({ for_registration: true })
      .then((res) => setTypes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load business types.'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedSlugs.length) {
      setError('Select at least one business type.');
      return;
    }
    if (!serviceCity.trim()) {
      setError('Enter the city where you provide services.');
      return;
    }
    if (!servicePostalCode.trim()) {
      setError('Enter the PIN / postal code for your service area.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        email,
        full_name: fullName,
        password,
        business_name: businessName,
        booking_policy: bookingPolicy,
        business_type_slugs: selectedSlugs,
        service_city: serviceCity.trim(),
        service_postal_code: servicePostalCode.replace(/[\s-]+/g, '').toUpperCase(),
      };
      if (serviceState.trim()) payload.service_state = serviceState.trim();
      if (serviceAddress.trim()) payload.service_address = serviceAddress.trim();
      if (phone.trim()) payload.phone = phone.trim();
      const { data } = await userAPI.registerBusiness(payload);
      storage.set('token', data.token);
      await refreshSession();
      const slug = data.organization?.slug;
      if (slug) {
        navigate(providerHome(slug), { replace: true });
      } else {
        navigate('/provider', { replace: true });
      }
    } catch (err) {
      const d = err.response?.data;
      const msg =
        d?.business_type_slugs?.[0] ||
        d?.business_name?.[0] ||
        d?.booking_policy?.[0] ||
        d?.service_postal_code?.[0] ||
        d?.service_city?.[0] ||
        d?.email?.[0] ||
        d?.detail ||
        (typeof d === 'string' ? d : 'Registration failed.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-luminexa-navy px-4 py-10 text-luminexa-mist">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-luminexa-slate/80 p-8 shadow-xl backdrop-blur">
        <BackButton fallback="/" className="mb-6 inline-block text-sm text-luminexa-mist/60 hover:text-luminexa-mist">
          ← Back
        </BackButton>
        <h1 className="mb-2 text-2xl font-bold">Register your business</h1>
        <p className="mb-6 text-sm text-luminexa-mist/65">
          Choose what kind of services you offer. Customers will find you by category.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <div>
            <label htmlFor="business_name" className="mb-1 block text-sm font-medium">
              Business name
            </label>
            <input
              id="business_name"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>

          <fieldset className="space-y-3 rounded-lg border border-white/10 p-4">
            <legend className="px-1 text-sm font-medium">How customers book</legend>
            <p className="text-xs text-luminexa-mist/60">
              Choose the booking flow you want for this business. You can change this later from
              Share settings.
            </p>
            {BOOKING_POLICIES.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-luminexa-navy/50 p-3 has-[:checked]:border-luminexa-accent"
              >
                <input
                  type="radio"
                  name="booking_policy"
                  value={opt.value}
                  checked={bookingPolicy === opt.value}
                  onChange={(e) => setBookingPolicy(e.target.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-luminexa-mist">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-luminexa-mist/65">
                    {opt.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-white/10 p-4">
            <legend className="px-1 text-sm font-medium">Service location</legend>
            <p className="text-xs text-luminexa-mist/60">
              Customers find you by PIN / postal code and city. Pin your service area on the map.
            </p>
            <AddressFields
              dark
              postalCode={servicePostalCode}
              onPostalCodeChange={setServicePostalCode}
              city={serviceCity}
              onCityChange={setServiceCity}
              state={serviceState}
              onStateChange={setServiceState}
              address={serviceAddress}
              onAddressChange={setServiceAddress}
            />
          </fieldset>
          <BusinessTypeSelector
            types={types}
            onTypesChange={setTypes}
            selectedSlugs={selectedSlugs}
            onSelectionChange={setSelectedSlugs}
            variant="dark"
          />
          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium">Your name</label>
            <input
              id="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Mobile <span className="text-luminexa-mist/50">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-lg bg-luminexa-accent font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create business account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-luminexa-mist/60">
          Booking as a customer?{' '}
          <Link to="/register" className="font-medium text-luminexa-accent">
            Create customer account
          </Link>
        </p>
      </div>
    </div>
  );
}
