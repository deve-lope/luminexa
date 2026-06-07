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
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs ${
                active ? 'font-semibold text-luminexa-accent' : 'font-medium text-slate-500'
              }`}
            >
              <span className="relative">
                {Icon && <Icon className="h-6 w-6" />}
                {tab.badgeCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {tab.badgeCount > 9 ? '9+' : tab.badgeCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
