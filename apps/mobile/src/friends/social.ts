import { auth } from '../auth/adapter.ts';
import { activeUserId } from '../storage/scope.ts';
import { DEFAULT_SOCIAL_SETTINGS, utcWeek, type SocialSnapshot } from './socialModel.ts';

const listeners = new Set<() => void>();
export function onSocialChange(callback: () => void): () => void { listeners.add(callback); return () => listeners.delete(callback); }

/** Uses the signed-in bearer, never a service key or a second auth session. */
export async function socialRequest<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const uid = activeUserId();
  if (!uid || auth.kind !== 'supabase') throw new Error('Friends needs an online account. Your practice is ready whenever you are.');
  const token = await auth.getAccessToken();
  if (!token || uid !== activeUserId()) throw new Error('Sign in again to open Friends.');
  const result = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/luvani_social`, {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(12000),
  });
  if (!result.ok) {
    const body = await result.json().catch(() => ({})) as { message?: string };
    const messages: Record<string, string> = {
      username_taken: 'That username is already in use. Try another.', invalid_username: 'Use 3 to 24 lowercase letters, numbers, dots or underscores.',
      not_found: 'That person is not available. Check their username.', not_allowed: 'That action is no longer available. Refresh Friends and try again.',
      limit_reached: 'Please let your current requests settle before sending more.',
    };
    throw new Error(messages[body.message ?? ''] ?? 'Friends could not connect just now. Please try again.');
  }
  const data = await result.json() as T;
  if (uid !== activeUserId()) throw new Error('The signed-in account changed. Please reopen Friends.');
  if (action !== 'snapshot' && action !== 'search') for (const listener of listeners) listener();
  return data;
}

export function readSocial(): Promise<SocialSnapshot> {
  if (auth.kind !== 'supabase') {
    const week = utcWeek(Date.now());
    return Promise.resolve({ self: { id: activeUserId() ?? '', username: '', name: 'You', points: null, days: 0, conversations: 0 }, friends: [], requests: [], challenges: [], notices: [], blocked: [], settings: DEFAULT_SOCIAL_SETTINGS, week: week.key, resets: new Date(week.end).toISOString() });
  }
  return socialRequest('snapshot');
}
