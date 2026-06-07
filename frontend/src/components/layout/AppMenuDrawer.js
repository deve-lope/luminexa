import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconClose, TAB_ICONS } from '../icons/NavIcons';

export default function AppMenuDrawer({ open, onClose, title, items }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] animate-[slideIn_0.2s_ease-out] flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </header>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {items.map((item) =>
              item.divider ? (
                <li key={item.id} className="px-4 pb-1 pt-4 first:pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                </li>
              ) : (
                <li key={item.id}>
                  <MenuRow item={item} onNavigate={onClose} />
                </li>
              )
            )}
          </ul>
        </nav>
      </aside>
    </div>
  );
}

function MenuRow({ item, onNavigate }) {
  const location = useLocation();
  const Icon = item.iconId ? TAB_ICONS[item.iconId] : null;

  const isActive =
    item.to &&
    (item.end
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  const className = `flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-base ${
    item.danger
      ? 'text-red-600'
      : isActive
        ? 'bg-violet-50 font-medium text-luminexa-accent'
        : 'text-slate-800'
  } hover:bg-slate-100`;

  const label = (
    <>
      {Icon && <Icon className="h-5 w-5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.viewOnly && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          View
        </span>
      )}
      {item.badgeCount > 0 && (
        <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
          {item.badgeCount > 9 ? '9+' : item.badgeCount}
        </span>
      )}
    </>
  );

  if (item.onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          item.onClick();
          onNavigate();
        }}
      >
        {label}
      </button>
    );
  }

  if (item.href) {
    return (
      <a
        href={item.href}
        className={className}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  return (
    <Link to={item.to} end={item.end} className={className} onClick={onNavigate}>
      {label}
    </Link>
  );
}
