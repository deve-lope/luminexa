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
  return parseApiError(err, 'Could not sign in. Try again.');
}

export default function LoginPage() {
  const { login, loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');

  const initialEmail = location.state?.email || '';
  const initialStep =
    location.state?.step === 'otp' || location.state?.requires_otp ? 'otp' : 'email';

  const [step, setStep] = useState(initialStep); // email | password | otp
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    location.state?.message || (initialStep === 'otp' ? 'Enter the code we emailed you.' : '')
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const finishLogin = (user, memberships) => {
    applyPostLoginNavigation(navigate, user, memberships, nextPath);
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setResendMsg('');
    setUnverifiedEmail('');
    setSubmitting(true);
    try {
      const { data } = await userAPI.loginStart({ email: email.trim() });
      if (data.auth_method === 'password') {
        setStep('password');
        setInfo('Enter your business account password.');
      } else {
        setStep('otp');
        setInfo(data.detail || 'If an account exists for that email, we sent a sign-in code.');
      }
    } catch (err) {
      setError(parseLoginError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setResendMsg('');
    setUnverifiedEmail('');
    setSubmitting(true);
    try {
      const { user, memberships } = await login(email.trim(), password);
      finishLogin(user, memberships);
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

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setResendMsg('');
    setSubmitting(true);
    try {
      const { user, memberships } = await loginWithOtp(email.trim(), code.trim());
      finishLogin(user, memberships);
    } catch (err) {
      setError(parseLoginError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    const target = unverifiedEmail || email;
    if (!target) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await userAPI.resendVerification(target);
      setResendMsg(res.data?.detail || 'If needed, we sent a new message.');
    } catch {
      setResendMsg('Could not resend. Try again shortly.');
    } finally {
      setResending(false);
    }
  };

  const resendOtp = async () => {
    if (!email.trim()) return;
    setResending(true);
    setResendMsg('');
    setError('');
    try {
      const res = await userAPI.requestLoginOtp({ email: email.trim() });
      setResendMsg(res.data?.detail || 'If an account exists, we sent a new code.');
      if (res.data?.auth_method === 'password') {
        setStep('password');
        setInfo('This account uses a password.');
      }
    } catch (err) {
      setResendMsg(parseLoginError(err));
    } finally {
      setResending(false);
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setPassword('');
    setCode('');
    setError('');
    setInfo('');
    setResendMsg('');
    setUnverifiedEmail('');
  };

  const subtitle =
    step === 'password'
      ? 'Enter the password for your business account.'
      : step === 'otp'
        ? 'Enter the 6-digit code we emailed you.'
        : 'Enter your email — we’ll send a code, or ask for your password if you run a business.';

  return (
    <AuthFormShell
      title="Sign in"
      subtitle={subtitle}
      backTo="/"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-800">
            Create account
          </Link>
          {' · '}
          <Link to="/register/business" className="font-semibold text-teal-700 hover:text-teal-800">
            Register a business
          </Link>
        </>
      }
    >
      <motion.form
        key={step}
        onSubmit={
          step === 'email'
            ? handleEmailContinue
            : step === 'password'
              ? handlePasswordSubmit
              : handleOtpSubmit
        }
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
                onClick={resendVerification}
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
            disabled={step !== 'email'}
            className="lx-input disabled:bg-slate-50 disabled:text-slate-600"
          />
        </div>

        {step === 'password' && (
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
        )}

        {step === 'otp' && (
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
              Sign-in code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={4}
              maxLength={8}
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="lx-input tracking-[0.3em] text-center text-lg font-semibold"
              placeholder="000000"
            />
            <button
              type="button"
              disabled={resending}
              onClick={resendOtp}
              className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting
            ? step === 'email'
              ? 'Checking…'
              : 'Signing in…'
            : step === 'email'
              ? 'Continue'
              : 'Sign in'}
        </button>

        {step !== 'email' && (
          <button
            type="button"
            onClick={goBackToEmail}
            className="w-full text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            Use a different email
          </button>
        )}
      </motion.form>
    </AuthFormShell>
  );
}
