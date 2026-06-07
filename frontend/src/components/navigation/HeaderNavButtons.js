import React from 'react';
import BackButton from './BackButton';
import { IconChevronLeft } from '../icons/NavIcons';

const backBtnClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:text-luminexa-accent active:bg-violet-100/80';

/**
 * Back → browser history, or fallback route when there is no history.
 */
export default function HeaderNavButtons({ showBack, backFallback }) {
  if (!showBack || !backFallback) return null;

  return (
    <BackButton fallback={backFallback} className={backBtnClass} ariaLabel="Go back">
      <IconChevronLeft />
    </BackButton>
  );
}
