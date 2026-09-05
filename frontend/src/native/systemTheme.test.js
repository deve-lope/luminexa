import { applyLightDocumentTheme, syncLightTheme } from './systemTheme';

describe('systemTheme (light-only)', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  test('applyLightDocumentTheme forces light classes', () => {
    document.documentElement.classList.add('lx-theme-dark');
    applyLightDocumentTheme();
    expect(document.documentElement.classList.contains('lx-theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('lx-theme-light')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  test('syncLightTheme resolves without native plugins in jsdom', async () => {
    await expect(syncLightTheme()).resolves.toBeUndefined();
  });
});
