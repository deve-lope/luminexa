import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';

export default function PhotosPage() {
  const { orgSlug } = useProviderOrg();
  const [photos, setPhotos] = useState([]);
  const [dateFilter, setDateFilter] = useState('');
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    const params = dateFilter ? { date: dateFilter } : {};
    jobsAPI
      .listDispatchPhotos(orgSlug, params)
      .then((res) => setPhotos(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, dateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = {};
    photos.forEach((p) => {
      const d = (p.created_at || '').slice(0, 10) || 'unknown';
      if (!map[d]) map[d] = [];
      map[d].push(p);
    });
    return map;
  }, [photos]);

  const dates = Object.keys(byDate).sort().reverse();

  const toggle = (id) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectAllForDate = (date) => {
    setSelected((s) => {
      const next = { ...s };
      (byDate[date] || []).forEach((p) => {
        next[p.id] = true;
      });
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} photo(s)?`)) return;
    setBusy(true);
    try {
      await jobsAPI.deleteDispatchPhotos(orgSlug, { ids: ids.map(Number) });
      setSelected({});
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteDate = async (date) => {
    if (!window.confirm(`Delete all photos from ${date}?`)) return;
    setBusy(true);
    try {
      await jobsAPI.deleteDispatchPhotos(orgSlug, { date });
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Proof photos</h1>
        <p className="mt-1 text-sm text-slate-600">Auto-deleted after 3 days · 200 photo quota.</p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          className="lx-input text-sm"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !Object.keys(selected).some((k) => selected[k])}
          onClick={deleteSelected}
          className="lx-btn-secondary text-sm"
        >
          Delete selected
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {dates.map((date) => (
        <section key={date} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{date}</h2>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => selectAllForDate(date)} className="text-luminexa-accent">
                Select all
              </button>
              <button type="button" onClick={() => deleteDate(date)} className="text-red-600">
                Delete day
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(byDate[date] || []).map((p) => (
              <label key={p.id} className="relative block cursor-pointer overflow-hidden rounded-lg ring-2 ring-transparent has-[:checked]:ring-teal-500">
                <input
                  type="checkbox"
                  className="absolute left-1 top-1 z-10"
                  checked={Boolean(selected[p.id])}
                  onChange={() => toggle(p.id)}
                />
                {p.url || p.thumbnail_url ? (
                  <img src={p.url || p.thumbnail_url} alt="" className="aspect-square w-full object-cover bg-slate-100" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-100 text-xs text-slate-500">
                    Photo {p.id}
                  </div>
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      {!loading && !photos.length && (
        <p className="text-center text-sm text-slate-500">No photos yet.</p>
      )}
    </div>
  );
}
