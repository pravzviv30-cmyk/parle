import { firstNameFrom } from './preAccountDraft.ts';

/** A verified signup may ask once; returning and already named accounts never do. */
export function needsAccountName(newlyCreated: boolean, name: string | null | undefined, pending = false): boolean {
  return (newlyCreated || pending) && (typeof name !== 'string' || name.trim().length === 0);
}

export type AccountNameResult = 'saved' | 'invalid' | 'failed' | 'stale';

/** Continue is acknowledged only after the existing account-scoped writer lands. */
export async function saveAccountName(value: string, persist: (name: string) => Promise<boolean>, current: () => boolean): Promise<AccountNameResult> {
  const name = firstNameFrom(value);
  if (name === null) return 'invalid';
  if (!current()) return 'stale';
  try {
    const saved = await persist(name);
    if (!current()) return 'stale';
    return saved ? 'saved' : 'failed';
  } catch {
    return current() ? 'failed' : 'stale';
  }
}
