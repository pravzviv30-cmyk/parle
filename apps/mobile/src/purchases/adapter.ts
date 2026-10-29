import type { PurchasesAdapter } from './contract.ts';
export * from './contract.ts';

/** Web and Expo's node tests have no native store. Metro selects adapter.native on devices. */
export const purchases: PurchasesAdapter = {
  async offering() {
    return { available: false };
  },
  storeless: true,
  async purchase() {
    return { ok: false, cancelled: false, notStarted: true };
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
  async heldPlan() {
    return null;
  },
  async storeHolds() {
    return 'unknown' as const;
  },
  onStoreChange() {
    return () => {};
  },
};
