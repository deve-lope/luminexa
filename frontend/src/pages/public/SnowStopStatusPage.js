import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

export default function SnowStopStatusPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    jobsAPI
      .getPublicSnowStop(token)
      .then((res) => setData(res.data))
      .catch((e) => setError(parseApiError(e) || 'Status unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const crew = data?.crew_location;

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-teal-700">
          Luminexa snow service
        </p>
        <h1 className="text-center text-2xl font-bold text-slate-900">Your stop status</h1>

        {loading && <p className="text-center text-sm text-slate-500">Loading…</p>}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">{error}</p>
        )}

        {data && (
          <section className="lx-card space-y-3 text-center">
            <p className="text-lg font-semibold capitalize text-slate-900">{data.status || 'pending'}</p>
            {data.eta_at && (
              <p className="text-sm text-slate-600">
                ETA {new Date(data.eta_at).toLocaleString()}
              </p>
            )}
            {data.message && <p className="text-sm text-slate-600">{data.message}</p>}
            {crew && (
              <p className="text-sm text-teal-800">
                Crew nearby (~{crew.distance_km != null ? `${Number(crew.distance_km).toFixed(1)} km` : 'en route'})
              </p>
            )}
            {!crew && data.status === 'pending' && (
              <p className="text-xs text-slate-500">
                Live crew map appears when they are close and on the way.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
