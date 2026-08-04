import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProviderMember } from '../utils/postLoginRoute';
import { getOnboardingPath, needsOnboarding } from '../utils/profileSetup';
import { firstProviderHome } from '../utils/providerPaths';
import AboutPage from './AboutPage';

export default function LandingRoute() {
  const { isAuthenticated, loading, user, memberships } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-luminexa-canvas text-slate-600">
        Loading…
      </div>
    );
  }

  if (isAuthenticated && needsOnboarding(user)) {
    const path = getOnboardingPath(user, memberships);
    if (path) return <Navigate to={path} replace />;
  }

  if (isAuthenticated && isProviderMember(memberships)) {
    return <Navigate to={firstProviderHome(memberships)} replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/customer" replace />;
  }

  return <AboutPage />;
}
