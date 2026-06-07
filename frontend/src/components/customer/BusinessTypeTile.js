import React from 'react';
import { Link } from 'react-router-dom';

export default function BusinessTypeTile({ type, linkTo }) {
  const count = type.provider_count ?? 0;
  const subtitle =
    count === 0
      ? 'Coming soon'
      : count === 1
        ? '1 provider'
        : `${count} providers`;
  const to = linkTo ? linkTo(type.slug) : `/customer/find/${type.slug}`;

  return (
    <Link
      to={to}
      className="flex min-h-[120px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-luminexa-accent/40 hover:shadow-md"
    >
      <div>
        {type.icon && <span className="text-2xl" aria-hidden>{type.icon}</span>}
        <h3 className="mt-2 font-semibold text-slate-900">{type.name}</h3>
        {type.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{type.description}</p>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-luminexa-accent">{subtitle}</p>
    </Link>
  );
}
