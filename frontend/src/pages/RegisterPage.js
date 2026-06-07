import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { storage } from '../utils/helpers';
import { userAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { applyPostLoginNavigation } from '../utils/postLoginRoute';
import BackButton from '../components/navigation/BackButton';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { email, full_name: fullName, password };
      if (phone.trim()) payload.phone = phone.trim();
      const { data } = await userAPI.register(payload);
      storage.set('token', data.token);
      await refreshSession();
      applyPostLoginNavigation(navigate, data.user, [], nextPath);
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.email?.[0] || d?.detail || (typeof d === 'string' ? d : 'Registration failed.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-luminexa-navy px-4 text-luminexa-mist">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-luminexa-slate/80 p-8 shadow-xl backdrop-blur">
        <BackButton fallback="/" className="mb-6 inline-block text-sm text-luminexa-mist/60 hover:text-luminexa-mist">
          ← Back
        </BackButton>
        <h1 className="mb-2 text-2xl font-bold">Create account</h1>
        <p className="mb-6 text-sm text-luminexa-mist/65">
          Mobile is optional now — you&apos;ll need email and mobile before booking a service.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium">Full name</label>
            <input
              id="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Mobile <span className="text-luminexa-mist/50">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Add before your first booking"
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 outline-none focus:border-luminexa-accent"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-lg bg-luminexa-accent font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-luminexa-mist/60">
          Running a business?{' '}
          <Link to="/register/business" className="font-medium text-luminexa-accent">
            Register your business
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-luminexa-mist/60">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-luminexa-accent">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
