import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerServices } from '../../utils/providerPaths';
import { publicServicesCatalog } from '../../utils/customerPaths';

/**
 * Summary + link to full Services catalog (categories, pricing, request options).
 */
export default function ProviderServicesEditor({ orgSlug: orgSlugProp }) {
  const { orgSlug: ctxSlug } = useProviderOrg();
  const orgSlug = orgSlugProp || ctxSlug;
  const [counts, setCounts] = useState({ services: 0, categories: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    try {
      const [catRes, svcRes] = await Promise.all([
        jobsAPI.listServiceCategories({ organization: orgSlug }),
        jobsAPI.listServices({ organization: orgSlug }),
      ]);
      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data?.results || [];
      const svcs = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.results || [];
      setCounts({
        categories: cats.filter((c) => c.is_active !== false).length,
        services: svcs.filter((s) => s.is_active !== false).length,
      });
    } catch {
      setCounts({ services: 0, categories: 0 });
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!orgSlug) return null;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Your services</h2>
      <p className="mt-1 text-sm text-slate-600">
        Organize offerings by category (Automobile, House work, etc.), set fixed or range
        pricing, and let customers request a service.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : (
        <p className="mt-3 text-sm text-slate-700">
          <strong>{counts.services}</strong> active service{counts.services === 1 ? '' : 's'}
          {counts.categories > 0 && (
            <>
              {' '}
              in <strong>{counts.categories}</strong> categor
              {counts.categories === 1 ? 'y' : 'ies'}
            </>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          to={providerServices(orgSlug)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-luminexa-accent font-medium text-white"
        >
          Manage services
        </Link>
        <Link
          to={publicServicesCatalog(orgSlug)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-medium text-slate-700"
        >
          Preview public page
        </Link>
      </div>
    </section>
  );
}
