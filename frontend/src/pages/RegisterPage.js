import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import AddressCountrySelect from '../components/location/AddressCountrySelect';
import { countryFromNavigator, defaultAddressCountry } from '../constants/addressCountries';
import { userAPI } from '../utils/api';
import { authPathWithNext, isSafeNextPath } from '../utils/postLoginRoute';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const nextQs = isSafeNextPath(nextPath) ? `?next=${encodeURIComponent(nextPath)}` : '';
  const backTo = isSafeNextPath(nextPath) ? nextPath : '/';
  const [email, setEmail] = useState(() => location.state?.email || '');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressCountry, setAddressCountry] = useState(
    () => countryFromNavigator() || defaultAddressCountry()
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { email, full_name: fullName, address_country: addressCountry };
      if (phone.trim()) payload.phone = phone.trim();
      const { data } = await userAPI.register(payload);
      navigate(authPathWithNext('/login', nextPath), {
        replace: true,
        state: {
          email: data.email || email,
          step: 'otp',
          requires_otp: true,
          message: data.detail || 'We sent a sign-in code to your email.',
        },
      });
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.email?.[0] ||
          d?.detail ||
          (typeof d === 'string' ? d : 'Registration failed.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Create customer account"
      subtitle="For people booking services. We’ll email a one-time code — no password needed."
      backTo={backTo}
      brandLine="Local services. Real open times."
      panel={{
        headline: 'One account to book, message, and pay.',
        support: 'Join free as a customer. Find nearby providers and keep every appointment in one place.',
        points: [
          'No password to remember — sign in with email codes',
          'See upcoming jobs on your Home screen',
          'Message providers and manage bookings anytime',
        ],
      }}
      footer={
        <div className="space-y-2 text-center">
          <p className="text-xs text-slate-500">
            Want to offer services instead?{' '}
            <Link
              to={`/register/business${nextQs}`}
              className="font-semibold text-luminexa-accent-dark underline-offset-2 hover:underline"
            >
              Register your business
            </Link>
          </p>
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to={`/login${nextQs}`}
              className="font-semibold text-luminexa-accent-dark underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
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
            placeholder="You can add this later before booking"
            className="lx-input"
          />
        </div>
        <div>
          <AddressCountrySelect
            id="register-country"
            value={addressCountry}
            onChange={setAddressCountry}
            hint="Pick where you receive services — used for address search."
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Sending code…' : 'Continue with email'}
        </button>
      </form>
    </AuthFormShell>
  );
}
