import {
  buildProviderSetupChecklist,
  inferProviderSetupSteps,
} from './providerSetupChecklist';
import {
  hasFinishedProviderSetupWizard,
  isProviderWizardStepDone,
  markProviderSetupWizardDone,
  markProviderWizardStepDoneExact,
} from './profileSetup';

const mockProgress = {};
const mockFinished = new Set();

jest.mock('./profileSetup', () => ({
  PROVIDER_WIZARD_STEPS: ['availability', 'service_area', 'services', 'profile'],
  hasFinishedProviderSetupWizard: jest.fn((slug) => mockFinished.has(slug)),
  isProviderWizardStepDone: jest.fn((slug, step) => {
    if (mockFinished.has(slug)) return true;
    return Boolean(mockProgress[`${slug}:${step}`]);
  }),
  markProviderWizardStepDoneExact: jest.fn((slug, step) => {
    mockProgress[`${slug}:${step}`] = true;
  }),
  markProviderSetupWizardDone: jest.fn((slug) => {
    mockFinished.add(slug);
  }),
  providerSetupPath: (slug, step) => `/provider/${slug}/setup?step=${step}`,
}));

describe('inferProviderSetupSteps', () => {
  it('marks services/area/profile/availability from live org data', () => {
    const inferred = inferProviderSetupSteps({
      org: {
        service_postal_code: 'K1A0B1',
        tagline: 'We clean homes',
        scheduling_mode: 'recurring',
      },
      servicesCount: 3,
      schedulingMode: 'recurring',
      weeklyBlocksCount: 5,
    });
    expect(inferred.availability).toBe(true);
    expect(inferred.service_area).toBe(true);
    expect(inferred.services).toBe(true);
    expect(inferred.profile).toBe(true);
  });

  it('does not treat default profile_public alone as profile done', () => {
    const inferred = inferProviderSetupSteps({
      org: { profile_public: true },
      servicesCount: 0,
      schedulingMode: 'flexi',
      weeklyBlocksCount: 0,
    });
    expect(inferred.profile).toBe(false);
    expect(inferred.services).toBe(false);
    expect(inferred.availability).toBe(false);
  });

  it('treats flexi + existing services as availability done', () => {
    const inferred = inferProviderSetupSteps({
      org: {},
      servicesCount: 2,
      schedulingMode: 'flexi',
      weeklyBlocksCount: 0,
    });
    expect(inferred.availability).toBe(true);
    expect(inferred.services).toBe(true);
  });
});

describe('buildProviderSetupChecklist', () => {
  beforeEach(() => {
    Object.keys(mockProgress).forEach((k) => delete mockProgress[k]);
    mockFinished.clear();
    jest.clearAllMocks();
    hasFinishedProviderSetupWizard.mockImplementation((slug) => mockFinished.has(slug));
    isProviderWizardStepDone.mockImplementation((slug, step) => {
      if (mockFinished.has(slug)) return true;
      return Boolean(mockProgress[`${slug}:${step}`]);
    });
    markProviderWizardStepDoneExact.mockImplementation((slug, step) => {
      mockProgress[`${slug}:${step}`] = true;
    });
    markProviderSetupWizardDone.mockImplementation((slug) => {
      mockFinished.add(slug);
    });
  });

  it('completes and persists wizard when org already fully configured', () => {
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
    expect(markProviderSetupWizardDone).toHaveBeenCalledWith('acme');
    expect(markProviderWizardStepDoneExact).toHaveBeenCalled();
  });

  it('marks optional website separately when required steps incomplete', () => {
    const checklist = buildProviderSetupChecklist({
      orgSlug: 'new-co',
      org: {},
      servicesCount: 0,
      schedulingMode: 'flexi',
      weeklyBlocksCount: 0,
    });

    expect(checklist.complete).toBe(false);
    expect(checklist.percent).toBe(0);
    expect(checklist.items.filter((i) => !i.optional && !i.done).length).toBe(4);
    expect(checklist.items.find((i) => i.id === 'website').optional).toBe(true);
  });

  it('credits services step when count > 0 even without local wizard flag', () => {
    const checklist = buildProviderSetupChecklist({
      orgSlug: 'legacy',
      org: { service_city: 'Toronto' },
      servicesCount: 4,
      schedulingMode: 'flexi',
      weeklyBlocksCount: 0,
    });

    expect(checklist.complete).toBe(false);
    const servicesItem = checklist.items.find((i) => i.id === 'services');
    expect(servicesItem.done).toBe(true);
    expect(servicesItem.hint).toMatch(/Catalog/i);
    expect(markProviderWizardStepDoneExact).toHaveBeenCalledWith('legacy', 'services');
  });
});
