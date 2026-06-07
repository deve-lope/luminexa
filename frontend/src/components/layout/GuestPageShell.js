import React from 'react';
import HeaderNavButtons from '../navigation/HeaderNavButtons';

export default function GuestPageShell({
  title,
  eyebrow,
  backTo = '/',
  showBack = true,
  children,
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3 lg:max-w-3xl">
          <HeaderNavButtons showBack={showBack} backFallback={backTo} />
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="truncate text-xs font-medium uppercase tracking-wide text-luminexa-accent">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 pb-12 lg:max-w-3xl">{children}</main>
    </div>
  );
}
