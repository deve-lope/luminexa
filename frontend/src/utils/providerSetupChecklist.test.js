import { buildProviderSetupChecklist } from './providerSetupChecklist';

jest.mock('./profileSetup', () => ({
  PROVIDER_WIZARD_STEPS: ['availability', 'service_area', 'services', 'profile'],
  hasFinishedProviderSetupWizard: jest.fn(() => false),
  isProviderWizardStepDone: jest.fn(() => false),
  providerSetupPath: (slug, step) => `/provider/${slug}/setup?step=${step}`,
}));

describe('buildProviderSetupChecklist', () => {
  it('returns percent from required steps and marks optional website separately', () => {
    const checklist = buildProviderSetupChecklist({
      orgSlug: 'acme',
      org: {
        service_postal_code: '10001',
        tagline: 'We fix sinks',
      },
      servicesCount: 2,
      schedulingMode: 'recurring',
      weeklyBlocksCount: 5,
    });

    expect(checklist.complete).toBe(true);
    expect(checklist.percent).toBe(100);
    expect(checklist.items.find((i) => i.id === 'website').optional).toBe(true);
    expect(checklist.items.find((i) => i.id === 'website').done).toBe(false);
  });

  it('colors incomplete required steps at partial percent', () => {
    const checklist = buildProviderSetupChecklist({
      orgSlug: 'acme',
      org: {},
      servicesCount: 0,
      schedulingMode: 'flexi',
      weeklyBlocksCount: 0,
    });

    expect(checklist.complete).toBe(false);
    expect(checklist.percent).toBe(0);
    expect(checklist.items.filter((i) => !i.optional && !i.done).length).toBe(4);
  });
});
