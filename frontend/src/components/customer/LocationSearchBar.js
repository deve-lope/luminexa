import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressSearchField from '../location/AddressSearchField';
import useCurrentLocation from '../../hooks/useCurrentLocation';
import {
  DEFAULT_RADIUS_MILES,
  MILES_TO_METERS,
  RADIUS_MILE_OPTIONS,
  formatRadiusMiles,
} from '../../constants/locationSearch';
import { canUseBrowserGeolocation } from '../../utils/geolocationSupport';
import { bookService } from '../../utils/customerPaths';

const centerPin = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0f172a;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function providerPin(count) {
  const size = count > 1 ? 30 : 24;
  const label = count > 1 ? `<span style="font-size:10px;font-weight:700;color:white">${count}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#7c3aed;border:2.5px solid white;box-shadow:0 2px 8px rgba(124,58,237,.4);display:flex;align-items:center;justify-content:center">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function groupByOrg(services) {
  const map = {};
  for (const s of (services || [])) {
    const key = s.organization_slug;
    if (!map[key]) {
      map[key] = {
        slug: key,
        name: s.organization_name,
        location_short: s.location_short || s.location || '',
        lat: s.org_lat,
        lng: s.org_lng,
        services: [],
      };
    }
    map[key].services.push(s);
  }
  return Object.values(map).filter((o) => o.lat != null && o.lng != null);
}

/**
 * Customer location search bar with embedded live map.
 * Uses AddressSearchField + useCurrentLocation (same as provider side).
 * Shows a Leaflet map with radius circle + provider markers once a location is set.
 */
export default function LocationSearchBar({
  radiusMiles = DEFAULT_RADIUS_MILES,
  onLocationChange,
  onRadiusChange,
  onClear,
  services = [],
}) {
  const [locationLabel, setLocationLabel] = useState('');
  const [hasLocation, setHasLocation] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [pendingRadius, setPendingRadius] = useState(radiusMiles);
  const gpsAvailable = canUseBrowserGeolocation();
  const { locating, error: locError, setError: setLocError, fetchCurrentLocation } =
    useCurrentLocation();

  // Map refs
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const providerMarkersRef = useRef([]);

  // Init Leaflet map when location is set
  useEffect(() => {
    if (!hasLocation || !mapEl.current || mapRef.current) return undefined;

    const map = L.map(mapEl.current, {
      center: [lat, lng],
      zoom: 11,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.control.scale({ imperial: true, metric: false }).addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      centerMarkerRef.current = null;
      providerMarkersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation]);

  // Draw/update center pin and radius circle when lat/lng/radius changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;

    const meters = pendingRadius * MILES_TO_METERS;

    if (!circleRef.current) {
      circleRef.current = L.circle([lat, lng], {
        radius: meters,
        color: '#7c3aed',
        fillColor: '#7c3aed',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([lat, lng]).setRadius(meters);
    }

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = L.marker([lat, lng], { icon: centerPin }).addTo(map);
    } else {
      centerMarkerRef.current.setLatLng([lat, lng]);
    }

    map.fitBounds(circleRef.current.getBounds(), { padding: [28, 28], maxZoom: 13, animate: true });
  }, [lat, lng, pendingRadius]);

  // Draw provider markers whenever services change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    providerMarkersRef.current.forEach((m) => m.remove());
    providerMarkersRef.current = [];

    groupByOrg(services).forEach((org) => {
      const marker = L.marker([org.lat, org.lng], { icon: providerPin(org.services.length) }).addTo(map);
      const serviceLinks = org.services
        .slice(0, 4)
        .map(
          (s) =>
            `<a href="${bookService(org.slug, s.id)}" style="display:block;padding:3px 0;color:#7c3aed;font-size:13px;text-decoration:none">${s.name}${s.show_price !== false && s.base_price ? ` · $${Number(s.base_price).toFixed(0)}` : ''}</a>`
        )
        .join('');
      const more = org.services.length > 4 ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">+${org.services.length - 4} more</p>` : '';
      marker.bindPopup(
        `<div style="min-width:160px;max-width:210px"><p style="font-weight:700;font-size:14px;margin:0 0 2px">${org.name}</p><p style="color:#64748b;font-size:12px;margin:0 0 6px">${org.location_short}</p>${serviceLinks}${more}</div>`,
        { maxWidth: 230 }
      );
      providerMarkersRef.current.push(marker);
    });
  }, [services]);

  const applyLocation = (payload, label) => {
    const nextLat = payload.lat ?? payload.latitude;
    const nextLng = payload.lng ?? payload.longitude;
    if (nextLat == null || nextLng == null) return;
    const displayLabel =
      label ||
      [payload.city, payload.state || payload.province, payload.postal_code]
        .filter(Boolean)
        .join(', ') ||
      payload.address ||
      'Selected location';
    setLocationLabel(displayLabel);
    setLat(nextLat);
    setLng(nextLng);
    setHasLocation(true);
    onLocationChange?.({ lat: nextLat, lng: nextLng, label: displayLabel, radiusMiles: pendingRadius });
  };

  const handleAddressSelect = (payload) => {
    applyLocation(payload, payload.address || payload.display_name || '');
  };

  const handleGPS = async () => {
    setLocError(null);
    const result = await fetchCurrentLocation();
    if (result) applyLocation(result, result.address || '');
  };

  const handleRadiusChange = (e) => {
    const next = Number(e.target.value);
    setPendingRadius(next);
    // Update circle live
    if (circleRef.current) {
      circleRef.current.setRadius(next * MILES_TO_METERS);
      if (mapRef.current) {
        mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [28, 28], maxZoom: 13 });
      }
    }
    onRadiusChange?.(next);
  };

  const handleClear = () => {
    setLocationLabel('');
    setLat(null);
    setLng(null);
    setHasLocation(false);
    setPendingRadius(DEFAULT_RADIUS_MILES);
    setLocError(null);
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      circleRef.current = null;
      centerMarkerRef.current = null;
      providerMarkersRef.current = [];
    }
    onClear?.();
  };

  const orgsOnMap = groupByOrg(services);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Near you</p>
        {hasLocation && (
          <button type="button" onClick={handleClear} className="text-xs font-medium text-luminexa-accent">
            Clear
          </button>
        )}
      </div>

      {/* Active location pill */}
      {hasLocation ? (
        <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2">
          <svg className="h-3.5 w-3.5 shrink-0 text-luminexa-accent" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
          </svg>
          <span className="flex-1 truncate text-sm font-medium text-violet-900">{locationLabel}</span>
          <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ) : (
        <>
          <AddressSearchField
            id="customer-location-search"
            label=""
            placeholder="City, postal code, or address…"
            onSelect={handleAddressSelect}
          />
          {gpsAvailable && (
            <button
              type="button"
              onClick={handleGPS}
              disabled={locating}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-sm font-medium text-luminexa-accent disabled:opacity-50"
            >
              {locating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Getting your location…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  </svg>
                  Use my current location
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* Live map — shown once a location is set */}
      {hasLocation && (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div ref={mapEl} className="h-[280px] w-full bg-slate-100" />
          </div>

          {/* Radius slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Search within</span>
              <span className="font-semibold text-luminexa-accent">{formatRadiusMiles(pendingRadius)}</span>
            </div>
            <input
              type="range"
              min={RADIUS_MILE_OPTIONS[0].value}
              max={RADIUS_MILE_OPTIONS[RADIUS_MILE_OPTIONS.length - 1].value}
              step={1}
              value={pendingRadius}
              onChange={handleRadiusChange}
              className="w-full accent-luminexa-accent"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              {RADIUS_MILE_OPTIONS.map((o) => <span key={o.value}>{o.value} mi</span>)}
            </div>
          </div>

          {/* Provider summary */}
          {orgsOnMap.length > 0 ? (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{orgsOnMap.length}</span> provider{orgsOnMap.length !== 1 ? 's' : ''} in this area — tap a marker to see services.
            </p>
          ) : (
            <p className="text-xs text-slate-500">No providers found in this area. Try widening the radius.</p>
          )}
        </>
      )}

      {locError && <p className="text-xs text-amber-700">{locError}</p>}
    </div>
  );
}
