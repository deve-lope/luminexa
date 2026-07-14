import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_POLICIES } from '../../constants/bookingPolicies';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { providerSchedule } from '../../utils/providerPaths';

/**
 * Lets the business owner choose instant vs approval vs clients-only booking,
 * and set how close to start customers may cancel confirmed appointments.
 */
export default function BookingPolicySettings({
  orgSlug,
  organizationName,
  isOwner,
  onSaved,
}) {
  const [policy, setPolicy] = useState('approval');
  const [cancelCutoffHours, setCancelCutoffHours] = useState(24);
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
        if (res.data?.cancel_cutoff_hours != null) {
          setCancelCutoffHours(Number(res.data.cancel_cutoff_hours));
        }
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
      const cutoff = Math.max(0, Math.min(720, Number(cancelCutoffHours) || 0));
      await jobsAPI.patchOrganization(orgSlug, {
        booking_policy: policy,
        cancel_cutoff_hours: cutoff,
      });
      setCancelCutoffHours(cutoff);
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
    <section className="lx-card">
      <h2 className="text-sm font-semibold uppercase text-slate-500">How customers book</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose whether appointments are confirmed automatically or need your approval.
        {organizationName ? ` Applies to ${organizationName}.` : ''}
      </p>

      {!isOwner ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Only the business owner can change booking rules. Current mode:{' '}
          <strong>{BOOKING_POLICIES.find((p) => p.value === policy)?.label || policy}</strong>
          . Cancel cutoff:{' '}
          <strong>
            {Number(cancelCutoffHours) === 0
              ? 'anytime before start'
              : `${cancelCutoffHours} hours before start`}
          </strong>
          .
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

          <div className="mt-5 border-t border-slate-100 pt-4">
            <label htmlFor="cancel-cutoff" className="block text-sm font-medium text-slate-900">
              Customer cancel cutoff (hours)
            </label>
            <p className="mt-1 text-sm text-slate-600">
              Confirmed bookings cannot be cancelled by the customer within this many hours of
              start. Pending requests can still be cancelled anytime. Use 0 for no cutoff.
            </p>
            <input
              id="cancel-cutoff"
              type="number"
              min={0}
              max={720}
              step={1}
              value={cancelCutoffHours}
              onChange={(e) => setCancelCutoffHours(e.target.value)}
              className="mt-3 w-full max-w-[10rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

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
