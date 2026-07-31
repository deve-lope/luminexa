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
  {
    value: 'quote',
    label: 'Quote before confirm (all services)',
    description:
      'Every booking needs a quote. Prefer setting individual services to “Quote on request” instead when only some jobs need pricing.',
  },
];

export function policyLabel(value) {
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
