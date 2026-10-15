import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';
import {
  appleMapsDirectionsUrl,
  googleMapsDirectionsUrl,
} from '../../../components/booking/ServiceAddressBlock';
import { mapsDestinationFromStop } from '../../../utils/snowDispatch';

const PING_MS = 120000;

function nextPendingStop(route) {
  const stops = route?.stops || [];
  return stops.find((s) => s.status === 'pending') || stops[0];
}

export default function CrewRunPage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const pingRef = useRef(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    jobsAPI
      .listCrewMyRoutes(orgSlug)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.routes || res.data?.results || [];
        setRoutes(list);
        setActiveRoute((cur) => cur || list.find((r) => r.status === 'in_progress') || list[0] || null);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const stop = useMemo(() => nextPendingStop(activeRoute), [activeRoute]);

  const sendLocation = useCallback(async () => {
    if (!orgSlug || !activeRoute?.id) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        jobsAPI
          .pingCrewRouteLocation(orgSlug, activeRoute.id, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 }
    );
  }, [orgSlug, activeRoute?.id]);

  useEffect(() => {
    if (!activeRoute || activeRoute.status !== 'in_progress') {
      if (pingRef.current) window.clearInterval(pingRef.current);
      pingRef.current = null;
      return undefined;
    }
    sendLocation();
    pingRef.current = window.setInterval(sendLocation, PING_MS);
    return () => {
      if (pingRef.current) window.clearInterval(pingRef.current);
    };
  }, [activeRoute, sendLocation]);

  const startRoute = async () => {
    if (!activeRoute?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await jobsAPI.startCrewRoute(orgSlug, activeRoute.id);
      setActiveRoute(res.data?.route || res.data || activeRoute);
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const markDone = async () => {
    if (!stop?.id) return;
    setBusy(true);
    try {
      await jobsAPI.markDispatchStopDone(orgSlug, stop.id);
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const markSkip = async () => {
    if (!stop?.id) return;
    setBusy(true);
    try {
      await jobsAPI.markDispatchStopSkip(orgSlug, stop.id, { reason: skipReason || 'skipped' });
      setSkipReason('');
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file) => {
    if (!stop?.id || !file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await jobsAPI.uploadDispatchStopPhoto(orgSlug, stop.id, fd);
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const mapsDest = mapsDestinationFromStop(stop);
  const googleUrl = googleMapsDirectionsUrl(mapsDest);
  const appleUrl = appleMapsDirectionsUrl(mapsDest);

  const progress = activeRoute?.progress_percent ?? activeRoute?.percent ?? 0;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My run</h1>
        <p className="mt-1 text-sm text-slate-600">
          {activeOrg?.organization_name || 'Your team'}
        </p>
      </div>

      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
        Keep this app open while driving so your dispatcher can see progress.
      </p>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && !routes.length && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No run assigned yet.
        </p>
      )}

      {routes.length > 1 && (
        <select
          className="lx-input w-full text-sm"
          value={activeRoute?.id || ''}
          onChange={(e) => {
            const r = routes.find((x) => String(x.id) === e.target.value);
            setActiveRoute(r || null);
          }}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.run_date || 'Run'} · {r.status}
            </option>
          ))}
        </select>
      )}

      {activeRoute && (
        <>
          {activeRoute.status === 'not_started' && (
            <button
              type="button"
              disabled={busy}
              onClick={startRoute}
              className="lx-btn-primary w-full min-h-[52px] text-base"
            >
              Start run
            </button>
          )}

          {activeRoute.status === 'in_progress' && (
            <p className="text-sm font-medium text-teal-800">Progress {Math.round(progress)}%</p>
          )}

          {stop && activeRoute.status === 'in_progress' && (
            <section className="lx-card space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Next stop</p>
                <p className="mt-1 text-lg font-bold text-slate-900 whitespace-pre-wrap">
                  {stop.address || stop.service_line1 || 'Address'}
                </p>
                <p className="mt-1 text-sm text-slate-600 capitalize">
                  {stop.work_type} · {stop.house_type?.replace(/_/g, ' ')}
                </p>
                {stop.notes && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {stop.notes}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {googleUrl && (
                  <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="lx-btn-secondary min-h-[44px] text-center">
                    Google Maps
                  </a>
                )}
                {appleUrl && (
                  <a href={appleUrl} target="_blank" rel="noopener noreferrer" className="lx-btn-secondary min-h-[44px] text-center">
                    Apple Maps
                  </a>
                )}
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Proof photo (max 2)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-1 block w-full text-sm"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) uploadPhoto(f);
                  }}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={markDone}
                  className="lx-btn-primary min-h-[48px] flex-1"
                >
                  Done
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={markSkip}
                  className="lx-btn-secondary min-h-[48px] flex-1"
                >
                  Skip
                </button>
              </div>
              <input
                className="lx-input w-full text-sm"
                placeholder="Skip reason (optional)"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
              />
            </section>
          )}

          {activeRoute.status === 'done' && (
            <p className="text-center text-sm font-medium text-emerald-700">Route complete.</p>
          )}
        </>
      )}
    </div>
  );
}
