import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconMenu } from '../icons/NavIcons';
import AppMenuDrawer from './AppMenuDrawer';
import BottomTabBar from './BottomTabBar';
import DesktopNav from './DesktopNav';
import HeaderNavButtons from '../navigation/HeaderNavButtons';

export default function AppShell({
  brand = 'Luminexa',
  eyebrow,
  title,
  headerExtra,
  tabs,
  menuItems = [],
  menuTitle = 'Menu',
  backTo,
  backLabel = 'Back',
  homeTo,
  showBack = Boolean(backTo),
  children,
}) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = menuItems.length > 0;
  const hasTabs = tabs?.length > 0;
  const hasHeaderNav = showBack && Boolean(backTo);

  return (
    <div className="min-h-screen bg-slate-100 lg:bg-slate-50">
      <DesktopNav
        brand={brand}
        tabs={tabs}
        menuItems={menuItems}
        homeTo={homeTo}
        showBack={showBack}
        backTo={backTo}
        backLabel={backLabel}
      />

      <div className={hasTabs ? 'lg:pl-56' : ''}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3 lg:max-w-3xl lg:px-6 lg:py-4">
            {hasMenu && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <IconMenu className="h-6 w-6" />
              </button>
            )}
            {hasHeaderNav && (
              <HeaderNavButtons showBack={showBack} backFallback={backTo} />
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="truncate text-xs font-medium uppercase tracking-wide text-luminexa-accent">
                  {eyebrow}
                </p>
              )}
              <h1 className="truncate text-lg font-bold text-slate-900 lg:text-xl">{title}</h1>
            </div>
          </div>
          {headerExtra && (
            <div className="mx-auto max-w-lg border-t border-slate-100 px-4 pb-3 lg:max-w-3xl lg:px-6">
              {headerExtra}
            </div>
          )}
        </header>

        <main className="mx-auto max-w-lg px-4 py-6 pb-28 lg:max-w-3xl lg:px-6 lg:pb-8">
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {hasTabs && <BottomTabBar tabs={tabs} />}

      {hasMenu && (
        <AppMenuDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={menuTitle}
          items={menuItems}
        />
      )}
    </div>
  );
}
