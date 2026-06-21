import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import CustomerSearchResults from '../../components/customer/CustomerSearchResults';
import ScheduledProviderCard from '../../components/customer/ScheduledProviderCard';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { customerBookings, customerFind } from '../../utils/customerPaths';

const MAX_HOME_PROVIDERS = 3;

function ProvidersSection({ providers }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = providers.length > MAX_HOME_PROVIDERS;
  const visible = expanded ? providers : providers.slice(0, MAX_HOME_PROVIDERS);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Your providers</h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-luminexa-accent"
          >
            {expanded ? 'Show less' : `See all (${providers.length})`}
          </button>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((p) => (
          <li key={p.organization_slug}>
            <ScheduledProviderCard provider={p} compact={hasMore && !expanded} />
          </li>
        ))}
      </ul>
    </section>
  );
}

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

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      const params = {};
      if (trimmedQuery.length >= 2) params.q = trimmedQuery;
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
  }, [trimmedQuery]);

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

  const isSearching = trimmedQuery.length >= 2;
  const firstName = (user?.full_name || '').split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="space-y-5 pb-4" aria-busy="true" aria-label="Loading your dashboard">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <div>
          <Skeleton className="mb-3 h-5 w-40" />
          <SkeletonList count={2} />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  const providers = home?.providers || [];
  const upcoming = home?.upcoming_bookings || [];

  return (
    <div className="space-y-5 pb-4">
      {!isSearching && (
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-luminexa-navy via-violet-900 to-indigo-900 text-white shadow-lg">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/15">
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
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Hi, {firstName}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/75">
                  Search once, compare nearby providers, and book the service you need.
                </p>
              </div>
            </div>
            <Link
              to={customerFind()}
              className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-luminexa-navy shadow-sm transition hover:bg-violet-50 sm:w-auto"
            >
              Browse services
            </Link>
          </div>
        </header>
      )}

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">Find a service near you</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search quickly here, or browse by location to see what's nearby.
          </p>
        </div>
        <ServiceSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search car wash, plumbing, pet grooming…"
          sticky={false}
        />
        <Link
          to={customerFind()}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-luminexa-accent sm:w-auto"
        >
          Browse by location
        </Link>
      </section>

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
            <ProvidersSection providers={providers} />
          )}

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Popular categories</h2>
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
              <p className="text-sm font-medium text-slate-800">Ready for your first booking?</p>
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
