import React from 'react';
import { Link } from 'react-router-dom';
import BusinessTypeIcon from '../icons/BusinessTypeIcon';
import { lxPillTone } from '../../utils/pillGradients';

export default function BusinessTypeTile({ type, linkTo, toneIndex = 0, toneCount = 4 }) {
  const count = type.provider_count ?? 0;
  const subtitle = count === 1 ? '1 provider' : `${count} providers`;
  const to = linkTo ? linkTo(type.slug) : `/customer/find/${type.slug}`;
  const tone = lxPillTone(toneIndex, toneCount);

  return (
    <Link
      to={to}
      className={`group flex h-full min-h-[140px] flex-col justify-between rounded-3xl p-4 shadow-lx-soft ring-1 transition duration-200 hover:-translate-y-0.5 hover:shadow-lx-elevated ${tone.surface} ${tone.ring}`}
    >
      <div>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${tone.chip}`}
          aria-hidden
        >
          <BusinessTypeIcon slug={type.slug} name={type.name} className="h-5 w-5" />
        </span>
        <h3 className={`mt-3 text-[15px] font-semibold tracking-tight ${tone.title}`}>
          {type.name}
        </h3>
        {type.description && (
          <p className={`mt-1 line-clamp-2 text-sm leading-snug ${tone.body}`}>
            {type.description}
          </p>
        )}
      </div>
      <p className={`mt-3 text-xs font-medium ${tone.meta}`}>{subtitle}</p>
    </Link>
  );
}
