import { notificationDestination } from './customerNotifications';

describe('notificationDestination', () => {
  it('prefers a specific booking deep link', () => {
    expect(
      notificationDestination({
        link_path: '/customer/bookings/42',
        booking_id: 42,
      }),
    ).toBe('/customer/bookings/42');
  });

  it('upgrades a generic bookings list path when booking_id is present', () => {
    expect(
      notificationDestination({
        link_path: '/customer/bookings',
        booking_id: 42,
      }),
    ).toBe('/customer/bookings/42');
  });

  it('opens the conversation for message alerts', () => {
    expect(
      notificationDestination({
        kind: 'new_message',
        link_path: '/customer/messages?conversation=9',
        booking_id: 42,
      }),
    ).toBe('/customer/messages?conversation=9');
  });
});
