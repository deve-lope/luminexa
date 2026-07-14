import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import CustomerLayout from '../layouts/CustomerLayout';
import CustomerBookMultipleServicesPage from './customer/CustomerBookMultipleServicesPage';
import { useAuth } from '../contexts/AuthContext';
import { providerBookingRedirectPath } from '../utils/providerBookingGuard';

export default function BookMultipleGateway() {
  const { isAuthenticated, loading, memberships } = useAuth();
  const location = useLocation();
  const { slug, orgSlug } = useParams();
  const key = slug || orgSlug;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  const providerRedirect = providerBookingRedirectPath(memberships, key);
  if (providerRedirect) {
    return <Navigate to={providerRedirect} replace />;
  }

  return (
    <CustomerLayout>
      <CustomerBookMultipleServicesPage />
    </CustomerLayout>
  );
}
