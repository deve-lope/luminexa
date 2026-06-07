import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CustomerServiceRequestForm from '../components/customer/CustomerServiceRequestForm';
import ServiceCategoryBrowse from '../components/services/ServiceCategoryBrowse';
import { buildCatalogFromFlat } from '../components/services/ServiceCatalogView';
import { useAuth } from '../contexts/AuthContext';
import { businessesAPI } from '../utils/api';
import { bookService, businessPage } from '../utils/customerPaths';
import {
  customerConnectionState,
  getCustomerMembership,
  needsExplicitConnect,
} from '../utils/bookingAccess';

export default function PublicProviderServicesPage() {
  const { slug } = useParams();
  const { isAuthenticated, memberships, refreshSession } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const membership = getCustomerMembership(memberships, slug);
  const bookingPolicy = data?.booking_policy;
  const connection = customerConnectionState(bookingPolicy, membership);
  const mustConnect = needsExplicitConnect(bookingPolicy) && connection === 'disconnected';

  const load = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    businessesAPI
      .getPublicStorefront(slug)
      .then((res) => setData(res.data))
      .catch(() => setError('Provider not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setConnecting(true);
    try {
      await businessesAPI.connectToOrg(slug);
      await refreshSession();
    } finally {
      setConnecting(false);
    }
  };

  const catalog =
    data?.service_catalog ||
    buildCatalogFromFlat((data?.services || []).filter((s) => s.is_active !== false));

  const org = data?.organization;
  const businessTypes = data?.business_types || [];

  const renderActions = (svc) => {
    if (!isAuthenticated) {
      return (
        <Link
          to={`/login?next=${encodeURIComponent(bookService(slug, svc.id))}`}
          className="rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white"
        >
          Sign in to book
        </Link>
      );
    }
    if (mustConnect) {
      return (
        <button
          type="button"
          disabled={connecting}
          onClick={connect}
          className="rounded-lg border border-luminexa-accent px-3 py-2 text-sm font-medium text-luminexa-accent disabled:opacity-60"
        >
          {connecting ? 'Sending request…' : 'Request access'}
        </button>
      );
    }
    return (
      <Link
        to={bookService(slug, svc.id)}
        className="rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white"
      >
        Book
      </Link>
    );
  };

  if (loading) {
    return <p className="py-8 text-center text-slate-500">Loading services…</p>;
  }

  if (error || !org) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600">{error || 'Not found'}</p>
        <Link to="/services" className="mt-4 inline-block text-luminexa-accent">
          Browse all services
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a category</p>
        {org.tagline && <p className="mt-1 text-slate-600">{org.tagline}</p>}
      </header>

      <ServiceCategoryBrowse
        catalog={catalog}
        orgSlug={slug}
        renderServiceActions={renderActions}
        emptyMessage="This business has not listed any services yet."
      />

      <CustomerServiceRequestForm
        orgSlug={slug}
        businessTypes={businessTypes}
        isGuest={!isAuthenticated}
        loginNextUrl={businessPage(slug)}
      />
    </div>
  );
}
