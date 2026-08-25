import {
  authPathWithNext,
  isSafeNextPath,
  resolvePathAfterAuth,
} from './postLoginRoute';

const customer = { needs_onboarding: false };
const newCustomer = { needs_onboarding: true };

describe('auth return path after sign-in / sign-up', () => {
  test('keeps the service book URL for customers', () => {
    expect(resolvePathAfterAuth('/book/acme/42', customer, [])).toBe('/book/acme/42');
  });

  test('new customers finish setup then return to the book URL', () => {
    expect(resolvePathAfterAuth('/book/acme/42', newCustomer, [])).toBe(
      '/customer/setup?next=%2Fbook%2Facme%2F42'
    );
  });

  test('sign-up login URL carries next', () => {
    expect(authPathWithNext('/login', '/book/acme/42')).toBe(
      '/login?next=%2Fbook%2Facme%2F42'
    );
  });

  test('rejects protocol-relative next', () => {
    expect(isSafeNextPath('//evil.example')).toBe(false);
    expect(authPathWithNext('/login', '//evil.example')).toBe('/login');
  });
});
