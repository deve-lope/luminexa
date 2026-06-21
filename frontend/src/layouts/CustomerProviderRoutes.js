import React, { useMemo } from 'react';
import { Outlet } from 'react-router-dom';

/** Customer-only provider storefront (/customer/provider/pro12) — no admin/settings UI. */
export default function CustomerProviderRoutes() {
  const outletContext = useMemo(() => ({ variant: 'customer' }), []);
  return <Outlet context={outletContext} />;
}
