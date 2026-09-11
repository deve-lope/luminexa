import React, { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import ProviderBillingSettings from '../../components/provider/ProviderBillingSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { isNativeApp } from '../../native/capacitorNative';
import { providerHome } from '../../utils/providerPaths';
import { orgHasActiveSubscription } from '../../utils/providerSubscription';

/**
 * Paywall landing — providers without an active/trialing Pro plan land here.
 */
export default function ProviderSubscribePage() {
  const { orgSlug, activeOrg, providerOrgs } = useProviderOrg();
  const { memberships, refreshSession } = useAuth();
  const [params] = useSearchParams();
  const storeShell = isNativeApp();
  const isOwner = memberships?.some(
    (m) => m.organization_slug === orgSlug && m.role === 'owner'
  );
  const membership =
    (memberships || []).find((m) => m.organization_slug === orgSlug) ||
    (providerOrgs || []).find((m) => m.organization_slug === orgSlug);

  useEffect(() => {
    if (params.get('sub') === '1') {
      refreshSession?.();
    }
  }, [params, refreshSession]);

  if (membership && orgHasActiveSubscription(membership) && params.get('sub') !== '0') {
    return <Navigate to={providerHome(orgSlug)} replace />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {storeShell ? 'Luminexa Pro required' : 'Luminexa Pro'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {activeOrg?.organization_name || 'Your business'} needs an active Pro plan to use the
          provider dashboard — including analytics, job profit, invoice follow-ups, and books
          export. Customers always use Luminexa for free.
        </p>
        {storeShell ? (
          <p className="mt-2 text-sm text-slate-600">
            Store apps cannot take Pro subscription payments. To start, renew, or manage your
            subscription, visit app.luminex-a.com in Safari or Chrome, then return here. Plan status
            and customer payouts stay available in the app.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            New accounts get a free trial with no card required. If you already used a trial on this
            email, subscribe to continue with Pro.
          </p>
        )}
      </div>
      {!isOwner && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Only the business owner can manage the plan. Ask them to subscribe, then refresh.
        </p>
      )}
      <ProviderBillingSettings
        orgSlug={orgSlug}
        isOwner={isOwner}
        returnPath={`/provider/${orgSlug}/subscribe`}
      />
    </div>
  );
}
