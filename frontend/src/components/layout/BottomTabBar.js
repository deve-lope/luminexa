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
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white pb-safe lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const active = isTabActive(tab);
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              end={tab.end}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs"
            >
              <span
                className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 ${
                  active
                    ? 'bg-violet-100 px-4 py-1 text-luminexa-accent'
                    : 'px-4 py-1 text-slate-400'
                }`}
              >
                {Icon && <Icon className="h-5 w-5" />}
                {tab.badgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${active ? 'text-luminexa-accent' : 'text-slate-400'}`}
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
