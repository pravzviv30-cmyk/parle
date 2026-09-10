export interface StoreProduct {
  plan: 'starter';
  productId: string;
  title: string;
  localizedPrice: string;
}

export type StoreOffering =
  | { available: false }
  | { available: true; product: StoreProduct };

export type StoreAction =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false };

export interface PurchasesAdapter {
  offering(userId: string): Promise<StoreOffering>;
  purchase(userId: string, productId: string): Promise<StoreAction>;
  restore(userId: string): Promise<StoreAction>;
  /**
   * Hand the learner to the store's own subscription sheet.
   *
   * Apple asks any app selling an auto renewing subscription for a way out of
   * it (Guideline 3.1.1), and the way out is theirs, not ours: cancelling,
   * changing tier and billing all belong to the account, not to this app. So
   * this opens a sheet and answers whether it opened, and nothing here reads
   * or reports subscription state.
   */
  manage(userId: string): Promise<StoreAction>;
}

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
};
