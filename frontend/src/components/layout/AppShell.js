import React, { useState } from 'react';
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
  headerActions = null,
  tabs,
  menuItems = [],
  menuTitle = 'Menu',
  backTo,
  backLabel = 'Back',
  homeTo,
  showBack = Boolean(backTo),
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = menuItems.length > 0;
  const hasTabs = tabs?.length > 0;
  const hasHeaderNav = showBack && Boolean(backTo);

  return (
    <div className="lx-app-bg">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-[100] -translate-y-16 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        Skip to main content
      </a>
      <DesktopNav
        brand={brand}
        tabs={tabs}
        menuItems={menuItems}
        homeTo={homeTo}
      />

      <div className={`w-full ${hasTabs ? 'lg:pl-60' : ''}`}>
        <header className="lx-header">
          <div className="lx-container flex items-center gap-2 py-3 lg:py-4">
            {hasMenu && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <IconMenu className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
            {hasHeaderNav && (
              <HeaderNavButtons showBack={showBack} backFallback={backTo} />
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && <p className="lx-eyebrow truncate">{eyebrow}</p>}
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 lg:text-xl">
                {title}
              </h1>
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-1">{headerActions}</div>
            ) : null}
          </div>
          {headerExtra && (
            <div className="lx-container border-t border-slate-100/80 pb-3">
              {headerExtra}
            </div>
          )}
        </header>

        <main
          id="main-content"
          className="lx-container py-5 pb-[calc(var(--lx-bottom-tabs-height)+1.25rem)] lg:py-6 lg:pb-8"
          tabIndex={-1}
        >
          <div className="page-enter min-w-0">
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
