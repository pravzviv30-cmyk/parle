import type { AuthAdapter, AuthResult } from './types.ts';

/** A session event can arrive before signup resolves. Hold new-account routing until ownership is known. */
export async function trackedEmailSignup(
  adapter: Pick<AuthAdapter, 'signUpWithPassword' | 'getSession'>,
  email: string,
  password: string,
  state: { begin: () => void; created: (userId: string) => void; finish: () => void },
): Promise<AuthResult> {
  state.begin();
  try {
    const result = await adapter.signUpWithPassword(email, password);
    if (result.ok && !result.message && result.createdUserId) {
      const created = await adapter.getSession();
      if (
        created?.id === result.createdUserId &&
        (created.provider === 'password' || created.provider === 'mock') &&
        created.email?.trim().toLowerCase() === email.trim().toLowerCase()
      ) state.created(created.id);
    }
    return result;
  } finally {
    state.finish();
  }
}
