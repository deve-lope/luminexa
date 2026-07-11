import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProviderMember } from '../utils/postLoginRoute';
import { firstProviderHome, providerAbout } from '../utils/providerPaths';
import AboutPage from './AboutPage';

export default function LandingRoute() {
  const { isAuthenticated, loading, memberships } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-luminexa-canvas text-slate-600">
        Loading…
      </div>
    );
  }

  if (isAuthenticated && isProviderMember(memberships)) {
    const home = firstProviderHome(memberships);
    const slug = home.split('/').pop();
    return <Navigate to={providerAbout(slug)} replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/customer/about" replace />;
  }

  return <AboutPage />;
}
