/** Resolve provider key from route params (pro12 or legacy slug). */
export function providerRouteKey(params = {}) {
  return params.providerKey || params.orgSlug || params.slug || '';
}

/** Prefer public ref (pro12) for customer-facing provider links. */
export function providerCustomerKey(entity) {
  if (!entity) return '';
  return (
    entity.organization_public_ref ||
    entity.public_ref ||
    entity.organization_slug ||
    entity.slug ||
    ''
  );
}
