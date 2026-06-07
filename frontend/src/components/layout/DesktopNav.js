import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TAB_ICONS } from '../icons/NavIcons';
import HeaderNavButtons from '../navigation/HeaderNavButtons';

export default function DesktopNav({
  brand,
  tabs = [],
  menuItems = [],
  homeTo,
  showBack,
  backTo,
  backLabel = 'Back',
}) {
  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-full w-56 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="shrink-0 border-b border-slate-200 px-5 py-5">
        <Link to={homeTo || '/'} className="text-lg font-bold text-slate-900">
          {brand}
        </Link>
        {showBack && backTo && (
          <div className="mt-3">
            <HeaderNavButtons showBack={showBack} backFallback={backTo} />
          </div>
        )}
      </div>

      <div className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <nav className="space-y-1 p-3" aria-label="Primary">
          {(tabs || []).map((tab) => {
            const Icon = TAB_ICONS[tab.id];
            return (
              <NavLink
                key={tab.id}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                    isActive ? 'bg-violet-50 text-luminexa-accent' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span className="flex-1 truncate">{tab.label}</span>
                {tab.badgeCount > 0 && (
                  <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {menuItems.length > 0 && (
          <nav className="border-t border-slate-200 p-3 pb-6" aria-label="More">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              More
            </p>
            <ul className="space-y-1">
              {menuItems.map((item) =>
                item.divider ? (
                  <li key={item.id} className="px-3 pb-1 pt-3 first:pt-0">
                    <p
                      className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400"
                      title={item.label}
                    >
                      {item.label}
                    </p>
                  </li>
                ) : (
                  <li key={item.id}>
                    <DesktopMenuRow item={item} />
                  </li>
                )
              )}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}

function DesktopMenuRow({ item }) {
  const className = `flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-slate-50 ${
    item.danger ? 'text-red-600' : item.viewOnly ? 'text-slate-600' : 'text-slate-600'
  }`;

  const label = (
    <>
      <span className="min-w-0 flex-1 truncate" title={item.label}>
        {item.label}
      </span>
      {item.viewOnly && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          View
        </span>
      )}
    </>
  );

  if (item.onClick) {
    return (
      <button type="button" className={className} onClick={item.onClick}>
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
        title={item.viewOnly ? `${item.label} (opens in new tab, view only)` : item.label}
      >
        {label}
      </a>
    );
  }
  return (
    <Link to={item.to} className={className} title={item.label}>
      {label}
    </Link>
  );
}
