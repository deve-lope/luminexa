/** Provider exit / non-renewal reasons collected at account deletion. */
export const PROVIDER_DELETION_REASONS = [
  { value: 'too_expensive', label: 'Too expensive / not worth the price' },
  { value: 'not_enough_customers', label: 'Not enough customers or bookings' },
  { value: 'switching_tool', label: 'Switching to another tool' },
  { value: 'business_closed', label: 'Business closed or pausing' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'hard_to_use', label: 'Too hard to use' },
  { value: 'didnt_need_pro', label: 'Didn’t need Pro / trial was enough' },
  { value: 'temporary', label: 'Temporary — may come back' },
  { value: 'other', label: 'Other' },
];
