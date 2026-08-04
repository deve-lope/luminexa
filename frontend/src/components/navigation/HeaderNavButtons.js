import React from 'react';
import BackButton from './BackButton';
import { IconChevronLeft } from '../icons/NavIcons';

const backBtnClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-luminexa-accent active:bg-violet-50/80';

/**
 * Back → explicit parent route (fallback). Avoids history(-1) skipping pages
 * on mobile / TWA where the stack often jumps past the services list.
 */
export default function HeaderNavButtons({ showBack, backFallback }) {
  if (!showBack || !backFallback) return null;

  return (
    <BackButton
      fallback={backFallback}
      preferFallback
      className={backBtnClass}
      ariaLabel="Go back"
    >
      <IconChevronLeft />
    </BackButton>
  );
}
