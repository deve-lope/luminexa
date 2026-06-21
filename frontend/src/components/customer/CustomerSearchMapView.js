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

  const [centerLat, setCenterLat] = useState(null);
  const [centerLng, setCenterLng] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
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
    if (centerLat != null) {
      onLocationSearch?.({ lat: centerLat, lng: centerLng, radiusMiles: next });
    }
  };

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
    (lat, lng) => {
      applyCenter(lat, lng, radiusRef.current);
      onLocationSearch?.({ lat, lng, radiusMiles: radiusRef.current });
    },
    [applyCenter, onLocationSearch]
  );

  const handleUseLocation = () => {
    if (!gpsAvailable) return;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        doLocationSearch(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setError('Could not get your location. Try searching an address.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const runSearch = useCallback(async (q) => {
    if ((q || '').trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      const res = await businessesAPI.searchMapLocations(q.trim());
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      setSearchResults(results);
      if (!results.length) setError('No locations found.');
    } catch {
      setError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) { setSearchResults([]); return undefined; }
    const t = window.setTimeout(() => runSearch(q), 450);
    return () => window.clearTimeout(t);
  }, [runSearch, searchQuery]);

  const selectResult = (item) => {
    setSearchResults([]);
    setSearchQuery(item.display_name || '');
    doLocationSearch(item.latitude, item.longitude);
  };

  const orgsOnMap = groupByOrg(services || []);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch(searchQuery)}
              placeholder="Search city or address to center map…"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          {gpsAvailable && (
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              title="Use my location"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
            >
              {locating ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              )}
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {searchResults.slice(0, 6).map((item) => (
              <li key={`${item.latitude}-${item.longitude}`}>
                <button
                  type="button"
                  onClick={() => selectResult(item)}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm text-slate-800 last:border-b-0 hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
                  </svg>
                  <span className="truncate">{item.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
          Search an address or tap "Use my location" to find nearby providers.
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
