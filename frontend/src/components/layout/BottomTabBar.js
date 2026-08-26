import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TAB_ICONS } from '../icons/NavIcons';

export default function BottomTabBar({ tabs }) {
  const location = useLocation();

  const isTabActive = (tab) => {
    if (tab.end) return location.pathname === tab.to;
    return location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
  };

  return (
    <nav
      className="lx-bottom-tabs fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/90 bg-white/95 backdrop-blur-xl lg:hidden"
      aria-label="Primary"
      style={{ paddingBottom: 'max(0.5rem, var(--lx-sab))' }}
    >
      <div className="flex w-full px-safe">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const active = isTabActive(tab);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              end={tab.end}
              aria-label={
                tab.badgeCount > 0
                  ? `${tab.label}, ${tab.badgeCount} new`
                  : tab.label
              }
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-xs"
            >
              <span
                className={`relative flex items-center justify-center rounded-xl px-3 py-1.5 transition-all duration-200 sm:px-4 ${
                  active
                    ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                    : 'text-slate-400'
                }`}
              >
                {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                {tab.badgeCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[10px] font-bold text-white shadow-sm"
                    aria-hidden="true"
                  >
                    {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
                  </span>
                )}
              </span>
              <span
                className={`max-w-full truncate text-[10px] font-semibold ${active ? 'text-luminexa-accent' : 'text-slate-400'}`}
                aria-hidden="true"
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
