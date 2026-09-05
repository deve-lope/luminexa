import {
  isActiveInquiry,
  isAttendanceFollowUp,
  isClosedBooking,
  isFutureUpcomingBooking,
  isPendingQuoteBooking,
} from './customerBookings';

const past = '2020-06-01T10:00:00Z';
const future = '2030-06-01T10:00:00Z';
const now = new Date('2025-06-01T12:00:00Z');

describe('customerBookings filters', () => {
  test('future confirmed booking is upcoming', () => {
    expect(
      isFutureUpcomingBooking({ status: 'confirmed', start_at: future, end_at: future }, now),
    ).toBe(true);
  });

  test('past confirmed booking is not in coming up', () => {
    expect(
      isFutureUpcomingBooking({ status: 'confirmed', start_at: past, end_at: past }, now),
    ).toBe(false);
  });

  test('past confirmed without answer needs attendance follow-up', () => {
    const booking = { status: 'confirmed', start_at: past, end_at: past };
    expect(isAttendanceFollowUp(booking, now)).toBe(true);
    expect(isFutureUpcomingBooking(booking, now)).toBe(false);
  });

  test('past confirmed after attendance answer is closed', () => {
    const booking = {
      status: 'confirmed',
      start_at: past,
      end_at: past,
      customer_confirmed_attendance_at: past,
    };
    expect(isAttendanceFollowUp(booking, now)).toBe(false);
    expect(isClosedBooking(booking, now)).toBe(true);
  });

  test('open quote stays on quotes tab only', () => {
    const booking = { status: 'quoted', start_at: future, end_at: future };
    expect(isPendingQuoteBooking(booking, now)).toBe(true);
    expect(isFutureUpcomingBooking(booking, now)).toBe(false);
  });

  test('in progress job stays upcoming even when start is past', () => {
    expect(
      isFutureUpcomingBooking({ status: 'in_progress', start_at: past, end_at: future }, now),
    ).toBe(true);
  });

  test('dismissed inquiry is not active on quotes tab', () => {
    expect(
      isActiveInquiry({ status: 'quoted', dismissed_at: '2025-01-01T00:00:00Z' }),
    ).toBe(false);
  });
});
