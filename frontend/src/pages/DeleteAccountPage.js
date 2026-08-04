import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../utils/api';
import { isProviderMember } from '../utils/postLoginRoute';
import { PROVIDER_DELETION_REASONS } from '../utils/providerDeletionReasons';

const CONTACT = 'support@luminex-a.com';
const APP_URL = 'https://app.luminex-a.com';

function Shell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Luminexa
          </Link>
          <Link to="/privacy" className="text-sm font-medium text-teal-700 hover:text-teal-800">
            Privacy
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}

function WhatHappens() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">What gets deleted</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>Your profile: name, email, phone number, and saved service address</li>
        <li>Your sign-in access (the account is closed and can no longer be used)</li>
        <li>If you run a business, your provider profile is removed from Luminexa search</li>
      </ul>
      <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">What may be kept</h2>
      <p className="mt-3 text-sm text-slate-700">
        Booking and invoice records may be retained in <strong>anonymized</strong> form (with your
        personal details removed) where required for tax, accounting, security, or dispute
        resolution. Questions?{' '}
        <a className="font-medium text-teal-700 hover:underline" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
      </p>
    </div>
  );
}

function ProviderExitFeedback({ reason, setReason, detail, setDetail }) {
  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="text-sm font-medium text-slate-700">
        Why are you leaving / not renewing Pro?
      </legend>
      <p className="text-xs text-slate-500">
        Required for business accounts. Helps us improve Luminexa — kept without your personal
        details.
      </p>
      <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
        {PROVIDER_DELETION_REASONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-white"
          >
            <input
              type="radio"
              name="deletion-reason"
              value={opt.value}
              checked={reason === opt.value}
              onChange={() => setReason(opt.value)}
              className="mt-1"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <label htmlFor="pub-deletion-detail" className="mb-1 block text-xs font-medium text-slate-600">
        Anything else? {reason === 'other' ? '(required)' : '(optional)'}
      </label>
      <textarea
        id="pub-deletion-detail"
        rows={2}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={2000}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
        placeholder="What would have made you renew?"
      />
    </fieldset>
  );
}

export default function DeleteAccountPage() {
  const [params] = useSearchParams();
  const uid = params.get('uid');
  const token = params.get('token');
  const { isAuthenticated, logout, loading, memberships } = useAuth();
  const navigate = useNavigate();
  const isProvider = isProviderMember(memberships);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // 'requested' | 'deleted'
  const [confirmText, setConfirmText] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionDetail, setDeletionDetail] = useState('');

  // Mode 1: confirming from an emailed link.
  const confirmMode = Boolean(uid && token);
  // Email-link deletes may be providers; collect reason whenever confirming.
  const needsExitFeedback = confirmMode || (!loading && isAuthenticated && isProvider);

  const parseDeleteError = (err) => {
    const d = err.response?.data;
    return (
      d?.deletion_reason?.[0] ||
      d?.deletion_detail?.[0] ||
      d?.detail ||
      'Could not delete your account. Please try again.'
    );
  };

  const feedbackPayload = needsExitFeedback
    ? { deletion_reason: deletionReason, deletion_detail: deletionDetail.trim() }
    : {};

  const validateFeedback = () => {
    if (!needsExitFeedback) return true;
    if (!deletionReason) {
      setError('Please select a reason so we can improve Luminexa.');
      return false;
    }
    if (deletionReason === 'other' && !deletionDetail.trim()) {
      setError('Please add a short note when selecting Other.');
      return false;
    }
    return true;
  };

  const runConfirm = async () => {
    if (!validateFeedback()) return;
    setBusy(true);
    setError(null);
    try {
      await userAPI.confirmAccountDeletion({ uid, token, ...feedbackPayload });
      setDone('deleted');
      if (isAuthenticated) {
        try {
          await logout();
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(parseDeleteError(err) || 'This deletion link is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  const runAuthedDelete = async (e) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm.');
      return;
    }
    if (!validateFeedback()) return;
    setBusy(true);
    setError(null);
    try {
      await userAPI.deleteAccount(feedbackPayload);
      setDone('deleted');
      try {
        await logout();
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(parseDeleteError(err));
    } finally {
      setBusy(false);
    }
  };

  const runRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await userAPI.requestAccountDeletion(email.trim());
      setDone('requested');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done === 'deleted') {
    return (
      <Shell>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Account</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Account deleted</h1>
        <p className="mt-3 text-sm text-slate-700">
          Your Luminexa account and personal details have been removed. Thanks for using Luminexa.
        </p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-teal-600 px-6 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Back to Luminexa
        </button>
      </Shell>
    );
  }

  if (done === 'requested') {
    return (
      <Shell>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Account</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-3 text-sm text-slate-700">
          If an account exists for that email, we&apos;ve sent a link to confirm deletion. Open it to
          permanently delete your account. The link expires shortly for your security.
        </p>
        <WhatHappens />
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Account deletion</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Delete your Luminexa account
      </h1>
      <p className="mt-3 text-sm text-slate-700">
        You can request deletion of your account and personal data here, or from inside the app under{' '}
        <span className="font-medium">Account → Delete account</span>. Applies to {APP_URL}.
      </p>

      <WhatHappens />

      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}

      {confirmMode ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Confirm account deletion</h2>
          <p className="mt-1 text-sm text-slate-600">
            You followed a deletion link. Confirm below to permanently delete your account. This
            can&apos;t be undone.
          </p>
          <ProviderExitFeedback
            reason={deletionReason}
            setReason={setDeletionReason}
            detail={deletionDetail}
            setDetail={setDeletionDetail}
          />
          <button
            type="button"
            onClick={runConfirm}
            disabled={busy}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Permanently delete my account'}
          </button>
        </div>
      ) : !loading && isAuthenticated ? (
        <form onSubmit={runAuthedDelete} className="mt-6 rounded-2xl border border-red-100 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">You&apos;re signed in</h2>
          <p className="mt-1 text-sm text-slate-600">
            Type <span className="font-bold">DELETE</span> to permanently delete your account now.
          </p>
          {needsExitFeedback && (
            <ProviderExitFeedback
              reason={deletionReason}
              setReason={setDeletionReason}
              detail={deletionDetail}
              setDetail={setDeletionDetail}
            />
          )}
          <input
            type="text"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-3 w-full min-h-[48px] rounded-xl border border-slate-200 px-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            placeholder="DELETE"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </form>
      ) : (
        <form onSubmit={runRequest} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Request deletion by email</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter your account email and we&apos;ll send a confirmation link to complete the deletion.
          </p>
          <label htmlFor="delete-email" className="mt-3 mb-1 block text-sm font-medium text-slate-700">
            Account email
          </label>
          <input
            id="delete-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send deletion link'}
          </button>
        </form>
      )}

      <p className="mt-10 text-sm text-slate-500">
        <Link to="/" className="font-medium text-teal-700 hover:underline">
          ← Back to Luminexa
        </Link>
      </p>
    </Shell>
  );
}
