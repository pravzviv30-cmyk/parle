/** Public configuration only. A mismatch must never open a store purchase. */
export interface ClientBillingConfiguration {
  entitlementId: string | undefined;
  products: { starter: string | undefined; regular: string | undefined };
}
export function billingPairMatches(body: unknown, expected: ClientBillingConfiguration): boolean {
  if (!expected.entitlementId || !expected.products.starter || !expected.products.regular || expected.products.starter === expected.products.regular) return false;
  if (!body || typeof body !== 'object') return false;
  const value = body as Record<string, unknown>;
  const products = value.products as Record<string, unknown> | undefined;
  return value.ready === true && value.projectionVersion === 1 && value.entitlementId === expected.entitlementId
    && products?.starter === expected.products.starter && products?.regular === expected.products.regular;
}
