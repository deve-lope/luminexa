import { shareHref, SHARE_TARGETS, isIOSUserAgent } from './shareLink';

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

  test('email uses subject and body', () => {
    const href = shareHref('email', payload);
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('subject=Acme%20Auto');
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
  test('includes WhatsApp, Messages, email, and Facebook', () => {
    const ids = SHARE_TARGETS.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['whatsapp', 'messages', 'email', 'facebook']));
  });
});
