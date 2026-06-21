import React, { useCallback, useEffect, useState } from 'react';
import ServiceAreaRadiusMap from '../location/ServiceAreaRadiusMap';
import { businessesAPI, orgProfileAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { DEFAULT_RADIUS_MILES, formatRadiusMiles } from '../../constants/locationSearch';
import { roundCoordinate, roundCoordinatePair } from '../../utils/coordinates';

function formatServiceAreaSummary({ address, city, state, postalCode, radiusMiles }) {
  const place = [city, state].filter(Boolean).join(', ') || address;
  const radiusLabel = formatRadiusMiles(radiusMiles);
  if (place) {
    return `${radiusLabel} from ${place}${postalCode ? ` · ${postalCode}` : ''}`;
  }
  if (postalCode) {
    return `${radiusLabel} from ${postalCode}`;
  }
  return `${radiusLabel} from your map pin`;
}

/**
 * Marketplace-style service area — map center + visible radius circle.
 */
export default function ProviderServiceAreaSettings({ orgSlug, isOwner, onSaved }) {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [serviceCity, setServiceCity] = useState('');
  const [servicePostalCode, setServicePostalCode] = useState('');
  const [serviceState, setServiceState] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    businessesAPI
      .getPublicStorefront(orgSlug)
      .then((res) => {
        const org = res.data?.organization;
        if (!org) return;
        setServiceCity(org.service_city || '');
        setServicePostalCode(org.service_postal_code || '');
        setServiceState(org.service_state || '');
        setServiceAddress(org.service_address || '');
        setRadiusMiles(Number(org.service_radius_miles) || DEFAULT_RADIUS_MILES);
        if (org.service_latitude != null && org.service_longitude != null) {
          const rounded = roundCoordinatePair(org.service_latitude, org.service_longitude);
          setLat(rounded.lat);
          setLng(rounded.lng);
        } else {
          setLat(null);
          setLng(null);
        }
      })
      .catch(() => setError('Could not load service area.'))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLocationChange = useCallback((payload) => {
    const rounded = roundCoordinatePair(payload.lat, payload.lng);
    setLat(rounded.lat);
    setLng(rounded.lng);
    if (payload.city) setServiceCity(payload.city);
    if (payload.state) setServiceState(payload.state);
    if (payload.postal_code) {
      setServicePostalCode(payload.postal_code.replace(/[\s-]+/g, '').toUpperCase());
    }
    if (payload.address) setServiceAddress(payload.address);
  }, []);

  const save = async () => {
    if (!orgSlug || !isOwner) return;
    if (lat == null || lng == null) {
      setError('Pick a location on the map or search for your city.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, {
        service_latitude: roundCoordinate(lat),
        service_longitude: roundCoordinate(lng),
        service_radius_miles: radiusMiles,
        service_city: serviceCity.trim(),
        service_postal_code: servicePostalCode.replace(/[\s-]+/g, '').toUpperCase(),
        service_state: serviceState.trim(),
        service_address: serviceAddress.trim(),
      });
      setMessage('Service area saved.');
      onSaved?.();
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const hasArea = lat != null && lng != null;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading service area…</p>;
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Service area</h2>
      <p className="mt-1 text-sm text-slate-600">
        Like Marketplace — choose your city or address, then set how far you travel. The circle shows
        where customers can find you.
      </p>
      {hasArea && (
        <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <span className="font-medium">Current area:</span>{' '}
          {formatServiceAreaSummary({
            address: serviceAddress,
            city: serviceCity,
            state: serviceState,
            postalCode: servicePostalCode,
            radiusMiles,
          })}
        </p>
      )}
      {!isOwner && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Only the business owner can change the service area.
        </p>
      )}
      {isOwner && (
        <div className="mt-4 space-y-4">
          <ServiceAreaRadiusMap
            lat={lat}
            lng={lng}
            radiusMiles={radiusMiles}
            onLocationChange={handleLocationChange}
            onRadiusChange={setRadiusMiles}
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save service area'}
          </button>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
