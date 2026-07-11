import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { businessesAPI } from '../../utils/api';
import {
  DEFAULT_RADIUS_MILES,
  MILES_TO_METERS,
  RADIUS_MILE_OPTIONS,
  formatRadiusMiles,
} from '../../constants/locationSearch';
import { canUseBrowserGeolocation } from '../../utils/geolocationSupport';
import { bookService } from '../../utils/customerPaths';
import {
  formatPostalLabel,
  isPostalSearchReady,
  normalizePostalInput,
} from '../../utils/postalInput';

const DEFAULT_CENTER = [43.6532, -79.3832];

const userPin = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#0f172a;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.5)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function providerPin(count) {
  const size = count > 1 ? 32 : 26;
  const label = count > 1 ? `<span style="font-size:11px;font-weight:700;color:white">${count}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#7c3aed;border:2.5px solid white;box-shadow:0 2px 8px rgba(124,58,237,.4);display:flex;align-items:center;justify-content:center">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Groups services by organization (one map marker per org).
 */
function groupByOrg(services) {
  const map = {};
  for (const s of services) {
    const key = s.organization_slug;
    if (!map[key]) {
      map[key] = {
        slug: key,
        public_ref: s.organization_public_ref,
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

export default function CustomerSearchMapView({ services, onLocationSearch }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const providerMarkersRef = useRef([]);
  const radiusRef = useRef(DEFAULT_RADIUS_MILES);

  const [postal, setPostal] = useState('');
  const [centerLat, setCenterLat] = useState(null);
  const [centerLng, setCenterLng] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const lookupSeq = useRef(0);
  const gpsAvailable = canUseBrowserGeolocation();

  // Keep radius ref in sync
  useEffect(() => { radiusRef.current = radiusMiles; }, [radiusMiles]);

  // Init map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, { center: DEFAULT_CENTER, zoom: 9, zoomControl: true });
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
  }, []);

  const applyCenter = useCallback((lat, lng, radius) => {
    const map = mapRef.current;
    if (!map) return;
    const meters = (radius || radiusRef.current) * MILES_TO_METERS;

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
      centerMarkerRef.current = L.marker([lat, lng], { icon: userPin }).addTo(map);
    } else {
      centerMarkerRef.current.setLatLng([lat, lng]);
    }

    map.fitBounds(circleRef.current.getBounds(), { padding: [32, 32], maxZoom: 13, animate: true });
    setCenterLat(lat);
    setCenterLng(lng);
  }, []);

  // Update circle radius when slider changes
  const handleRadiusChange = (e) => {
    const next = Number(e.target.value);
    setRadiusMiles(next);
    if (circleRef.current && centerLat != null) {
      circleRef.current.setRadius(next * MILES_TO_METERS);
      mapRef.current?.fitBounds(circleRef.current.getBounds(), { padding: [32, 32], maxZoom: 13 });
    }
    if (centerLat != null && postal) {
      onLocationSearch?.({
        postal: normalizePostalInput(postal),
        lat: centerLat,
        lng: centerLng,
        radiusMiles: next,
      });
    }
  };

  const searchFromPostal = useCallback(
    async (rawPostal) => {
      const normalized = normalizePostalInput(rawPostal);
      if (!isPostalSearchReady(normalized)) return;

      const seq = ++lookupSeq.current;
      setLookupStatus('loading');
      setError(null);

      let lat = null;
      let lng = null;
      try {
        const res = await businessesAPI.lookupPostalCode(normalized);
        lat = res.data?.latitude ?? null;
        lng = res.data?.longitude ?? null;
      } catch {
        lat = null;
        lng = null;
      }
      if (seq !== lookupSeq.current) return;

      setPostal(normalized);
      setLookupStatus('success');
      if (lat != null && lng != null) {
        applyCenter(lat, lng, radiusRef.current);
      }
      onLocationSearch?.({
        postal: normalized,
        lat,
        lng,
        radiusMiles: radiusRef.current,
      });
    },
    [applyCenter, onLocationSearch]
  );

  useEffect(() => {
    const normalized = normalizePostalInput(postal);
    if (!normalized || !isPostalSearchReady(normalized)) {
      setLookupStatus('idle');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      searchFromPostal(normalized);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [postal, searchFromPostal]);

  // Draw provider markers whenever services change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    providerMarkersRef.current.forEach((m) => m.remove());
    providerMarkersRef.current = [];

    const orgs = groupByOrg(services || []);
    orgs.forEach((org) => {
      const icon = providerPin(org.services.length);
      const marker = L.marker([org.lat, org.lng], { icon }).addTo(map);

      const serviceLinks = org.services
        .slice(0, 4)
        .map(
          (s) =>
            `<a href="${bookService(org.slug, s.id)}" style="display:block;padding:4px 0;color:#7c3aed;font-size:13px;text-decoration:none">
              ${s.name}${s.show_price !== false && s.base_price ? ` · $${Number(s.base_price).toFixed(0)}` : ''}
            </a>`
        )
        .join('');
      const more = org.services.length > 4
        ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">+${org.services.length - 4} more</p>`
        : '';

      marker.bindPopup(
        `<div style="min-width:180px;max-width:220px">
          <p style="font-weight:700;font-size:14px;margin:0 0 2px">${org.name}</p>
          <p style="color:#64748b;font-size:12px;margin:0 0 8px">${org.location_short}</p>
          ${serviceLinks}
          ${more}
        </div>`,
        { maxWidth: 240 }
      );

      providerMarkersRef.current.push(marker);
    });
  }, [services]);

  const doLocationSearch = useCallback(
    (lat, lng, nextPostal) => {
      applyCenter(lat, lng, radiusRef.current);
      onLocationSearch?.({
        postal: nextPostal ? normalizePostalInput(nextPostal) : normalizePostalInput(postal),
        lat,
        lng,
        radiusMiles: radiusRef.current,
      });
    },
    [applyCenter, onLocationSearch, postal]
  );

  const handleUseLocation = () => {
    if (!gpsAvailable) return;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await businessesAPI.reverseGeocode({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          const code = normalizePostalInput(res.data?.postal_code);
          if (code) {
            setPostal(code);
          } else {
            doLocationSearch(pos.coords.latitude, pos.coords.longitude);
          }
        } catch {
          doLocationSearch(pos.coords.latitude, pos.coords.longitude);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError('Could not get your location. Enter your ZIP / postal code instead.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const orgsOnMap = groupByOrg(services || []);

  return (
    <div className="space-y-3">
      {/* ZIP / postal code */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="map-postal-search" className="mb-1 block text-xs font-medium text-slate-600">
            ZIP / postal code
          </label>
          <input
            id="map-postal-search"
            value={formatPostalLabel(postal)}
            onChange={(e) => setPostal(normalizePostalInput(e.target.value))}
            placeholder="e.g. 90210 or M5V 2T6"
            autoComplete="postal-code"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
        </div>
        <div className="w-32">
          <label htmlFor="map-radius-search" className="mb-1 block text-xs font-medium text-slate-600">
            Within
          </label>
          <select
            id="map-radius-search"
            value={radiusMiles}
            onChange={handleRadiusChange}
            disabled={!isPostalSearchReady(postal)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-luminexa-accent disabled:bg-slate-50"
          >
            {RADIUS_MILE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {gpsAvailable && (
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              title="Use my location"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
            >
              {locating ? '…' : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      {lookupStatus === 'loading' && (
        <p className="text-xs text-slate-500">Looking up your area…</p>
      )}

      {error && <p className="text-xs text-amber-700">{error}</p>}

      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div ref={mapEl} className="h-[380px] w-full bg-slate-100 md:h-[460px]" />
      </div>

      {/* Radius slider — only shown when a center is set */}
      {centerLat != null && (
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Search radius</span>
            <span className="text-sm font-semibold text-luminexa-accent">{formatRadiusMiles(radiusMiles)}</span>
          </div>
          <input
            type="range"
            min={RADIUS_MILE_OPTIONS[0].value}
            max={RADIUS_MILE_OPTIONS[RADIUS_MILE_OPTIONS.length - 1].value}
            step={1}
            value={radiusMiles}
            onChange={handleRadiusChange}
            className="w-full accent-luminexa-accent"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            {RADIUS_MILE_OPTIONS.map((o) => <span key={o.value}>{o.value} mi</span>)}
          </div>
        </div>
      )}

      {/* Provider count summary */}
      {centerLat == null ? (
        <p className="text-center text-sm text-slate-500">
          Enter your ZIP / postal code or use your location to find nearby providers.
        </p>
      ) : orgsOnMap.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-4 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
          No providers with a set location found in this area. Try widening the radius.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{orgsOnMap.length}</span> provider
          {orgsOnMap.length !== 1 ? 's' : ''} on the map — tap a marker to see their services.
        </p>
      )}
    </div>
  );
}
