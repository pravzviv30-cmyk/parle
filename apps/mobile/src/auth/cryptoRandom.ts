export type AuthRandomValues = typeof import('expo-crypto').getRandomValues;

/** Supply only the missing secure random operation; never replace browser crypto or pretend to implement WebCrypto. */
export function ensureAuthRandom(target: { crypto?: { getRandomValues?: unknown } }, randomValues: AuthRandomValues): void {
  if (!target.crypto) {
    Object.defineProperty(target, 'crypto', { value: { getRandomValues: randomValues }, configurable: true });
  } else if (typeof target.crypto.getRandomValues !== 'function') {
    target.crypto.getRandomValues = randomValues;
  }
}
