import React from 'react';
import { Navigate } from 'react-router-dom';
import CustomerLayout from '../layouts/CustomerLayout';
import GuestPageShell from '../components/layout/GuestPageShell';
import { useAuth } from '../contexts/AuthContext';
import { isProviderMember } from '../utils/postLoginRoute';
import { firstProviderHome } from '../utils/providerPaths';
import ServicesBrowsePage from './ServicesBrowsePage';

export default function ServicesBrowseWrapper() {
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
    return (
      <CustomerLayout>
        <ServicesBrowsePage embedded />
      </CustomerLayout>
    );
  }

  return (
    <GuestPageShell eyebrow="Explore" title="Find a service" backTo="/" backLabel="Home">
      <ServicesBrowsePage embedded />
    </GuestPageShell>
  );
}
