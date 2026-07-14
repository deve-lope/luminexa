import React, { useEffect, useState } from 'react';
import { userAPI } from '../utils/api';
import ServiceLocationInput, {
  formatServiceAddressDisplay,
  hasValidSavedServiceAddress,
  validateServiceLocationValue,
} from './customer/ServiceLocationInput';

export default function BookingContactForm({ user, onSaved }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [defaultServiceAddress, setDefaultServiceAddress] = useState(
    user?.default_service_address || ''
  );
  const [addressCountry, setAddressCountry] = useState(user?.address_country || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const needsAddress = !hasValidSavedServiceAddress(user);

  useEffect(() => {
    setPhone(user?.phone || '');
    setFullName(user?.full_name || '');
    setDefaultServiceAddress(user?.default_service_address || '');
    setAddressCountry(user?.address_country || '');
  }, [user?.phone, user?.full_name, user?.default_service_address, user?.address_country]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (needsAddress) {
      const locationCheck = validateServiceLocationValue(defaultServiceAddress);
      if (!locationCheck.valid) {
        setError(locationCheck.error || 'Please enter a valid service address.');
        setSaving(false);
        return;
      }
    }
    try {
      const payload = {
        full_name: fullName,
        phone: phone.trim(),
      };
      if (needsAddress) {
        payload.default_service_address = defaultServiceAddress.trim();
        payload.address_country = addressCountry;
      }
      const { data } = await userAPI.updateProfile(payload);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-900">Contact details required to book</h3>
      <p className="mt-1 text-sm text-amber-900/80">
        {needsAddress
          ? 'Email, mobile, and your service address are needed before you can book.'
          : 'Add your mobile number so providers can reach you when you book.'}
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full min-h-[48px] rounded-lg border border-slate-200 px-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            value={user?.email || ''}
            readOnly
            className="w-full min-h-[48px] rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mobile number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="+1 555 123 4567"
            className="w-full min-h-[48px] rounded-lg border border-slate-200 px-3"
          />
        </div>
        {needsAddress ? (
          <ServiceLocationInput
            id="booking-default-address"
            value={defaultServiceAddress}
            onChange={setDefaultServiceAddress}
            country={addressCountry}
            onCountryChange={setAddressCountry}
            label="Your service location"
            hint="Saved to your profile and used for future bookings."
          />
        ) : (
          <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700">
            <p className="font-medium text-slate-800">Service location</p>
            <p className="mt-1 whitespace-pre-line text-slate-600">
              {formatServiceAddressDisplay(user?.default_service_address)}
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </form>
  );
}
