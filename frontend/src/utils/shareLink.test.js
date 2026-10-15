import {
  shareHref,
  SHARE_TARGETS,
  isIOSUserAgent,
  openShareHref,
} from './shareLink';

describe('shareHref', () => {
  const payload = {
    title: 'Acme Auto',
    text: 'Oil change on Friday',
    url: 'https://app.luminex-a.com/b/abc',
  };

  test('WhatsApp includes the booking text and link', () => {
    const href = shareHref('whatsapp', payload);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Oil change on Friday');
    expect(decodeURIComponent(href)).toContain(payload.url);
  });

  test('Facebook shares the booking URL', () => {
    expect(shareHref('facebook', payload)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`
    );
  });

  test('Messages uses the iOS body form on iPhone', () => {
    expect(shareHref('messages', payload, { iOS: true })).toContain('sms:&body=');
    expect(shareHref('messages', payload, { iOS: false })).toContain('sms:?body=');
  });

  test('Messages and WhatsApp pre-fill the customer phone when provided', () => {
    const withPhone = { ...payload, phone: '+1 (555) 123-4567' };
    expect(shareHref('messages', withPhone, { iOS: false })).toContain('sms:+15551234567?body=');
    expect(shareHref('whatsapp', withPhone)).toContain('https://wa.me/15551234567?text=');
  });

  test('email target is not offered', () => {
    expect(shareHref('email', payload)).toBe('');
  });
});

describe('isIOSUserAgent', () => {
  test('detects iPhone', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
  });

  test('rejects Android', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
});

describe('SHARE_TARGETS', () => {
  test('includes WhatsApp, Messages, and Facebook but not email', () => {
    const ids = SHARE_TARGETS.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['whatsapp', 'messages', 'facebook']));
    expect(ids).not.toContain('email');
  });
});

describe('openShareHref', () => {
  test('does not window.open mailto links', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    try {
      openShareHref('mailto:?subject=Hi&body=Link');
    } catch {
      // assign may throw in jsdom
    }
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  test('opens https targets in a new tab', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    openShareHref('https://wa.me/?text=hi');
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/?text=hi',
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
  });
});
