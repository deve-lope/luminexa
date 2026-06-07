import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../utils/api';
import BackButton from '../components/navigation/BackButton';

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <BackButton fallback="/login" className="mb-6 text-sm text-luminexa-mist" />
      <h1 className="text-2xl font-bold text-white">Reset password</h1>
      <p className="mt-2 text-luminexa-mist">
        Enter your email and we&apos;ll send a link to reset your password.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-luminexa-mist">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 text-white"
          />
        </div>
        {error && <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-200">{error}</p>}
        {message && (
          <p className="rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-200">{message}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-luminexa-mist">
        <Link to="/login" className="font-medium text-luminexa-accent">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
