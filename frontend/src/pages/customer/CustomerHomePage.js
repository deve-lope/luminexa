import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import CustomerSearchResults from '../../components/customer/CustomerSearchResults';
import ScheduledProviderCard from '../../components/customer/ScheduledProviderCard';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import { DEFAULT_RADIUS_MILES } from '../../constants/locationSearch';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { customerBookings, customerFind } from '../../utils/customerPaths';

function bookingStatusClass(status) {
  if (status === 'requested') return 'bg-amber-100 text-amber-800';
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-700';
}

function initials(name) {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0][0] || 'U').toUpperCase();
}

export default function CustomerHomePage() {
  const { user } = useAuth();
  const [home, setHome] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [postal, setPostal] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    businessesAPI
      .getCustomerHome()
      .then((res) => {
        if (!cancelled) setHome(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedQuery = query.trim();
  const trimmedPostal = postal.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2 && !trimmedPostal) {
      setSearchResults(null);
      setSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      const params = {};
      if (trimmedQuery.length >= 2) params.q = trimmedQuery;
      if (trimmedPostal) {
        params.postal = trimmedPostal;
        params.radius_miles = radiusMiles;
      }
      businessesAPI
        .discoverServices(params)
        .then((res) => {
          if (!cancelled) setSearchResults(res.data);
        })
        .catch(() => {
          if (!cancelled) setSearchResults({ business_types: [], providers: [], services: [] });
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, trimmedPostal, radiusMiles]);

  const filteredTypes = useMemo(() => {
    const types = home?.business_types || [];
    const q = trimmedQuery.toLowerCase();
    if (!q || q.length < 2) return types;
    return types.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.slug?.toLowerCase().includes(q)
    );
  }, [home?.business_types, trimmedQuery]);

  const isSearching = trimmedQuery.length >= 2 || Boolean(trimmedPostal);
  const firstName = (user?.full_name || '').split(' ')[0] || 'there';

  if (loading) {
    return <p className="text-sm text-slate-500">Loading your dashboard…</p>;
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  const providers = home?.providers || [];
  const upcoming = home?.upcoming_bookings || [];

  return (
    <div className="space-y-5 pb-4">
      {!isSearching && (
        <header className="rounded-2xl bg-gradient-to-br from-luminexa-navy via-violet-900 to-indigo-900 p-5 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
              {initials(user?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-violet-200">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <h2 className="text-xl font-bold">Hi, {firstName}</h2>
              <p className="mt-0.5 text-sm text-white/70">What do you need booked today?</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link
              to={customerFind()}
              className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-white/10 px-2 text-center active:bg-white/20"
            >
              <span className="text-lg" aria-hidden>
                🔍
              </span>
              <span className="mt-1 text-xs font-semibold">Find</span>
            </Link>
            <Link
              to={customerBookings()}
              className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-white/10 px-2 text-center active:bg-white/20"
            >
              <span className="text-lg" aria-hidden>
                📅
              </span>
              <span className="mt-1 text-xs font-semibold">Bookings</span>
            </Link>
            <Link
              to="/services"
              className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-white/10 px-2 text-center active:bg-white/20"
            >
              <span className="text-lg" aria-hidden>
                ✨
              </span>
              <span className="mt-1 text-xs font-semibold">Browse</span>
            </Link>
          </div>
        </header>
      )}

      <ServiceSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search services, providers, or categories…"
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Near you</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs font-medium text-slate-600">
            Postal code
            <input
              type="text"
              autoComplete="postal-code"
              value={postal}
              onChange={(e) => setPostal(e.target.value.toUpperCase().replace(/[\s-]+/g, ''))}
              placeholder="e.g. K1A0B1"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Radius
            <select
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              disabled={!trimmedPostal}
              className="mt-1 w-full min-w-[7rem] rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
            >
              <option value={5}>5 mi</option>
              <option value={10}>10 mi</option>
              <option value={25}>25 mi</option>
              <option value={50}>50 mi</option>
            </select>
          </label>
        </div>
      </div>

      {isSearching ? (
        <CustomerSearchResults
          results={searchResults}
          query={trimmedQuery}
          loading={searchLoading}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Up next</h2>
                <Link to={customerBookings()} className="text-sm font-medium text-luminexa-accent">
                  All
                </Link>
              </div>
              <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
                {upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="w-[min(85vw,280px)] shrink-0 snap-start rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
                  >
                    <p className="font-semibold text-slate-900">{b.service_name}</p>
                    <p className="text-sm text-slate-600">{b.organization_name}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{formatWhen(b.start_at)}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs capitalize ${bookingStatusClass(b.status)}`}
                    >
                      {b.status === 'requested' ? 'Awaiting provider' : b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {providers.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Your providers</h2>
              <ul className="space-y-3">
                {providers.map((p) => (
                  <li key={p.organization_slug}>
                    <ScheduledProviderCard provider={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Book a service</h2>
              <Link to={customerFind()} className="shrink-0 text-sm font-medium text-luminexa-accent">
                See all
              </Link>
            </div>
            {filteredTypes.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                <p className="text-sm text-slate-600">No categories available yet.</p>
                <Link
                  to={customerFind()}
                  className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-luminexa-accent"
                >
                  Explore providers →
                </Link>
              </div>
            ) : (
              <BusinessTypeTileGrid types={filteredTypes} />
            )}
          </section>

          {providers.length === 0 && upcoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/90 p-6 text-center">
              <p className="text-4xl" aria-hidden>
                📲
              </p>
              <p className="mt-2 text-sm font-medium text-slate-800">Ready for your first booking?</p>
              <p className="mt-1 text-sm text-slate-500">
                Search above or pick a category to find a local provider.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
