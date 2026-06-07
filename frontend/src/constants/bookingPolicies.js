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
      'Customer sends a request first. Once you approve them, they can book available slots.',
  },
];

export function policyLabel(value) {
  return BOOKING_POLICIES.find((p) => p.value === value)?.label || value;
}
