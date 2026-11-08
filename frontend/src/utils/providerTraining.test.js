import { buildProviderMenuItems } from '../config/navigation';
import {
  buildProviderTrainingLessons,
  getProviderTrainingLesson,
} from './providerTraining';

describe('providerTraining', () => {
  test('featured full walkthrough is first and covers the end-to-end path', () => {
    const lessons = buildProviderTrainingLessons('acme', { includeGigs: true });
    expect(lessons[0].id).toBe('full-job-walkthrough');
    expect(lessons[0].featured).toBe(true);
    const headings = lessons[0].sections.map((s) => s.heading.toLowerCase());
    expect(headings.some((h) => h.includes('home'))).toBe(true);
    expect(headings.some((h) => h.includes('category') || h.includes('service'))).toBe(true);
    expect(headings.some((h) => h.includes('task'))).toBe(true);
    expect(headings.some((h) => h.includes('reschedule'))).toBe(true);
    expect(headings.some((h) => h.includes('timeline'))).toBe(true);
    expect(headings.some((h) => h.includes('question'))).toBe(true);
    expect(headings.some((h) => h.includes('location') || h.includes('way'))).toBe(true);
    expect(headings.some((h) => h.includes('start') && h.includes('end'))).toBe(true);
    expect(lessons[0].spotlightSteps.length).toBeGreaterThanOrEqual(4);
  });

  test('lessons include core topics with spotlight targets', () => {
    const lessons = buildProviderTrainingLessons('acme', { includeGigs: true });
    const ids = lessons.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'full-job-walkthrough',
        'home',
        'schedule',
        'requests',
        'messages',
        'gigs',
        'services',
        'jobs-and-tasks',
        'settings',
        'my-page',
        'clients',
        'analytics',
      ])
    );
    expect(ids).not.toContain('jobs');
    for (const lesson of lessons) {
      expect(lesson.title).toBeTruthy();
      expect(lesson.summary).toBeTruthy();
      expect(lesson.sections?.length).toBeGreaterThan(0);
      expect(lesson.spotlightSteps?.length).toBeGreaterThan(0);
      expect(lesson.spotlightSteps[0].target || lesson.spotlightSteps[0].path).toBeTruthy();
    }
  });

  test('omits gig lesson when includeGigs is false', () => {
    const lessons = buildProviderTrainingLessons('acme', { includeGigs: false });
    expect(lessons.some((l) => l.id === 'gigs')).toBe(false);
  });

  test('getProviderTrainingLesson returns a lesson or null', () => {
    expect(getProviderTrainingLesson('acme', 'schedule')?.title).toMatch(/Schedule/i);
    expect(getProviderTrainingLesson('acme', 'full-job-walkthrough')?.featured).toBe(true);
    expect(getProviderTrainingLesson('acme', 'missing')).toBeNull();
  });

  test('menu places Training under Services', () => {
    const items = buildProviderMenuItems({
      logout: () => {},
      providerServicesPath: '/provider/acme/services',
      providerTrainingPath: '/provider/acme/training',
    });
    const servicesIdx = items.findIndex((i) => i.id === 'services');
    const trainingIdx = items.findIndex((i) => i.id === 'training');
    expect(servicesIdx).toBeGreaterThanOrEqual(0);
    expect(trainingIdx).toBe(servicesIdx + 1);
    expect(items[trainingIdx].dataTour).toBe('training');
    expect(items[trainingIdx].to).toBe('/provider/acme/training');
  });
});
