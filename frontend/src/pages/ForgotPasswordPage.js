import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import { userAPI } from '../utils/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await userAPI.requestPasswordReset(email.trim());
      setMessage(res.data?.detail || 'Check your email for a reset link.');
    } catch {
      setError('Could not send reset email. Try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Reset password"
      subtitle="Business and admin accounts: we’ll email a reset link. Customers use an email sign-in code instead — use Sign in. Admin resets also require your Google Authenticator code."
      backTo="/login"
      footer={
        <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
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
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p>{message}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthFormShell>
  );
}
