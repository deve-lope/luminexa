import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../components/auth/AuthFormShell';
import { userAPI } from '../utils/api';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('working'); // working | ok | error
  const [detail, setDetail] = useState('Verifying your email…');

  useEffect(() => {
    let cancelled = false;
    if (!uid || !token) {
      setStatus('error');
      setDetail('Invalid verification link.');
      return undefined;
    }
    userAPI
      .verifyEmail({ uid, token })
      .then((res) => {
        if (cancelled) return;
        setStatus('ok');
        setDetail(res.data?.detail || 'Email verified. You can sign in now.');
      })
      .catch((err) => {
        if (cancelled) return;
        const d = err.response?.data;
        setStatus('error');
        setDetail(d?.detail || 'Invalid or expired verification link.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  return (
    <AuthFormShell
      title={status === 'ok' ? 'Email verified' : status === 'error' ? 'Could not verify' : 'Verifying…'}
      subtitle={detail}
      backTo="/login"
      footer={
        status === 'ok' ? (
          <button
            type="button"
            className="font-semibold text-teal-700 hover:text-teal-800"
            onClick={() => navigate('/login', { replace: true, state: { message: detail } })}
          >
            Continue to sign in
          </button>
        ) : (
          <>
            <Link to="/check-email" className="font-semibold text-teal-700 hover:text-teal-800">
              Resend link
            </Link>
            {' · '}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
              Sign in
            </Link>
          </>
        )
      }
    >
      {status === 'working' && (
        <p className="text-sm text-slate-500">Hang on a moment…</p>
      )}
      {status === 'ok' && (
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true, state: { message: detail } })}
          className="lx-btn-primary w-full min-h-[48px]"
        >
          Sign in
        </button>
      )}
      {status === 'error' && (
        <Link to="/login" className="lx-btn-secondary inline-flex w-full min-h-[48px]">
          Back to sign in
        </Link>
      )}
    </AuthFormShell>
  );
}
