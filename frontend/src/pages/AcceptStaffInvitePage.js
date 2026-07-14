import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jobsAPI } from '../utils/api';
import { providerHome } from '../utils/providerPaths';

export default function AcceptStaffInvitePage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated || !token) return;
    setBusy(true);
    jobsAPI
      .acceptStaffInvite(token)
      .then((res) => {
        setMessage(res.data?.detail || 'Invitation accepted.');
        const slug = res.data?.organization_slug;
        if (slug) {
          window.setTimeout(() => navigate(providerHome(slug), { replace: true }), 1500);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Could not accept invitation.');
      })
      .finally(() => setBusy(false));
  }, [loading, isAuthenticated, token, navigate]);

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-slate-600">Missing invitation token.</p>
        <Link to="/" className="mt-4 inline-block text-luminexa-accent">
          Go home
        </Link>
      </div>
    );
  }

  if (!isAuthenticated && !loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Staff invitation</h1>
        <p className="mt-2 text-slate-600">Sign in with the email that received the invite.</p>
        <Link
          to={`/login?next=${encodeURIComponent(`/accept-staff-invite?token=${token}`)}`}
          className="mt-6 inline-flex min-h-[48px] items-center rounded-xl bg-luminexa-accent px-6 font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {busy && <p className="text-slate-600">Accepting invitation…</p>}
      {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}
    </div>
  );
}
