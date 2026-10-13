import { buildDayTimeline } from './dayTimeline';

describe('buildDayTimeline', () => {
  test('prefers booked over sibling open slots in the same hour', () => {
    const dayKey = '2026-10-12';
    const slots = [
      {
        id: 1,
        status: 'open',
        start_at: '2026-10-12T12:00:00.000Z',
        end_at: '2026-10-12T13:00:00.000Z',
        occupied_count: 0,
      },
      {
        id: 2,
        status: 'open',
        start_at: '2026-10-12T12:00:00.000Z',
        end_at: '2026-10-12T13:00:00.000Z',
        occupied_count: 0,
      },
      {
        id: 3,
        status: 'booked',
        booking_id: 27,
        start_at: '2026-10-12T12:00:00.000Z',
        end_at: '2026-10-12T13:00:00.000Z',
        occupied_count: 1,
      },
    ];

    const { segments } = buildDayTimeline(dayKey, {
      slots,
      unavailable: [],
      weeklyBlocks: [],
    });

    const booked = segments.filter((s) => s.type === 'booked');
    expect(booked.length).toBeGreaterThan(0);
    expect(booked[0].slot?.id).toBe(3);
  });

  test('prefers unavailable over open slots left under a blocked window', () => {
    const dayKey = '2026-10-20';
    const { segments } = buildDayTimeline(dayKey, {
      slots: [
        {
          id: 10,
          status: 'open',
          start_at: '2026-10-20T14:00:00.000Z',
          end_at: '2026-10-20T15:00:00.000Z',
          occupied_count: 0,
        },
      ],
      unavailable: [
        {
          id: 4,
          start_at: '2026-10-20T14:00:00.000Z',
          end_at: '2026-10-20T15:00:00.000Z',
          note: '',
        },
      ],
      weeklyBlocks: [],
    });

    const blocked = segments.filter((s) => s.type === 'unavailable');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0].block?.id).toBe(4);
  });
});
