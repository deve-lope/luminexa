import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ServiceAreaRadiusMap from '../location/ServiceAreaRadiusMap';
import { orgProfileAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { DEFAULT_RADIUS_MILES, formatRadiusMiles } from '../../constants/locationSearch';
import { roundCoordinate, roundCoordinatePair } from '../../utils/coordinates';

function formatLocationLine(loc) {
  const place = [loc.city, loc.state].filter(Boolean).join(', ');
  const postal = (loc.postal_code || '').trim();
  const bits = [place, postal].filter(Boolean);
  if (bits.length) return bits.join(' · ');
  return loc.address || loc.name || 'Untitled location';
}

function emptyDraft() {
  return {
    id: null,
    name: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    lat: null,
    lng: null,
    radiusMiles: DEFAULT_RADIUS_MILES,
    is_primary: false,
  };
}

/**
 * Manage one or more service locations / branches for a provider.
 */
export default function ProviderServiceAreaSettings({ orgSlug, isOwner, onSaved, embedded = false }) {
  const [locations, setLocations] = useState([]);
  const [editing, setEditing] = useState(null); // draft object or null
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    orgProfileAPI
      .listLocations(orgSlug)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setLocations(list);
      })
      .catch(() => setError('Could not load locations.'))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const beginAddLocation = () => {
    setShowAddChoice(false);
    setMessage(null);
    setError(null);
    setEditing({
      ...emptyDraft(),
      is_primary: locations.length === 0,
      name: locations.length === 0 ? 'Primary' : '',
    });
  };

  const startAdd = () => {
    setMessage(null);
    setError(null);
    // First location: go straight to the editor.
    // Additional locations: ask separate account vs multi-location on this profile.
    if (locations.length >= 1) {
      setEditing(null);
      setShowAddChoice(true);
      return;
    }
    beginAddLocation();
  };

  const startEdit = (loc) => {
    setMessage(null);
    setError(null);
    setShowAddChoice(false);
    const rounded =
      loc.latitude != null && loc.longitude != null
        ? roundCoordinatePair(loc.latitude, loc.longitude)
        : { lat: null, lng: null };
    setEditing({
      id: loc.id,
      name: loc.name || '',
      address: loc.address || '',
      city: loc.city || '',
      state: loc.state || '',
      postal_code: loc.postal_code || '',
      lat: rounded.lat,
      lng: rounded.lng,
      radiusMiles: Number(loc.radius_miles) || DEFAULT_RADIUS_MILES,
      is_primary: Boolean(loc.is_primary),
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setShowAddChoice(false);
    setError(null);
  };

  const handleMapLocationChange = useCallback((payload) => {
    const rounded = roundCoordinatePair(payload.lat, payload.lng);
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lat: rounded.lat,
        lng: rounded.lng,
        city: payload.city || prev.city,
        state: payload.state || prev.state,
        postal_code: payload.postal_code
          ? payload.postal_code.replace(/[\s-]+/g, '').toUpperCase()
          : prev.postal_code,
        address: payload.address || prev.address,
      };
    });
  }, []);

  const save = async () => {
    if (!orgSlug || !isOwner || !editing) return;
    if (editing.lat == null || editing.lng == null) {
      setError('Pick a location on the map or search for your city.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = {
      name: (editing.name || '').trim(),
      address: (editing.address || '').trim(),
      city: (editing.city || '').trim(),
      state: (editing.state || '').trim(),
      postal_code: (editing.postal_code || '').replace(/[\s-]+/g, '').toUpperCase(),
      latitude: roundCoordinate(editing.lat),
      longitude: roundCoordinate(editing.lng),
      radius_miles: editing.radiusMiles,
      is_primary: Boolean(editing.is_primary),
      is_active: true,
    };
    try {
      if (editing.id) {
        await orgProfileAPI.updateLocation(orgSlug, editing.id, payload);
        setMessage('Location updated.');
      } else {
        await orgProfileAPI.createLocation(orgSlug, payload);
        setMessage('Location added.');
      }
      setEditing(null);
      onSaved?.();
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (loc) => {
    if (!orgSlug || !isOwner || !loc?.id) return;
    if (!window.confirm(`Remove “${loc.name || formatLocationLine(loc)}”?`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await orgProfileAPI.deleteLocation(orgSlug, loc.id);
      setMessage('Location removed.');
      if (editing?.id === loc.id) setEditing(null);
      onSaved?.();
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const makePrimary = async (loc) => {
    if (!orgSlug || !isOwner || !loc?.id || loc.is_primary) return;
    setSaving(true);
    setError(null);
    try {
      await orgProfileAPI.updateLocation(orgSlug, loc.id, { is_primary: true });
      setMessage('Primary location updated.');
      onSaved?.();
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading locations…</p>;
  }

  return (
    <section className={embedded ? 'space-y-3' : 'lx-card'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!embedded && (
            <h2 className="text-sm font-semibold uppercase text-slate-500">Service locations</h2>
          )}
          <p className={`${embedded ? '' : 'mt-1 '}text-sm text-slate-600`}>
            You can keep multiple locations on this business, or register a separate business account
            per branch. Customers searching by ZIP and miles match if they are near any location on
            this profile.
          </p>
        </div>
        {isOwner && !editing && !showAddChoice && (
          <button
            type="button"
            onClick={startAdd}
            className="min-h-[40px] shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            + Add location
          </button>
        )}
      </div>

      {isOwner && showAddChoice && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Adding another location
              </h3>
              <p className="mt-1 text-sm text-slate-700">
                You already have {locations.length} location{locations.length === 1 ? '' : 's'} on
                this business. Choose how you want to manage the next one:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddChoice(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
          <ul className="space-y-2">
            <li className="rounded-xl border border-white bg-white p-3 shadow-sm">
              <p className="text-sm font-medium text-slate-900">
                Create a separate business account
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Best if each branch has its own staff, calendar, booking policy, or branding. Each
                account is found and booked independently.
              </p>
              <Link
                to="/register/business"
                className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white"
              >
                Register another business
              </Link>
            </li>
            <li className="rounded-xl border border-white bg-white p-3 shadow-sm">
              <p className="text-sm font-medium text-slate-900">
                Keep both locations on this profile
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Use this when it&apos;s the same business with multiple service areas. Customers can
                find you near either location; you share one schedule and settings.
              </p>
              <button
                type="button"
                onClick={beginAddLocation}
                className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Add location to this business
              </button>
            </li>
          </ul>
        </div>
      )}

      {!isOwner && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Only the business owner can change service locations.
        </p>
      )}

      {!editing && (
        <ul className="mt-4 space-y-2">
          {locations.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No locations yet. Add your first city or address so customers can find you.
            </li>
          )}
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">
                    {loc.name?.trim() || formatLocationLine(loc)}
                  </p>
                  {loc.is_primary && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
                      Primary
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{formatLocationLine(loc)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Serves within {formatRadiusMiles(Number(loc.radius_miles) || DEFAULT_RADIUS_MILES)}
                </p>
              </div>
              {isOwner && (
                <div className="flex flex-wrap gap-2">
                  {!loc.is_primary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(loc)}
                      disabled={saving}
                      className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(loc)}
                    disabled={saving}
                    className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-luminexa-accent hover:bg-violet-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(loc)}
                    disabled={saving}
                    className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && editing && (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {editing.id ? 'Edit location' : 'New location'}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="loc-name">
                Label (optional)
              </label>
              <input
                id="loc-name"
                type="text"
                value={editing.name}
                onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Downtown, North branch"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(editing.is_primary)}
                onChange={(e) => setEditing((p) => ({ ...p, is_primary: e.target.checked }))}
              />
              Primary location (shown on storefront / invoices)
            </label>
          </div>

          <ServiceAreaRadiusMap
            lat={editing.lat}
            lng={editing.lng}
            radiusMiles={editing.radiusMiles}
            onLocationChange={handleMapLocationChange}
            onRadiusChange={(r) => setEditing((p) => ({ ...p, radiusMiles: r }))}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing.id ? 'Save location' : 'Add location'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
