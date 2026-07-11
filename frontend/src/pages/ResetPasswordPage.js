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
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
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
    setSubmitting(true);
    setError(null);
    try {
      await userAPI.confirmPasswordReset({ uid, token, password });
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated. Sign in with your new password.' },
      });
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.detail || d?.password?.[0] || 'Could not reset password. The link may have expired.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Choose a new password"
      subtitle="Pick a password with at least 8 characters."
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
