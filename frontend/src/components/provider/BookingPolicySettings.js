import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_POLICIES } from '../../constants/bookingPolicies';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { providerSchedule } from '../../utils/providerPaths';

/**
 * Lets the business owner choose instant vs approval vs clients-only booking.
 */
export default function BookingPolicySettings({
  orgSlug,
  organizationName,
  isOwner,
  onSaved,
}) {
  const [policy, setPolicy] = useState('approval');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgSlug) return;
    setLoading(true);
    jobsAPI
      .getBookingContext(orgSlug)
      .then((res) => {
        if (res.data?.booking_policy) setPolicy(res.data.booking_policy);
      })
      .catch(() => setError('Could not load booking settings.'))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  const save = async () => {
    if (!orgSlug || !isOwner) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await jobsAPI.patchOrganization(orgSlug, { booking_policy: policy });
      setMessage('Booking rules saved.');
      onSaved?.(policy);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading booking rules…</p>;
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-sm font-semibold uppercase text-slate-500">How customers book</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose whether appointments are confirmed automatically or need your approval.
        {organizationName ? ` Applies to ${organizationName}.` : ''}
      </p>

      {!isOwner ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Only the business owner can change booking rules. Current mode:{' '}
          <strong>{BOOKING_POLICIES.find((p) => p.value === policy)?.label || policy}</strong>
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {BOOKING_POLICIES.map((opt) => (
              <li key={opt.value}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-luminexa-accent has-[:checked]:bg-violet-50">
                  <input
                    type="radio"
                    name="booking_policy"
                    value={opt.value}
                    checked={policy === opt.value}
                    onChange={(e) => setPolicy(e.target.value)}
                    className="mt-1"
                    disabled={!isOwner}
                  />
                  <span>
                    <span className="font-medium text-slate-900">{opt.label}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{opt.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {policy === 'clients_only' && (
            <p className="mt-3 text-xs text-slate-500">
              Approve customer access requests on{' '}
              <Link to={providerSchedule(orgSlug)} className="font-medium text-luminexa-accent">
                Schedule
              </Link>
              . After approval, they can book open slots.
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 w-full min-h-[48px] rounded-xl border border-slate-200 font-medium text-slate-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save booking rules'}
          </button>
        </>
      )}

      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
