import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

/**
 * Owner-only: opt into property_routes + snow (docs/SNOW_ROUTE_DISPATCH.md §4.1).
 * Switching back to appointment hides snow UI but keeps seeded data.
 */
export default function RouteOptimizationSettings({ orgSlug, orgDetails, onUpdated }) {
  const [needRoute, setNeedRoute] = useState(false);
  const [vertical, setVertical] = useState('snow');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const mode = orgDetails?.provider_mode || 'appointment';
    setNeedRoute(mode === 'property_routes');
    setVertical(orgDetails?.route_vertical || 'snow');
  }, [orgDetails]);

  const save = async () => {
    if (!orgSlug) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = needRoute
        ? { provider_mode: 'property_routes', route_vertical: vertical || 'snow' }
        : { provider_mode: 'appointment' };
      const { data } = await jobsAPI.patchOrganization(orgSlug, payload);
      setMessage(
        needRoute
          ? 'Route optimization enabled. Snow tools will appear as we roll them out.'
          : 'Back to appointment booking. Snow data is kept if you turn this on again.'
      );
      onUpdated?.(data);
    } catch (e) {
      setError(parseApiError(e) || 'Could not update route settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        For businesses that run property routes (snow clearing) instead of only fixed-time
        appointments. You can turn this on or off anytime — your other settings stay the same.
      </p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-800">
          Need route / custom optimization?
        </legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="need-route"
            checked={!needRoute}
            onChange={() => setNeedRoute(false)}
          />
          No — appointment booking only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="need-route"
            checked={needRoute}
            onChange={() => setNeedRoute(true)}
          />
          Yes — optimize routes for crews
        </label>
      </fieldset>
      {needRoute && (
        <div className="space-y-3">
          <div>
            <label htmlFor="route-vertical" className="mb-1.5 block text-sm font-medium text-slate-700">
              Route type
            </label>
            <select
              id="route-vertical"
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="lx-input max-w-xs"
            >
              <option value="snow">Snow cleaning</option>
            </select>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950">
            Route optimization costs extra:{' '}
            <span className="font-semibold">$40 CAD/month</span> for 1 master + 3 crew seats, then{' '}
            <span className="font-semibold">+$15/month</span> per extra crew. Includes Pro features
            plus optimized routes and crew tracking.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-teal-700">{message}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="lx-btn-primary min-h-[44px] rounded-xl px-4 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
