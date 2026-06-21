import React, { useEffect, useState } from 'react';
import ServiceLocationInput from '../../components/customer/ServiceLocationInput';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';

function ReadOnlyRow({ label, value, empty = 'Not set' }) {
  const display = (value || '').trim() ? value : empty;
  const isEmpty = !(value || '').trim();
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}>{display}</dd>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOldPassword('');
    setNewPassword('');
    setError(null);
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await userAPI.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      onSuccess?.(res.data?.detail || 'Password updated.');
      onClose();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.old_password?.[0] || d?.detail || 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="change-password-title" className="text-lg font-semibold text-slate-900">
              Change password
            </h2>
            <p className="mt-1 text-sm text-slate-600">Use a strong password you don&apos;t use elsewhere.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="pwd-old" className="mb-1 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="pwd-old"
              type="password"
              required
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
            />
          </div>
          <div>
            <label htmlFor="pwd-new" className="mb-1 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="pwd-new"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomerAccountPage({ variant = 'customer' }) {
  const isCustomerAccount = variant === 'customer';
  const { user, setUserFromProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultServiceAddress, setDefaultServiceAddress] = useState('');
  const [profileError, setProfileError] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const resetFormFromUser = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setDefaultServiceAddress(user?.default_service_address || '');
    setProfileError(null);
  };

  useEffect(() => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setDefaultServiceAddress(user?.default_service_address || '');
  }, [user?.full_name, user?.phone, user?.default_service_address]);

  const startEditing = () => {
    resetFormFromUser();
    setEditing(true);
  };

  const cancelEditing = () => {
    resetFormFromUser();
    setEditing(false);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
      };
      if (isCustomerAccount) {
        payload.default_service_address = defaultServiceAddress.trim();
      }
      const { data } = await userAPI.updateProfile(payload);
      setUserFromProfile(data);
      setEditing(false);
      setToast('Profile updated.');
    } catch (err) {
      const d = err.response?.data;
      setProfileError(
        d?.full_name?.[0] || d?.phone?.[0] || d?.detail || 'Could not save profile.'
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const needsContact = user && !user.has_booking_contact;

  return (
    <div className="space-y-4">
      {toast && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{toast}</p>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase text-slate-500">Your profile</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isCustomerAccount
                ? 'Details providers see when you book.'
                : 'Your sign-in and contact details.'}
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
        </div>

        {isCustomerAccount && user?.public_ref && !editing && (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Customer ID: <span className="text-slate-700">{user.public_ref}</span>
          </p>
        )}

        {isCustomerAccount && needsContact && !editing && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add a mobile number so you can book services.
          </p>
        )}

        {editing ? (
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div>
              <label htmlFor="full-name" className="mb-1 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                id="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                readOnly
                value={user?.email || ''}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-600"
              />
              <p className="mt-1 text-xs text-slate-500">Used to sign in. Contact support to change.</p>
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
              />
            </div>
            {isCustomerAccount && (
              <ServiceLocationInput
                id="account-default-address"
                value={defaultServiceAddress}
                onChange={setDefaultServiceAddress}
                label="Default service location"
                hint="Saved for bookings — use the map, current location, or type your address"
              />
            )}
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={profileBusy}
                className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={profileBusy}
                className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
              >
                {profileBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4">
            <ReadOnlyRow label="Full name" value={user?.full_name} />
            <ReadOnlyRow label="Email" value={user?.email} />
            <ReadOnlyRow label="Mobile" value={user?.phone} />
            {isCustomerAccount && (
              <ReadOnlyRow label="Default service location" value={user?.default_service_address} />
            )}
          </dl>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Security</h2>
        <p className="mt-1 text-sm text-slate-600">Keep your account secure.</p>
        <button
          type="button"
          onClick={() => setPasswordOpen(true)}
          className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-xl border border-slate-200 px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <span>Change password</span>
          <span className="text-slate-400" aria-hidden>
            →
          </span>
        </button>
      </section>

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSuccess={(message) => setToast(message)}
      />
    </div>
  );
}
