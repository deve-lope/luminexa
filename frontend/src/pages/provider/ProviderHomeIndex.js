import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { isSnowOwnerNav } from '../../utils/snowDispatch';
import ProviderTodayPage from './ProviderTodayPage';
import DispatchHomePage from './routes/DispatchHomePage';

/** Index route: snow owners see dispatch home; appointment orgs see Today. */
export default function ProviderHomeIndex() {
  const { memberships } = useAuth();
  const { orgSlug } = useProviderOrg();
  const membership = useMemo(
    () => (memberships || []).find((m) => m.organization_slug === orgSlug),
    [memberships, orgSlug]
  );

  if (isSnowOwnerNav(membership)) {
    return <DispatchHomePage />;
  }
  return <ProviderTodayPage />;
}
