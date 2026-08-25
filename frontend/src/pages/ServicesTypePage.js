import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import GuestPageShell from '../components/layout/GuestPageShell';
import { useAuth } from '../contexts/AuthContext';
import { isProviderMember } from '../utils/postLoginRoute';
import { firstProviderHome } from '../utils/providerPaths';
import CustomerProvidersByTypePage from './customer/CustomerProvidersByTypePage';

/** Logged-out category browse — same provider list as /customer/find/:typeSlug. */
export default function ServicesTypePage() {
  const { typeSlug } = useParams();
  const { isAuthenticated, loading, memberships } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    if (isProviderMember(memberships)) {
      return <Navigate to={firstProviderHome(memberships)} replace />;
    }
    return <Navigate to={`/customer/find/${typeSlug}`} replace />;
  }

  return (
    <GuestPageShell eyebrow="Explore" title="Providers" backTo="/services">
      <CustomerProvidersByTypePage />
    </GuestPageShell>
  );
}
