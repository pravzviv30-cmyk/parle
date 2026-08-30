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
};
