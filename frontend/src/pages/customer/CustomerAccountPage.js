import React, { useEffect, useState } from 'react';
import ServiceLocationInput, {
  formatServiceAddressDisplay,
  validateServiceLocationValue,
} from '../../components/customer/ServiceLocationInput';
import PasswordInput from '../../components/ui/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { userAPI } from '../../utils/api';

const inputClass =
  'w-full min-h-[48px] rounded-xl border border-slate-200 px-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20';

function ReadOnlyRow({ label, value, empty = 'Not set', teal = false }) {
  const display = (value || '').trim() ? value : empty;
  const isEmpty = !(value || '').trim();
  return (
    <div className={`border-b py-3 last:border-b-0 ${teal ? 'border-teal-50' : 'border-slate-100'}`}>
      <dt
        className={
          teal
            ? 'text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700'
            : 'text-xs font-medium uppercase tracking-wide text-slate-500'
        }
      >
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}>{display}</dd>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose, onSuccess, teal = false }) {
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
      <div
        className={`w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ${
          teal ? 'border border-teal-100' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {teal && (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Security</p>
            )}
            <h2
              id="change-password-title"
              className={`text-lg font-semibold text-slate-900 ${teal ? 'mt-1 font-bold tracking-tight' : ''}`}
            >
              Change password
            </h2>
            <p className="mt-1 text-sm text-slate-600">Use a strong password you don&apos;t use elsewhere.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-2 py-1 text-sm text-slate-500 ${
              teal ? 'hover:bg-teal-50 hover:text-teal-800' : 'hover:bg-slate-100'
            }`}
          >
            Close
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="pwd-old" className="mb-1 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <PasswordInput
              id="pwd-old"
              variant="light"
              required
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pwd-new" className="mb-1 block text-sm font-medium text-slate-700">
              New password
            </label>
            <PasswordInput
              id="pwd-new"
              variant="light"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[48px] flex-1 border border-slate-200 font-medium text-slate-700 ${
                teal ? 'rounded-full hover:bg-slate-50' : 'rounded-xl'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={
                teal
                  ? 'inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-60'
                  : 'lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60'
              }
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
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultServiceAddress, setDefaultServiceAddress] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [profileError, setProfileError] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const resetFormFromUser = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setDefaultServiceAddress(user?.default_service_address || '');
    setAddressCountry(user?.address_country || '');
    setProfileError(null);
  };

  useEffect(() => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setDefaultServiceAddress(user?.default_service_address || '');
    setAddressCountry(user?.address_country || '');
  }, [user?.full_name, user?.phone, user?.default_service_address, user?.address_country]);

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
        const addressValue = defaultServiceAddress.trim();
        if (addressValue) {
          const locationCheck = validateServiceLocationValue(addressValue);
          if (!locationCheck.valid) {
            setProfileError(locationCheck.error || 'Please enter a valid service address.');
            setProfileBusy(false);
            return;
          }
        }
        payload.default_service_address = addressValue;
        payload.address_country = addressCountry;
      }
      const { data } = await userAPI.updateProfile(payload);
      setUserFromProfile(data);
      setEditing(false);
      showToast('Profile updated.', 'success');
    } catch (err) {
      const d = err.response?.data;
      setProfileError(
        d?.full_name?.[0] || d?.phone?.[0] || d?.detail || 'Could not save profile.'
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const needsPhone = user && !user.has_booking_contact;
  const needsAddress = isCustomerAccount && !(user?.default_service_address || '').trim();
  const formattedAddress = formatServiceAddressDisplay(user?.default_service_address);
  const fieldClass = isCustomerAccount
    ? inputClass
    : 'w-full min-h-[48px] rounded-xl border border-slate-200 px-3';
  const primaryBtn = isCustomerAccount
    ? 'inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-60'
    : 'lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60';
  const secondaryBtn = isCustomerAccount
    ? 'min-h-[48px] flex-1 rounded-full border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
    : 'min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60';

  return (
    <div className="space-y-4">
      <section
        className={
          isCustomerAccount
            ? 'rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6'
            : 'rounded-xl bg-white p-5 shadow-sm'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {isCustomerAccount ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Profile</p>
                <h2 className="mt-1 text-base font-bold tracking-tight text-slate-900">My details</h2>
              </>
            ) : (
              <h2 className="text-sm font-semibold uppercase text-slate-500">My details</h2>
            )}
            <p className="mt-1 text-sm text-slate-600">
              {isCustomerAccount
                ? 'Phone and address used when you book appointments.'
                : 'Your sign-in and contact details.'}
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className={
                isCustomerAccount
                  ? 'shrink-0 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100'
                  : 'shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
              }
            >
              Edit
            </button>
          )}
        </div>

        {isCustomerAccount && user?.public_ref && !editing && (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Customer ID: <span className="font-semibold text-teal-800">{user.public_ref}</span>
          </p>
        )}

        {isCustomerAccount && !editing && (needsPhone || needsAddress) && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {needsPhone && needsAddress
              ? 'Add your mobile number and service address so bookings are faster.'
              : needsPhone
                ? 'Add a mobile number so you can book services.'
                : 'Add your service address — it will be filled in automatically when you book.'}
          </p>
        )}

        {editing ? (
          <form onSubmit={saveProfile} className="mt-4 space-y-6">
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold ${isCustomerAccount ? 'text-teal-800' : 'text-slate-800'}`}>
                Contact
              </h3>
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
                  className={fieldClass}
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
                  className={`w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-slate-600 ${
                    isCustomerAccount ? 'bg-teal-50/40' : 'bg-slate-50'
                  }`}
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
                  className={fieldClass}
                />
              </div>
            </div>

            {isCustomerAccount && (
              <div className="space-y-3 border-t border-teal-50 pt-4">
                <h3 className="text-sm font-semibold text-teal-800">Service address</h3>
                <p className="text-sm text-slate-600">
                  Where providers should come by default. You can change it for a single booking if needed.
                </p>
                <ServiceLocationInput
                  id="account-default-address"
                  value={defaultServiceAddress}
                  onChange={setDefaultServiceAddress}
                  country={addressCountry}
                  onCountryChange={setAddressCountry}
                  label="Default service location"
                  hint="Saved for bookings and filled in automatically when you book."
                />
              </div>
            )}

            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={profileBusy}
                className={secondaryBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={profileBusy} className={primaryBtn}>
                {profileBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4">
            <ReadOnlyRow label="Full name" value={user?.full_name} teal={isCustomerAccount} />
            <ReadOnlyRow label="Email" value={user?.email} teal={isCustomerAccount} />
            <ReadOnlyRow label="Mobile" value={user?.phone} teal={isCustomerAccount} />
            {isCustomerAccount && (
              <div className="border-b border-teal-50 py-3 last:border-b-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
                  Service address
                </dt>
                <dd
                  className={`mt-1 whitespace-pre-line text-sm ${
                    formattedAddress ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {formattedAddress || 'Not set'}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section
        className={
          isCustomerAccount
            ? 'rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6'
            : 'rounded-xl bg-white p-5 shadow-sm'
        }
      >
        {isCustomerAccount ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Security</p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-slate-900">Sign-in</h2>
            <p className="mt-1 text-sm text-slate-600">
              You sign in with a one-time code emailed to you — no password to manage.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </section>

      {!isCustomerAccount && (
        <ChangePasswordDialog
          open={passwordOpen}
          onClose={() => setPasswordOpen(false)}
          onSuccess={(message) => showToast(message, 'success')}
          teal={false}
        />
      )}
    </div>
  );
}
