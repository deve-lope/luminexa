import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { providerHome } from '../utils/providerPaths';

const ProviderOrgContext = createContext(null);

export function ProviderOrgProvider({ providerOrgs, orgSlug, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const setOrgSlug = useCallback((slug) => {
    if (!slug || slug === orgSlug) return;
    const prefix = `/provider/${orgSlug}`;
    let suffix = '';
    if (location.pathname.startsWith(prefix)) {
      suffix = location.pathname.slice(prefix.length);
    }
    navigate(`${providerHome(slug)}${suffix}${location.search}${location.hash}`, { replace: false });
  }, [location.hash, location.pathname, location.search, navigate, orgSlug]);

  const activeOrg = useMemo(
    () => providerOrgs.find((m) => m.organization_slug === orgSlug) || providerOrgs[0],
    [providerOrgs, orgSlug]
  );

  const value = useMemo(
    () => ({
      providerOrgs,
      orgSlug,
      setOrgSlug,
      activeOrg,
    }),
    [providerOrgs, orgSlug, setOrgSlug, activeOrg]
  );

  return (
    <ProviderOrgContext.Provider value={value}>{children}</ProviderOrgContext.Provider>
  );
}

export function useProviderOrg() {
  const ctx = useContext(ProviderOrgContext);
  if (!ctx) throw new Error('useProviderOrg must be used within ProviderOrgProvider');
  return ctx;
}
