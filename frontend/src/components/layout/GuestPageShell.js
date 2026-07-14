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
    <div className="lx-app-bg">
      <header className="lx-header">
        <div className="lx-container flex items-center gap-2 py-3">
          <HeaderNavButtons showBack={showBack} backFallback={backTo} />
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="lx-eyebrow truncate">{eyebrow}</p>}
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{title}</h1>
          </div>
        </div>
      </header>
      <main className="lx-container py-5 pb-12">
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
