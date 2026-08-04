export const BOOKING_POLICIES = [
  {
    value: 'instant',
    label: 'Automatic booking',
    description:
      'Customer picks an open slot and the appointment is confirmed right away — no approval step.',
  },
  {
    value: 'approval',
    label: 'You approve each booking',
    description:
      'Customer requests a slot; you accept or decline before it is confirmed.',
  },
  {
    value: 'clients_only',
    label: 'Request access first',
    description:
      'Customer sends a booking request. When you accept it, they become an approved client.',
  },
];

/** Shown only if the org is still on the legacy all-services quote policy. */
export const LEGACY_QUOTE_BOOKING_POLICY = {
  value: 'quote',
  label: 'Quote before confirm (legacy — all services)',
  description:
    'Every booking needs a quote. Prefer Range or Typical price on each service under Services, then switch to approval or automatic booking here.',
};

export function policyLabel(value) {
  if (value === 'quote') return LEGACY_QUOTE_BOOKING_POLICY.label;
  return BOOKING_POLICIES.find((p) => p.value === value)?.label || value;
}

/** Short hint for customers — never provider-facing "you" wording. */
export function customerPolicyLabel(value) {
  const labels = {
    instant: 'Confirmed as soon as you book a slot',
    approval: 'The business will confirm your booking request',
    clients_only: 'Send a booking request — the business reviews and accepts you',
    quote: 'Request a time — the business sends a quote for you to accept',
  };
  return labels[value] || '';
}
