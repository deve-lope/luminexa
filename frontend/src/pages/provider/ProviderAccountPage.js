import React from 'react';
import CustomerAccountPage from '../customer/CustomerAccountPage';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';

/** Provider My Account — profile/security plus subscription summary. */
export default function ProviderAccountPage() {
  const { orgSlug } = useProviderOrg();
  return <CustomerAccountPage variant="provider" orgSlug={orgSlug} />;
}
