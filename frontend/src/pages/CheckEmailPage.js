import React, { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import { userAPI } from '../utils/api';

export default function CheckEmailPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email = location.state?.email || searchParams.get('email') || '';
  const kind = location.state?.kind || searchParams.get('kind') || 'customer';
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const subtitle = useMemo(() => {
    if (kind === 'business') {
      return 'Your business account is almost ready. Confirm your email to sign in and manage bookings.';
    }
    return 'We sent a verification link to your inbox. Confirm your email, then sign in.';
  }, [kind]);

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
      setMessage(res.data?.detail || 'If needed, we sent a new verification link.');
    } catch {
      setError('Could not resend. Try again in a minute.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthFormShell
      title="Check your email"
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
          <p>Open the verification link in the email we sent you.</p>
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

      <button
        type="button"
        disabled={sending || !email}
        onClick={resend}
        className="lx-btn-secondary mt-5 w-full min-h-[48px] disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Resend verification email'}
      </button>
    </AuthFormShell>
  );
}
