import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import type { PurchasesAdapter, StoreAction, StoreOffering } from './adapter.ts';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const STARTER_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID;

let configuredFor: string | null = null;

function apiKey(): string | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (Platform.OS === 'ios') return IOS_KEY ?? null;
  if (Platform.OS === 'android') return ANDROID_KEY ?? null;
  return null;
}

async function ready(userId: string): Promise<boolean> {
  const key = apiKey();
  if (!key || !STARTER_PRODUCT) return false;
  if (configuredFor === null) {
    Purchases.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
  return true;
}

async function starterPackage(userId: string): Promise<PurchasesPackage | null> {
  if (!(await ready(userId))) return null;
  const offering = (await Purchases.getOfferings()).current;
  return offering?.availablePackages.find((candidate) => candidate.product.identifier === STARTER_PRODUCT) ?? null;
}

function actionFrom(error: unknown): StoreAction {
  const cancelled =
    typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled === true;
  return { ok: false, cancelled };
}

export const purchases: PurchasesAdapter = {
  async offering(userId): Promise<StoreOffering> {
    try {
      const found = await starterPackage(userId);
      const price = found?.product.priceString.trim();
      if (!found || !price) return { available: false };
      return {
        available: true,
        product: {
          plan: 'starter',
          productId: found.product.identifier,
          title: found.product.title.trim() || 'Starter',
          localizedPrice: price,
        },
      };
    } catch {
      return { available: false };
    }
  },

  async purchase(userId, productId): Promise<StoreAction> {
    try {
      const found = await starterPackage(userId);
      if (!found || found.product.identifier !== productId) return { ok: false, cancelled: false };
      await Purchases.purchasePackage(found);
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
  },

  async restore(userId): Promise<StoreAction> {
    try {
      if (!(await ready(userId))) return { ok: false, cancelled: false };
      await Purchases.restorePurchases();
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
  },
};
