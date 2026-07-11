import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthFormShell from '../components/auth/AuthFormShell';
import PasswordInput from '../components/ui/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { applyPostLoginNavigation } from '../utils/postLoginRoute';
import parseApiError from '../utils/parseApiError';
import { userAPI } from '../utils/api';

function parseLoginError(err) {
  return parseApiError(err, 'Invalid email or password.');
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.message || '');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setResendMsg('');
    setUnverifiedEmail('');
    setSubmitting(true);
    try {
      const { user, memberships } = await login(email, password);
      applyPostLoginNavigation(navigate, user, memberships, nextPath);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 403 && data?.code === 'email_not_verified') {
        setUnverifiedEmail(data.email || email);
        setError(data.detail || 'Please verify your email before signing in.');
      } else {
        setError(parseLoginError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    const target = unverifiedEmail || email;
    if (!target) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await userAPI.resendVerification(target);
      setResendMsg(res.data?.detail || 'If needed, we sent a new verification link.');
    } catch {
      setResendMsg('Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthFormShell
      title="Sign in"
      subtitle="Sign in with your email address and password."
      backTo="/"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-800">
            Create account
          </Link>
        </>
      }
    >
      <motion.form
        onSubmit={handleSubmit}
        className="space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {info && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {info}
          </p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            <p>{error}</p>
            {unverifiedEmail && (
              <button
                type="button"
                disabled={resending}
                onClick={resend}
                className="mt-2 font-semibold text-teal-700 underline-offset-2 hover:underline disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}
        {resendMsg && (
          <p className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            {resendMsg}
          </p>
        )}
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
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            variant="light"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </motion.form>
    </AuthFormShell>
  );
}
