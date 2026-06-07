import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';

export default function CustomerAccountPage() {
  const { user, setUserFromProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
  }, [user?.full_name, user?.phone]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const { data } = await userAPI.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      setUserFromProfile(data);
      setProfileMessage('Profile updated.');
    } catch (err) {
      const d = err.response?.data;
      setProfileError(
        d?.full_name?.[0] || d?.phone?.[0] || d?.detail || 'Could not save profile.'
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage(null);
    setPasswordError(null);
    try {
      const res = await userAPI.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordMessage(res.data?.detail || 'Password updated.');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      const d = err.response?.data;
      setPasswordError(d?.old_password?.[0] || d?.detail || 'Could not update password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const needsContact = user && !user.has_booking_contact;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Your profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Providers see this when you book. Email and mobile are required to confirm appointments.
        </p>
        {needsContact && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add a mobile number so you can book services.
          </p>
        )}
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
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileMessage && <p className="text-sm text-emerald-700">{profileMessage}</p>}
          <button
            type="submit"
            disabled={profileBusy}
            className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {profileBusy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Change password</h2>
        <p className="mt-1 text-sm text-slate-600">Use a strong password you don&apos;t use elsewhere.</p>
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="old" className="mb-1 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="old"
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
            />
          </div>
          <div>
            <label htmlFor="new" className="mb-1 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-emerald-700">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordBusy}
            className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white font-medium text-slate-800 disabled:opacity-60"
          >
            {passwordBusy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
