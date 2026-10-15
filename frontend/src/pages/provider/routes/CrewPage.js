import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../../utils/api';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import parseApiError from '../../../utils/parseApiError';
import { isNativeApp } from '../../../native/capacitorNative';
import { providerBilling } from '../../../utils/providerPaths';
import { Link } from 'react-router-dom';

export default function CrewPage() {
  const { orgSlug } = useProviderOrg();
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const storeShell = isNativeApp();

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    jobsAPI
      .getDispatchCrew(orgSlug)
      .then((res) => setData(res.data))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await jobsAPI.inviteDispatchCrew(orgSlug, email.trim());
      setEmail('');
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (id) => {
    if (!window.confirm('Remove this crew member?')) return;
    setBusy(true);
    try {
      await jobsAPI.removeDispatchCrew(orgSlug, id);
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const seats = data?.seats || {};
  const used = seats.used ?? data?.seats_used ?? 0;
  const allowed = seats.allowed ?? data?.seats_allowed ?? 3;
  const members = data?.members || data?.crew || [];
  const pending = data?.pending_invites || data?.pending || [];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Crew</h1>
        <p className="mt-1 text-sm text-slate-600">
          {used} of {allowed} crew seats used (master does not use a seat).
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading crew…</p>}

      {!storeShell && allowed <= used && (
        <p className="rounded-xl bg-teal-50 px-3 py-3 text-sm text-teal-900 ring-1 ring-teal-200">
          Need more seats? Add extra crew for $15/mo each from{' '}
          <Link to={providerBilling(orgSlug)} className="font-semibold underline">
            Billing
          </Link>
          .
        </p>
      )}

      <form onSubmit={invite} className="lx-card space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Invite by email</span>
          <input
            type="email"
            className="lx-input mt-1 w-full"
            placeholder="crew@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        {!storeShell ? (
          <button type="submit" disabled={busy} className="lx-btn-primary w-full min-h-[44px]">
            {busy ? 'Sending…' : 'Send crew invite'}
          </button>
        ) : (
          <p className="text-sm text-slate-600">
            Crew invites are sent from the web app (app.luminex-a.com).
          </p>
        )}
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Active crew</h2>
        {!members.length && <p className="text-sm text-slate-500">No crew members yet.</p>}
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id || m.membership_id}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100"
            >
              <div>
                <p className="font-medium text-slate-900">{m.display_name || m.email}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              {!storeShell && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeMember(m.id || m.membership_id)}
                  className="text-sm font-medium text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Pending invites</h2>
          <ul className="space-y-2">
            {pending.map((inv) => (
              <li
                key={inv.id || inv.email}
                className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {inv.email}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
