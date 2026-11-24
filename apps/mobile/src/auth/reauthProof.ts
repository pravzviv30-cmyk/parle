/**
 * Proving a provider re-sign-in came back as the learner who asked — F1324.
 *
 * On native, a Google or Apple sign-in before deletion or export swaps the
 * session to whichever account the chooser returned. An ok result therefore
 * proves someone signed in, not that it was this learner. Deletion acts on the
 * current bearer, so without this check it removes the other account and tells
 * the learner theirs is gone.
 *
 * On a different id the other account is signed out on this phone only (its
 * server session is not ours to revoke), the adapter's listener is told so the
 * sign-in door can say what happened, and nothing is deleted or exported.
 */

import type { AuthResult } from './types.ts';
import { differentAccountLine, reauthenticationLine } from './friendly.ts';

/** The two calls this needs from the Supabase client, so a test can supply them. */
export interface SessionClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
    signOut(options: { scope: 'local' }): Promise<unknown>;
  };
}

export async function proveSameAccount(
  client: SessionClient,
  expectedUserId: string,
  result: AuthResult,
  purpose: 'deletion' | 'export',
  accountChanged: (purpose: 'deletion' | 'export') => void,
): Promise<AuthResult> {
  if (!result.ok) return result;
  const { data } = await client.auth.getSession();
  const signedIn = data.session?.user.id;
  if (signedIn === expectedUserId) return result;
  if (!signedIn) return { ok: false, message: reauthenticationLine(purpose) };
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The refusal below must still be returned; deletion never runs on it.
  }
  accountChanged(purpose);
  return { ok: false, message: differentAccountLine(purpose) };
}
