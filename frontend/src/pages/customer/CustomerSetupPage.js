import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../../components/auth/AuthFormShell';
import ServiceLocationInput, {
  validateServiceLocationValue,
} from '../../components/customer/ServiceLocationInput';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';
import { applyPostLoginNavigation } from '../../utils/postLoginRoute';
import { needsOnboarding } from '../../utils/profileSetup';

export default function CustomerSetupPage() {
  const { user, memberships, setUserFromProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');

  const [fullName, setFullName] = useState(() => user?.full_name || '');
  const [phone, setPhone] = useState(() => user?.phone || '');
  const [defaultServiceAddress, setDefaultServiceAddress] = useState(
    () => user?.default_service_address || ''
  );
  const [addressCountry, setAddressCountry] = useState(() => user?.address_country || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#d8f3ef] text-slate-600">
        Loading…
      </div>
    );
  }

  if (!needsOnboarding(user)) {
    const fallback = nextPath && nextPath.startsWith('/') ? nextPath : '/customer';
    return <Navigate to={fallback} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const locationCheck = validateServiceLocationValue(defaultServiceAddress);
    if (!locationCheck.valid) {
      setError(locationCheck.error || 'Please enter a valid address.');
      return;
    }
    if (!phone.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setSaving(true);
    try {
      await userAPI.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        default_service_address: defaultServiceAddress.trim(),
        address_country: addressCountry,
      });
      const { data: completed } = await userAPI.completeOnboarding();
      setUserFromProfile(completed);
      applyPostLoginNavigation(navigate, completed, memberships, nextPath);
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.phone?.[0] ||
          d?.full_name?.[0] ||
          d?.default_service_address?.[0] ||
          d?.detail ||
          'Could not save your details.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthFormShell
      title="Set up your account"
      subtitle="Tell us how to reach you and where you receive services. This only takes a minute."
      backTo="/login"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="setup-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="setup-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="lx-input"
          />
        </div>
        <div>
          <label htmlFor="setup-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="setup-email"
            value={user?.email || ''}
            readOnly
            className="lx-input bg-slate-50 text-slate-600"
          />
        </div>
        <div>
          <label htmlFor="setup-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mobile number
          </label>
          <input
            id="setup-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
            className="lx-input"
          />
        </div>
        <ServiceLocationInput
          id="setup-address"
          value={defaultServiceAddress}
          onChange={setDefaultServiceAddress}
          country={addressCountry}
          onCountryChange={setAddressCountry}
          label="Your service address"
          hint="Used when you book — providers know where to come."
        />
        <button
          type="submit"
          disabled={saving}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthFormShell>
  );
}
