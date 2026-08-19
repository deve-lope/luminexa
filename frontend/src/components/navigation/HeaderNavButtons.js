import React from 'react';
import BackButton from './BackButton';
import { IconChevronLeft } from '../icons/NavIcons';

const backBtnClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-luminexa-accent active:bg-violet-50/80';

/**
 * Back → previous in-app screen when we have one, otherwise the semantic parent
 * (`backFallback`). Does not use native history(-1), which on TWA/mobile often
 * leaves the app or skips past the page you came from.
 */
export default function HeaderNavButtons({ showBack, backFallback }) {
  if (!showBack || !backFallback) return null;

  return (
    <BackButton
      fallback={backFallback}
      className={backBtnClass}
      ariaLabel="Go back"
    >
      <IconChevronLeft />
    </BackButton>
  );
}
