import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstProviderHome } from '../../utils/providerPaths';

/** Redirect old /provider/... paths (without slug) to /provider/:slug/... */
export default function ProviderLegacyRedirect({ suffix = '' }) {
  const location = useLocation();
  const { memberships, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
    );
  }
  const base = firstProviderHome(memberships);
  const pathSuffix =
    suffix || location.pathname.replace(/^\/provider\/?/, '') || '';
  const target = `${base}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
