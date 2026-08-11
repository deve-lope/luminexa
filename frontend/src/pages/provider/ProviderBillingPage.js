import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProviderBillingSettings from '../../components/provider/ProviderBillingSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerAccount } from '../../utils/providerPaths';

/**
 * Full payments & Pro subscription details — linked from My Account.
 */
export default function ProviderBillingPage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const { memberships } = useAuth();
  const isOwner = useMemo(
    () => memberships?.some((m) => m.organization_slug === orgSlug && m.role === 'owner'),
    [memberships, orgSlug]
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-500">
          <Link to={providerAccount(orgSlug)} className="text-luminexa-accent hover:underline">
            My account
          </Link>
          {' · '}
          Billing
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Billing & subscription</h1>
        <p className="mt-1 text-sm text-slate-600">
          Two money flows for {activeOrg?.organization_name || 'your business'}: your Pro plan
          (you pay Luminexa), and customer invoice payouts (customers pay you).
        </p>
      </div>
      <ProviderBillingSettings
        orgSlug={orgSlug}
        isOwner={isOwner}
        returnPath={`/provider/${orgSlug}/billing`}
      />
    </div>
  );
}
