import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import PasswordInput from '../components/ui/PasswordInput';
import { userAPI } from '../utils/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';
  const requiresOtp =
    searchParams.get('requires_otp') === '1' || searchParams.get('otp') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [needOtp, setNeedOtp] = useState(requiresOtp);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!uid || !token) {
      setError('Invalid reset link. Request a new one.');
      return;
    }
    if (needOtp && !otp.trim()) {
      setError('Enter your Google Authenticator code (required for admin accounts).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { uid, token, password };
      if (otp.trim()) payload.otp = otp.trim();
      await userAPI.confirmPasswordReset(payload);
      navigate('/login', {
        replace: true,
        state: {
          message: needOtp
            ? 'Password updated. Sign in at Admin with your new password and authenticator code.'
            : 'Password updated. Sign in with your new password.',
        },
      });
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'admin_otp_required' || d?.otp) {
        setNeedOtp(true);
        setError(d?.otp?.[0] || d?.otp || d?.detail || 'Authenticator code required for admin.');
      } else {
        setError(
          d?.detail || d?.password?.[0] || 'Could not reset password. The link may have expired.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Choose a new password"
      subtitle={
        needOtp
          ? 'Admin reset: new password plus your Google Authenticator code (or backup token).'
          : 'Pick a password with at least 8 characters.'
      }
      backTo="/forgot-password"
      footer={
        <Link to="/forgot-password" className="font-semibold text-teal-700 hover:text-teal-800">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            New password
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
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <PasswordInput
            id="confirm"
            variant="light"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {needOtp && (
          <div>
            <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-slate-700">
              Google Authenticator code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required={needOtp}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code or backup token"
              className="lx-input"
            />
          </div>
        )}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthFormShell>
  );
}
