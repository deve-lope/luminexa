import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { applyPostLoginNavigation } from '../utils/postLoginRoute';

function parseLoginError(err) {
  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      return 'Request timed out. The server may be restarting — wait a moment and try again.';
    }
    return 'Cannot reach the server. Make sure Docker is running and open http://localhost:3000';
  }
  if (err.response.status === 429) {
    return 'Too many login attempts. Please wait a minute and try again.';
  }
  const d = err.response.data;
  if (typeof d === 'string') return d;
  if (d?.non_field_errors?.[0]) return d.non_field_errors[0];
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : 'Login failed.';
  return 'Invalid email or password.';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user, memberships } = await login(email, password);
      applyPostLoginNavigation(navigate, user, memberships, nextPath);
    } catch (err) {
      setError(parseLoginError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="relative min-h-screen flex flex-col items-center justify-center bg-luminexa-navy px-4 text-luminexa-mist"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-luminexa-slate/80 p-8 shadow-xl backdrop-blur"
      >
        <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
        <p className="mb-8 text-sm text-luminexa-mist/65">
          Sign in with your email address and password (not a username).
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          )}
          <motion.div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </motion.div>
          <motion.div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-luminexa-accent">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-4 py-3 text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </motion.div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-lg bg-luminexa-accent py-3 font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-luminexa-mist/60">
          New here?{' '}
          <Link to="/register" className="font-medium text-luminexa-accent">
            Create account
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
