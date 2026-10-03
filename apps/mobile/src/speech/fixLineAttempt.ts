import { auth, authHeaders } from '../auth/adapter.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { loadProfile } from '../profile/store.ts';
import type { ClosureRepair } from '../conversationPacks/closure.ts';

export interface FixLineVerdict { fixed: boolean; hint: string | null }
export function readFixLineVerdict(raw: unknown): FixLineVerdict | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'fixed' && key !== 'hint') || typeof value.fixed !== 'boolean') return null;
  if (value.hint !== null && (typeof value.hint !== 'string' || value.hint.length > 120)) return null;
  return { fixed: value.fixed, hint: value.fixed ? null : value.hint as string | null };
}

/** Explicit Check only. No recording, storage, event or review grade. */
export async function judgeFixLine(userId: string, repair: ClosureRepair, attempt: string, owner: number, signal: AbortSignal,
  current: () => boolean): Promise<FixLineVerdict | null> {
  try {
    const valid = () => !signal.aborted && current() && owner === scopeGeneration();
    if (!valid() || (await auth.getSession())?.id !== userId) return null;
    const cefr = await loadProfile().then(profile => profile?.brain.cefr.estimate).catch(() => undefined);
    const headers = await authHeaders();
    if (!valid() || (await auth.getSession())?.id !== userId) return null;
    const res = await fetch(`${TOKEN_SERVER}/drill/fix-line`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ userId, original: repair.quote, better: repair.better, why: repair.why, attempt, ...(cefr ? { cefr } : {}) }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { verdict?: unknown };
    if (!valid() || (await auth.getSession())?.id !== userId) return null;
    return readFixLineVerdict(data.verdict);
  } catch { return null; }
}
