import { canStartOrCompleteJob, jobActionAvailableAt, JOB_ACTION_EARLY_HOURS } from './jobActions';

describe('canStartOrCompleteJob', () => {
  test('blocks start and complete more than 6 hours early', () => {
    const start = new Date('2026-08-21T15:00:00Z');
    const now = new Date('2026-08-19T15:00:00Z');
    expect(canStartOrCompleteJob({ start_at: start.toISOString() }, now)).toBe(false);
  });

  test('allows start and complete within 6 hours of start_at', () => {
    const start = new Date('2026-08-21T15:00:00Z');
    const now = new Date('2026-08-21T10:00:00Z');
    expect(canStartOrCompleteJob({ start_at: start.toISOString() }, now)).toBe(true);
    const available = jobActionAvailableAt({ start_at: start.toISOString() });
    expect(available.getTime()).toBe(start.getTime() - JOB_ACTION_EARLY_HOURS * 60 * 60 * 1000);
  });
});
