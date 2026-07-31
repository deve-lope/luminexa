import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TAB_ICONS } from '../icons/NavIcons';

export default function DesktopNav({
  brand,
  tabs = [],
  menuItems = [],
  homeTo,
}) {
  return (
    <aside className="lx-sidebar fixed left-0 top-0 z-20 hidden h-full w-60 flex-col lg:flex">
      <div className="shrink-0 border-b border-luminexa-line px-5 py-5">
        <Link
          to={homeTo || '/'}
          className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-sm font-bold text-white shadow-sm">
            L
          </span>
          {brand}
        </Link>
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
                    isActive ? 'lx-nav-active' : 'lx-nav-idle'
                  }`
                }
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span className="flex-1 truncate">{tab.label}</span>
                {tab.badgeCount > 0 && (
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {menuItems.length > 0 && (
          <nav className="border-t border-luminexa-line p-3 pb-6" aria-label="More">
            <ul className="space-y-1">
              {menuItems.map((item) =>
                item.divider ? (
                  <li key={item.id} className="px-3 pb-1 pt-3 first:pt-0">
                      <p
                      className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
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
  const Icon = item.iconId ? TAB_ICONS[item.iconId] : null;
  const className = `flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm font-medium transition ${
    item.danger ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'lx-nav-idle'
  }`;

  const label = (
    <>
      {Icon && <Icon className="h-5 w-5 shrink-0" />}
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
