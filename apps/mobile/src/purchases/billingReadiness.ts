/** Public configuration only. A mismatch must never open a store purchase. */
export interface ClientBillingConfiguration {
  entitlementId: string | undefined;
  products: { starter: string | undefined; regular: string | undefined };
  /**
   * Yearly products this build sells (D16), each optional. One the server does
   * not name identically would be bought and then refused, so any mismatch
   * keeps the whole store closed, exactly as a monthly mismatch does.
   */
  yearly?: { starter: string | undefined; regular: string | undefined };
}
export function billingPairMatches(body: unknown, expected: ClientBillingConfiguration): boolean {
  if (!expected.entitlementId || !expected.products.starter || !expected.products.regular || expected.products.starter === expected.products.regular) return false;
  if (!body || typeof body !== 'object') return false;
  const value = body as Record<string, unknown>;
  const products = value.products as Record<string, unknown> | undefined;
  if (!(value.ready === true && value.projectionVersion === 1 && value.entitlementId === expected.entitlementId
    && products?.starter === expected.products.starter && products?.regular === expected.products.regular)) return false;
  const sold = [expected.products.starter, expected.products.regular];
  const serverYearly = (typeof value.yearlyProducts === 'object' && value.yearlyProducts !== null ? value.yearlyProducts : {}) as Record<string, unknown>;
  for (const plan of ['starter', 'regular'] as const) {
    const id = expected.yearly?.[plan];
    if (!id) continue;
    if (sold.includes(id) || serverYearly[plan] !== id) return false;
    sold.push(id);
  }
  return true;
}
