import React from 'react';
import { Link } from 'react-router-dom';

export default function BusinessTypeTile({ type, linkTo }) {
  const count = type.provider_count ?? 0;
  const subtitle = count === 1 ? '1 provider' : `${count} providers`;
  const to = linkTo ? linkTo(type.slug) : `/customer/find/${type.slug}`;

  return (
    <Link
      to={to}
      className="lx-card-interactive group flex min-h-[120px] flex-col justify-between p-4 hover:ring-1 hover:ring-violet-100/80"
    >
      <div>
        {type.icon && (
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-xl ring-1 ring-violet-100/60"
            aria-hidden
          >
            {type.icon}
          </span>
        )}
        <h3 className="mt-2 font-semibold tracking-tight text-slate-900 group-hover:text-luminexa-accent">
          {type.name}
        </h3>
        {type.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{type.description}</p>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold text-luminexa-accent">{subtitle}</p>
    </Link>
  );
}
