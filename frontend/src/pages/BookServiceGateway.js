import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import CustomerLayout from '../layouts/CustomerLayout';
import CustomerBookServicePage from './customer/CustomerBookServicePage';
import { useAuth } from '../contexts/AuthContext';
import { providerBookingRedirectPath } from '../utils/providerBookingGuard';

export default function BookServiceGateway() {
  const { isAuthenticated, loading, memberships } = useAuth();
  const location = useLocation();
  const { orgSlug } = useParams();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const providerRedirect = providerBookingRedirectPath(memberships, orgSlug);
  if (providerRedirect) {
    return <Navigate to={providerRedirect} replace />;
  }

  return (
    <CustomerLayout>
      <CustomerBookServicePage />
    </CustomerLayout>
  );
}
