import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customerPolicyLabel } from '../../constants/bookingPolicies';
import BusinessTypeIcon from '../../components/icons/BusinessTypeIcon';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import { businessesAPI } from '../../utils/api';
import { businessPage } from '../../utils/customerPaths';

export default function CustomerProvidersByTypePage() {
  const { typeSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    businessesAPI
      .listProvidersByType(typeSlug)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load providers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeSlug]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading providers…</p>;
  }

  if (error || !data) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  const { business_type: businessType, providers } = data;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <BusinessTypeIcon
          slug={businessType?.slug || typeSlug}
          name={businessType?.name}
          className="h-4 w-4 text-teal-700"
        />
        {businessType?.name}
      </p>
      {providers.length === 0 ? (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">No providers in this category yet.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {providers.map((p) => (
            <li key={p.slug}>
              <Link
                to={businessPage(p.slug)}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-luminexa-accent/40"
              >
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {p.tagline && <p className="mt-1 text-sm text-slate-600">{p.tagline}</p>}
                {p.rating_summary?.count > 0 && (
                  <div className="mt-2">
                    <ServiceRatingSummary summary={p.rating_summary} compact />
                  </div>
                )}
                {customerPolicyLabel(p.booking_policy) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {customerPolicyLabel(p.booking_policy)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
