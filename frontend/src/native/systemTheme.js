/**
 * Luminexa stays light-mode only. Status bar icons must be dark on the frosted
 * header (SystemBarsStyle.Light = dark icons; Dark = white icons).
 * Uses Capacitor 8 SystemBars only — never @capacitor/status-bar (deprecated
 * Window.setStatusBarColor APIs trigger Play Console edge-to-edge warnings).
 */

export async function syncNativeStatusBar() {
  try {
    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
    return 'LIGHT';
  } catch {
    return 'LIGHT';
  }
}

export function applyLightDocumentTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('lx-theme-dark');
  root.classList.add('lx-theme-light');
  root.style.colorScheme = 'light';
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0D9488');
  } catch {
    /* ignore */
  }
}

export async function syncLightTheme() {
  applyLightDocumentTheme();
  await syncNativeStatusBar();
}

/** Keep light chrome + readable status bar icons after resume. */
export function installLightThemeSync() {
  if (typeof window === 'undefined') return () => {};
  applyLightDocumentTheme();
  syncNativeStatusBar();
  return () => {};
}
