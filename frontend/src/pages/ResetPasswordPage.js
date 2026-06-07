import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { userAPI } from '../utils/api';
import BackButton from '../components/navigation/BackButton';

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
      navigate('/login', { replace: true, state: { message: 'Password updated. Sign in with your new password.' } });
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.password?.[0] || 'Could not reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <BackButton fallback="/login" className="mb-6 text-sm text-luminexa-mist" />
      <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-luminexa-mist">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 text-white"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-luminexa-mist">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 text-white"
          />
        </div>
        {error && <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-200">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-luminexa-mist">
        <Link to="/forgot-password" className="font-medium text-luminexa-accent">
          Request a new link
        </Link>
      </p>
    </div>
  );
}
