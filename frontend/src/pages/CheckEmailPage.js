import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import { userAPI } from '../utils/api';

export default function CheckEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email = location.state?.email || searchParams.get('email') || '';
  const kind = location.state?.kind || searchParams.get('kind') || 'customer';
  const isBusiness = kind === 'business';

  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const subtitle = useMemo(() => {
    if (isBusiness) {
      return 'Enter the 6-digit code we emailed you to confirm your business account, then sign in with your password.';
    }
    return 'We sent a verification link to your inbox. Confirm your email, then sign in.';
  }, [isBusiness]);

  const resend = async () => {
    if (!email) {
      setError('Enter your email on the sign-in page to resend verification.');
      return;
    }
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await userAPI.resendVerification(email);
      setMessage(res.data?.detail || 'If needed, we sent a new code.');
    } catch {
      setError('Could not resend. Try again in a minute.');
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Missing email. Register again or use the link from sign-in.');
      return;
    }
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await userAPI.verifyEmailOtp({ email, code: code.trim() });
      navigate('/login', {
        replace: true,
        state: {
          email,
          message: res.data?.detail || 'Email verified. Sign in with your password.',
        },
      });
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthFormShell
      title={isBusiness ? 'Verify your email' : 'Check your email'}
      subtitle={subtitle}
      backTo="/login"
      footer={
        <>
          Ready?{' '}
          <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
            Sign in
          </Link>
        </>
      }
    >
      <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-4 text-sm text-slate-700">
        {email ? (
          <p>
            Sent to <span className="font-semibold text-slate-900">{email}</span>
          </p>
        ) : (
          <p>
            {isBusiness
              ? 'Enter the verification code from your email.'
              : 'Open the verification link in the email we sent you.'}
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {isBusiness ? (
        <form onSubmit={verifyCode} className="mt-5 space-y-4">
          <div>
            <label htmlFor="verify-code" className="mb-1.5 block text-sm font-medium text-slate-700">
              Verification code
            </label>
            <input
              id="verify-code"
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
          </div>
          <button
            type="submit"
            disabled={verifying || !email}
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify email'}
          </button>
          <button
            type="button"
            disabled={sending || !email}
            onClick={resend}
            className="lx-btn-secondary w-full min-h-[48px] disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend code'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={sending || !email}
          onClick={resend}
          className="lx-btn-secondary mt-5 w-full min-h-[48px] disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Resend verification email'}
        </button>
      )}
    </AuthFormShell>
  );
}
