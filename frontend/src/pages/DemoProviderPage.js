import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { markAppTourEligible } from '../utils/appTour';
import { markProviderSetupWizardDone } from '../utils/profileSetup';
import { providerHome } from '../utils/providerPaths';

export default function DemoProviderPage() {
  const navigate = useNavigate();
  const { enterMarketingDemo, isAuthenticated, user, loading, logout } = useAuth();
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('boot'); // boot | confirm | entering | error
  const startedRef = useRef(false);

  const startDemo = useCallback(async () => {
    setPhase('entering');
    setError(null);
    try {
      const { orgSlug } = await enterMarketingDemo();
      if (orgSlug) {
        markProviderSetupWizardDone(orgSlug);
        markAppTourEligible();
        navigate(providerHome(orgSlug), { replace: true });
        return;
      }
      setError('Demo is not ready yet.');
      setPhase('error');
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Could not open the demo. Try again in a moment.';
      setError(detail);
      setPhase('error');
    }
  }, [enterMarketingDemo, navigate]);

  useEffect(() => {
    if (loading || startedRef.current) return undefined;
    if (isAuthenticated && user?.is_marketing_demo) {
      startedRef.current = true;
      startDemo();
      return undefined;
    }
    if (isAuthenticated && !user?.is_marketing_demo) {
      setPhase('confirm');
      return undefined;
    }
    startedRef.current = true;
    startDemo();
    return undefined;
  }, [loading, isAuthenticated, user?.is_marketing_demo, startDemo]);

  const confirmAndEnter = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('entering');
    try {
      await logout();
    } catch {
      /* ignore */
    }
    await startDemo();
  };

  if (phase === 'confirm') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-luminexa-canvas px-6 text-center">
        <p className="max-w-md text-base font-semibold text-teal-950">
          You’re already signed in
        </p>
        <p className="max-w-md text-sm leading-relaxed text-slate-600">
          Opening the provider demo will sign you out of your current account and switch to the
          shared demo business.
        </p>
        <button
          type="button"
          onClick={confirmAndEnter}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-bold text-amber-950 hover:bg-amber-400"
        >
          Sign out and try demo
        </button>
        <Link
          to="/for-new-providers"
          className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
        >
          Cancel
        </Link>
      </div>
    );
  }

  if (phase === 'error' || error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-luminexa-canvas px-6 text-center">
        <p className="max-w-sm text-sm text-slate-700">{error}</p>
        <Link
          to="/for-new-providers"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-teal-700 px-6 text-sm font-semibold text-white"
        >
          Back to providers page
        </Link>
        <Link to="/register/business" className="text-sm font-medium text-teal-800 underline">
          Start free trial instead
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-teal-950 px-6 text-center text-white">
      <div className="h-10 w-10 animate-pulse rounded-2xl bg-teal-400/30" />
      <p className="text-sm font-semibold text-teal-100">Opening provider demo…</p>
      <p className="text-xs text-teal-200/70">
        Explore freely — billing and account changes are locked
      </p>
    </div>
  );
}
