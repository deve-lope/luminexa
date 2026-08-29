import React from 'react';

function Svg({ className, children }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconAuto({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 13.5 5.4 9.4A2 2 0 0 1 7.3 8h9.4a2 2 0 0 1 1.9 1.4L20 13.5" />
      <path d="M4 13.5h16v3.2a1.3 1.3 0 0 1-1.3 1.3H17a1 1 0 0 1-1-1v-.5H8v.5a1 1 0 0 1-1 1H5.3A1.3 1.3 0 0 1 4 16.7v-3.2Z" />
      <circle cx="7.2" cy="17.6" r="1.15" />
      <circle cx="16.8" cy="17.6" r="1.15" />
    </Svg>
  );
}

function IconYard({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8.8" r="4.6" />
      <path d="M12 13.4V20.2" />
      <path d="M4.8 20.4h14.4" />
    </Svg>
  );
}

function IconCleaning({ className }) {
  return (
    <Svg className={className}>
      <path d="M8 20.5h8" />
      <path d="M12 13.5V20" />
      <path d="M7.5 13.5h9l-1.1-3.2A2 2 0 0 0 13.5 9h-3a2 2 0 0 0-1.9 1.3L7.5 13.5Z" />
      <path d="M12 9V5.5" />
      <path d="M9.2 4.2 12 5.5l2.8-1.3" />
      <path d="M16.8 6.2 18.5 5" />
      <path d="M7.2 6.2 5.5 5" />
    </Svg>
  );
}

function IconHandyman({ className }) {
  return (
    <Svg className={className}>
      <path d="m15.2 8.8 5.3-5.3" />
      <path d="M14.4 4.3a3.2 3.2 0 0 1 4.6 4.5l-8.4 8.4a2.2 2.2 0 0 1-3.1 0l-.7-.7a2.2 2.2 0 0 1 0-3.1l8.4-8.4Z" />
      <path d="m8.8 15.2-4.3 4.3" />
      <path d="M4.5 11.5 7 9l2.2.8" />
    </Svg>
  );
}

function IconElectrical({ className }) {
  return (
    <Svg className={className}>
      <path d="M13.2 3.5 6.8 12.8h5.2L10.8 20.5l6.6-9.6h-5.2L13.2 3.5Z" />
    </Svg>
  );
}

function IconPlumbing({ className }) {
  return (
    <Svg className={className}>
      <path d="M16.5 4.5a3.2 3.2 0 0 1 0 6.4c-.9 0-1.7.2-2.3.8L7.2 18.7a2.3 2.3 0 1 1-3.3-3.3l7-7a3 3 0 0 0 .8-2.3 3.2 3.2 0 0 1 4.8-1.6Z" />
      <path d="m14.8 9.2 4.7 4.7" />
      <path d="M17.2 13.8h3.2v2.2a1.4 1.4 0 0 1-1.4 1.4h-1.8" />
    </Svg>
  );
}

function IconMoving({ className }) {
  return (
    <Svg className={className}>
      <path d="M12 4.2 4.5 8.2v7.6L12 19.8l7.5-4V8.2L12 4.2Z" />
      <path d="M4.5 8.2 12 12.2l7.5-4" />
      <path d="M12 12.2V19.8" />
    </Svg>
  );
}

function IconPainting({ className }) {
  return (
    <Svg className={className}>
      <path d="M7.5 20.5h4.2a1.6 1.6 0 0 0 1.6-1.6v-2.2H7.5v3.8Z" />
      <path d="M7.5 16.7V9.5l4.8-5 4.2 4.1-4.8 5H7.5Z" />
      <path d="M14.2 6.8c.8.8 2.2.7 3-.2s.9-2.2.1-3" />
    </Svg>
  );
}

function IconPet({ className }) {
  return (
    <Svg className={className}>
      <ellipse cx="8" cy="8.2" rx="1.7" ry="2.1" />
      <ellipse cx="16" cy="8.2" rx="1.7" ry="2.1" />
      <ellipse cx="5.8" cy="12.6" rx="1.55" ry="1.9" />
      <ellipse cx="18.2" cy="12.6" rx="1.55" ry="1.9" />
      <path d="M12 20.2c-2.7 0-4.8-1.9-4.8-4.2 0-2.1 1.8-3.6 4.8-3.6s4.8 1.5 4.8 3.6c0 2.3-2.1 4.2-4.8 4.2Z" />
    </Svg>
  );
}

function IconBeauty({ className }) {
  return (
    <Svg className={className}>
      <circle cx="7.2" cy="16.8" r="2.3" />
      <circle cx="16.8" cy="16.8" r="2.3" />
      <path d="m8.6 15.2 6.8-9.4" />
      <path d="m15.4 15.2-6.8-9.4" />
      <path d="M9.8 7.4h4.4" />
    </Svg>
  );
}

function IconOther({ className }) {
  return (
    <Svg className={className}>
      <path d="M12 4.5v3.2" />
      <path d="M12 16.3v3.2" />
      <path d="M4.5 12h3.2" />
      <path d="M16.3 12h3.2" />
      <path d="m7 7 2.2 2.2" />
      <path d="m14.8 14.8 2.2 2.2" />
      <path d="m17 7-2.2 2.2" />
      <path d="m9.2 14.8-2.2 2.2" />
      <circle cx="12" cy="12" r="2.1" />
    </Svg>
  );
}

const ICONS = {
  'auto-vehicles': IconAuto,
  'yard-outdoors': IconYard,
  'home-cleaning': IconCleaning,
  'handyman-repairs': IconHandyman,
  electrical: IconElectrical,
  plumbing: IconPlumbing,
  'moving-help': IconMoving,
  painting: IconPainting,
  'pet-care': IconPet,
  'personal-beauty': IconBeauty,
  other: IconOther,
};

const ALIASES = {
  auto: 'auto-vehicles',
  'auto-and-vehicles': 'auto-vehicles',
  'car-wash': 'auto-vehicles',
  vehicles: 'auto-vehicles',
  landscaping: 'yard-outdoors',
  'lawn-outdoors': 'yard-outdoors',
  'yard-and-outdoors': 'yard-outdoors',
  'yard-and-outdoor-work': 'yard-outdoors',
  'outdoor-work': 'yard-outdoors',
  'yard-work': 'yard-outdoors',
  cleaning: 'home-cleaning',
  'house-cleaning': 'home-cleaning',
  handyman: 'handyman-repairs',
  'handyman-and-repairs': 'handyman-repairs',
  hvac: 'handyman-repairs',
  repairs: 'handyman-repairs',
  'moving-and-heavy-help': 'moving-help',
  moving: 'moving-help',
  'pet-grooming': 'pet-care',
  'salon-studio': 'personal-beauty',
  'personal-beauty': 'personal-beauty',
  beauty: 'personal-beauty',
};

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveBusinessTypeIconKey(slug, name) {
  const candidates = [slug, name].map(normalizeKey).filter(Boolean);
  for (const key of candidates) {
    if (ICONS[key]) return key;
    if (ALIASES[key] && ICONS[ALIASES[key]]) return ALIASES[key];
  }
  return 'other';
}

export default function BusinessTypeIcon({
  slug,
  name,
  className = 'h-5 w-5',
}) {
  const key = resolveBusinessTypeIconKey(slug, name);
  const Icon = ICONS[key] || IconOther;
  return <Icon className={className} />;
}
