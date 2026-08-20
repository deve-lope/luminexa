import { countBookingActionNotifications } from './providerNotifications';
import { countBookingUpdateNotifications } from './customerNotifications';

describe('countBookingActionNotifications', () => {
  test('does not badge Requests for payment received', () => {
    expect(
      countBookingActionNotifications([
        { kind: 'payment_received', id: 1 },
        { kind: 'new_customer_booking', id: 2 },
      ])
    ).toBe(1);
  });
});

describe('countBookingUpdateNotifications', () => {
  test('does not badge Bookings after payment is confirmed', () => {
    expect(
      countBookingUpdateNotifications([
        { kind: 'payment_confirmed', id: 1 },
        { kind: 'invoice_ready', id: 2 },
      ])
    ).toBe(1);
  });
});
