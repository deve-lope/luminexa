import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import CustomerSearchResults from '../../components/customer/CustomerSearchResults';
import ScheduledProviderCard from '../../components/customer/ScheduledProviderCard';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import PostalRadiusFields from '../../components/location/PostalRadiusFields';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { DEFAULT_RADIUS_MILES } from '../../constants/locationSearch';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { businessesAPI } from '../../utils/api';
import { canRescheduleBooking, isUntouchedBookingRequest } from '../../utils/customerBookings';
import { formatWhen } from '../../utils/datetime';
import { customerBookings, customerFind } from '../../utils/customerPaths';
import { isPostalSearchReady, normalizePostalInput } from '../../utils/postalInput';

const MAX_HOME_PROVIDERS = 3;

function ProvidersSection({ providers }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = providers.length > MAX_HOME_PROVIDERS;
  const visible = expanded ? providers : providers.slice(0, MAX_HOME_PROVIDERS);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="lx-section-title">Your providers</h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="lx-link"
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
  const { showToast } = useToast();
  const [home, setHome] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchPostal, setSearchPostal] = useState('');
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS_MILES);
  const [searchAreaLabel, setSearchAreaLabel] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

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
  const hasPostalFilter = isPostalSearchReady(searchPostal);

  useEffect(() => {
    if (trimmedQuery.length < 2 && !hasPostalFilter) {
      setSearchResults(null);
      setSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      const params = {};
      if (trimmedQuery.length >= 2) params.q = trimmedQuery;
      if (hasPostalFilter) {
        params.postal = normalizePostalInput(searchPostal);
        params.radius_miles = searchRadius;
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
  }, [trimmedQuery, hasPostalFilter, searchPostal, searchRadius]);

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

  const isSearching = trimmedQuery.length >= 2 || hasPostalFilter;
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
        <header className="lx-hero">
          <div className="relative p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/20 backdrop-blur-sm">
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
                <p className="mt-2 max-w-md text-sm leading-6 text-white/80">
                  Search once, compare nearby providers, and book the service you need.
                </p>
              </div>
            </div>
            <Link to={customerFind()} className="lx-btn-ghost mt-5 w-full bg-white text-luminexa-navy hover:bg-violet-50 sm:w-auto">
              Browse services
            </Link>
          </div>
        </header>
      )}

      <section className="lx-card-lg">
        <div className="mb-3">
          <h2 className="lx-section-title">Find a service near you</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search quickly here, or browse by ZIP / postal code to see what&apos;s nearby.
          </p>
        </div>
        <ServiceSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search car wash, plumbing, pet grooming…"
          sticky={false}
        />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <PostalRadiusFields
            postal={searchPostal}
            onPostalChange={setSearchPostal}
            radiusMiles={searchRadius}
            onRadiusChange={setSearchRadius}
            onLocationReady={({ label }) => setSearchAreaLabel(label || '')}
            idPrefix="home-search"
          />
        </div>
        <Link to={customerFind()} className="lx-btn-secondary mt-4 w-full sm:w-auto">
          Browse by location
        </Link>
      </section>

      {isSearching ? (
        <CustomerSearchResults
          results={searchResults}
          query={trimmedQuery}
          areaLabel={searchAreaLabel}
          loading={searchLoading}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="lx-section-title">Up next</h2>
                <Link to={customerBookings()} className="lx-link">
                  All
                </Link>
              </div>
              <ul className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="lx-card w-[min(78vw,280px)] shrink-0 snap-start sm:w-[min(320px,42vw)]"
                  >
                    <p className="font-semibold text-slate-900">{b.service_name}</p>
                    <p className="text-sm text-slate-600">{b.organization_name}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{formatWhen(b.start_at)}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs capitalize ${bookingStatusClass(b.status)}`}
                    >
                      {b.status === 'requested' ? 'Awaiting provider' : b.status}
                    </span>
                    {canRescheduleBooking(b) && (
                      <button
                        type="button"
                        onClick={() => setRescheduleBooking(b)}
                        className="mt-3 min-h-[40px] w-full rounded-lg border border-violet-200 bg-violet-50 text-sm font-medium text-violet-800"
                      >
                        Reschedule
                      </button>
                    )}
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
              <h2 className="lx-section-title">Popular categories</h2>
              <Link to={customerFind()} className="lx-link shrink-0">
                See all
              </Link>
            </div>
            {filteredTypes.length === 0 ? (
              <div className="lx-empty">
                <p className="text-sm text-slate-600">No categories available yet.</p>
                <Link to={customerFind()} className="lx-link mt-3 inline-flex min-h-[44px] items-center">
                  Explore providers →
                </Link>
              </div>
            ) : (
              <BusinessTypeTileGrid types={filteredTypes} />
            )}
          </section>

          {providers.length === 0 && upcoming.length === 0 && (
            <div className="lx-empty">
              <p className="text-sm font-medium text-slate-800">Ready for your first booking?</p>
              <p className="mt-1 text-sm text-slate-500">
                Search above or pick a category to find a local provider.
              </p>
            </div>
          )}
        </>
      )}

      <RescheduleBookingModal
        open={!!rescheduleBooking}
        booking={rescheduleBooking}
        audience="customer"
        onClose={() => setRescheduleBooking(null)}
        onRescheduled={(updated) => {
          const pending = isUntouchedBookingRequest(updated) || updated?.status === 'requested';
          showToast(
            pending
              ? 'New time submitted. Still waiting for the business to approve.'
              : 'Reschedule request sent. The business will confirm your new time.',
            'success',
          );
          setRescheduleBooking(null);
          businessesAPI.getCustomerHome().then((res) => setHome(res.data));
        }}
      />
    </div>
  );
}
