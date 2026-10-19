import type { PurchasesAdapter } from './contract.ts';
export * from './contract.ts';

/** Web and Expo's node tests have no native store. Metro selects adapter.native on devices. */
export const purchases: PurchasesAdapter = {
  async offering() {
    return { available: false };
  },
  async purchase() {
    return { ok: false, cancelled: false };
  },
  async restore() {
    return { ok: false, cancelled: false };
  },
  async manage() {
    return { ok: false, cancelled: false };
  },
  async trialFacts() {
    return null;
  },
  onStoreChange() {
    return () => {};
  },
};
