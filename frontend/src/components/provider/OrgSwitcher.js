import React from 'react';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';

export default function OrgSwitcher() {
  const { providerOrgs, orgSlug, setOrgSlug } = useProviderOrg();

  if (providerOrgs.length <= 1) return null;

  return (
    <select
      value={orgSlug}
      onChange={(e) => setOrgSlug(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-base"
      aria-label="Switch business"
    >
      {providerOrgs.map((m) => (
        <option key={m.id} value={m.organization_slug}>
          {m.organization_name}
        </option>
      ))}
    </select>
  );
}
