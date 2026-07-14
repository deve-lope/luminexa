import React, { useEffect, useMemo, useState } from 'react';
import ServiceLocationInput, {
  formatServiceAddressDisplay,
  hasValidSavedServiceAddress,
} from './ServiceLocationInput';

/**
 * Booking flow: show saved profile address by default; full form only when changing.
 */
export default function BookingServiceLocationSection({
  user,
  value,
  onChange,
  label = 'Job location',
  hint,
}) {
  const profileAddress = (user?.default_service_address || '').trim();
  const profileValid = useMemo(() => hasValidSavedServiceAddress(user), [user]);

  const [editing, setEditing] = useState(() => !profileValid);

  useEffect(() => {
    if (profileValid && !editing && profileAddress && value !== profileAddress) {
      onChange(profileAddress);
    }
  }, [profileValid, profileAddress, editing, onChange, value]);

  const displayText = formatServiceAddressDisplay(value || profileAddress);

  const handleUseSaved = () => {
    onChange(profileAddress);
    setEditing(false);
  };

  if (profileValid && !editing) {
    return (
      <section className="lx-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <p className="mt-0.5 text-xs text-slate-500">From your profile — we come to you</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            Change address
          </button>
        </div>
        <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-800">
          {displayText}
        </p>
      </section>
    );
  }

  return (
    <section className="lx-card space-y-3">
      {profileValid && (
        <button
          type="button"
          onClick={handleUseSaved}
          className="text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          ← Use saved address
        </button>
      )}
      <ServiceLocationInput
        value={value}
        onChange={onChange}
        label={label}
        hint={
          hint ||
          (profileValid
            ? 'Enter a different address for this booking only.'
            : 'Enter the address where the provider should come.')
        }
      />
    </section>
  );
}
