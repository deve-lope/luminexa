import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Public marketing top bar (homepage + provider demo chrome).
 * @param {string|null} appBackTo — in-app About: show Back to app
 * @param {boolean} forceSolid — always white bar (demo shell above the app)
 * @param {boolean} demoActive — demo session: Exit demo instead of Try demo
 * @param {boolean} fixed — homepage over hero; false when bar sits in document flow
 */
export default function SiteHeader({
  appBackTo = null,
  forceSolid = false,
  demoActive = false,
  fixed = true,
}) {
  const [scrolled, setScrolled] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  React.useEffect(() => {
    if (forceSolid) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [forceSolid]);

  const solid = forceSolid || scrolled;

  const navLinkClass = `inline-flex min-h-[44px] items-center px-3 text-sm font-medium transition ${
    solid ? 'text-slate-700 hover:text-teal-700' : 'text-white/90 hover:text-white'
  }`;

  const exitDemo = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await logout();
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
  };

  return (
    <header
      className={`${fixed ? 'fixed inset-x-0' : 'relative'} top-0 z-40 transition duration-300 ${
        forceSolid ? '' : 'pt-safe'
      } ${
        solid
          ? 'border-b border-teal-900/10 bg-white/95 shadow-sm backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8 md:py-4">
        <Link
          to={appBackTo ? '.' : '/'}
          className={`text-xl font-extrabold tracking-tight transition ${
            solid ? 'text-slate-900' : 'text-white'
          }`}
        >
          Luminexa
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href={forceSolid || demoActive ? '/#how' : '#how'}
            className={`hidden min-h-[44px] items-center px-3 text-sm font-medium transition md:inline-flex ${
              solid ? 'text-slate-600 hover:text-teal-700' : 'text-white/80 hover:text-white'
            }`}
          >
            How it works
          </a>
          {appBackTo ? (
            <Link to={appBackTo} className={navLinkClass}>
              Back to app
            </Link>
          ) : (
            <>
              <Link
                to="/for-new-providers"
                className={`hidden min-h-[44px] items-center px-3 text-sm font-medium transition lg:inline-flex ${
                  solid ? 'text-slate-700 hover:text-teal-700' : 'text-white/90 hover:text-white'
                }`}
              >
                For providers
              </Link>
              <Link
                to="/pricing"
                className={`hidden min-h-[44px] items-center px-3 text-sm font-medium transition md:inline-flex ${
                  solid ? 'text-slate-700 hover:text-teal-700' : 'text-white/90 hover:text-white'
                }`}
              >
                Pricing
              </Link>
              {!demoActive && (
                <Link to="/login" className={navLinkClass}>
                  Sign in
                </Link>
              )}
              {demoActive ? (
                <button
                  type="button"
                  onClick={exitDemo}
                  disabled={exiting}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-amber-500 px-4 text-sm font-bold text-amber-950 shadow-lg shadow-amber-900/10 transition hover:bg-amber-400 disabled:opacity-60"
                >
                  {exiting ? 'Leaving…' : 'Exit demo'}
                </button>
              ) : (
                <Link
                  to="/demo"
                  className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold shadow-lg transition ${
                    solid
                      ? 'bg-amber-500 text-amber-950 shadow-amber-900/10 hover:bg-amber-400'
                      : 'bg-amber-400 text-amber-950 shadow-teal-950/25 hover:bg-amber-300'
                  }`}
                >
                  Demo
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
