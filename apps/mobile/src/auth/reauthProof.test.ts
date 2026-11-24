/**
 * A provider re-sign-in that comes back as someone else — F1324.
 *
 * Before deletion or export, a Google or Apple learner signs in again on
 * native. The provider's chooser can hand back a different account, and the
 * SDK swaps the session to it. "Someone signed in" is not "the learner who
 * asked signed in", so `proveSameAccount` compares the two ids and refuses.
 *
 * The sequence is driven with a fake client and the real
 * `deleteAccountAndErase` and `downloadVerifiedAccountData`; where the line is
 * drawn is a source read, because there is no renderer here (docs/TESTING.md).
 * What a device proves on top is in docs/DEVICE_VERIFICATION.md.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, test } from 'node:test';

import { proveSameAccount, type SessionClient } from './reauthProof.ts';
import { deleteAccountAndErase } from './deleteAccountFlow.ts';
import { differentAccountLine } from './friendly.ts';
import { downloadVerifiedAccountData } from '../privacy/export.ts';
import { setActiveUser } from '../storage/scope.ts';
import { guiltIn } from '../copy/guilt.ts';
import type { AuthAdapter, AuthUser } from './types.ts';

const AUTH_DIR = import.meta.dirname;
const A: AuthUser = { id: 'learner-a', email: null, provider: 'google' };

/** A client signed in as A whose next provider sign-in returns `returns`. */
function fakeClient(returns: string) {
  const log: string[] = [];
  let sessionId: string | null = A.id;
  const client: SessionClient = {
    auth: {
      getSession: async () => ({ data: { session: sessionId ? { user: { id: sessionId } } : null } }),
      signOut: async (options) => { log.push(`signOut:${options.scope}`); sessionId = null; return {}; },
    },
  };
  const providerSignIn = async () => { sessionId = returns; return { ok: true as const }; };
  return { log, client, providerSignIn, session: () => sessionId };
}

beforeEach(() => setActiveUser(A.id));

test('a provider reauthentication that returns another account deletes nothing', async () => {
  // Deletion: B comes back from the chooser.
  {
    const { log, client, providerSignIn, session } = fakeClient('learner-b');
    const changed: string[] = [];
    const result = await deleteAccountAndErase({
      reauthenticate: async () => proveSameAccount(client, A.id, await providerSignIn(), 'deletion', (p) => changed.push(p)),
      deleteAccount: async () => { log.push('deleteAccount'); return { ok: true }; },
      eraseThisDevice: async () => { log.push('eraseThisDevice'); },
      signOut: async () => { log.push('signOut'); },
      warnLocalCopyKept: () => { log.push('warnLocalCopyKept'); },
    });
    assert.deepEqual(result, { ok: false, message: differentAccountLine('deletion') });
    assert.deepEqual(log, ['signOut:local'], 'the other account is signed out on this phone and nothing else runs');
    assert.equal(log.includes('deleteAccount'), false, 'deleteAccount must never be called for the wrong account');
    assert.equal(session(), null);
    assert.deepEqual(changed, ['deletion'], 'the sign-in door is told so it can say what happened');
  }

  // Control: the same account coming back still deletes, so the guard is not a wall.
  {
    const { log, client, providerSignIn } = fakeClient(A.id);
    const changed: string[] = [];
    const result = await deleteAccountAndErase({
      reauthenticate: async () => proveSameAccount(client, A.id, await providerSignIn(), 'deletion', (p) => changed.push(p)),
      deleteAccount: async () => { log.push('deleteAccount'); return { ok: true }; },
      eraseThisDevice: async () => { log.push('eraseThisDevice'); },
      signOut: async () => { log.push('signOut'); },
      warnLocalCopyKept: () => {},
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(log, ['deleteAccount', 'eraseThisDevice', 'signOut']);
    assert.deepEqual(changed, []);
  }

  // Export: B comes back, and no file is made and no share sheet opens.
  {
    const { log, client, providerSignIn, session } = fakeClient('learner-b');
    const changed: string[] = [];
    let requested = false; let fileMade = false; let shared = false; let saved = false;
    const adapter: AuthAdapter = {
      kind: 'supabase',
      getSession: async () => (session() ? { ...A, id: session()! } : null),
      onAuthStateChange: () => () => {},
      signUpWithPassword: async () => ({ ok: true }),
      signInWithPassword: async () => ({ ok: true }),
      signInWithGoogle: async () => ({ ok: true }),
      signInWithApple: async () => ({ ok: true }),
      sendPasswordReset: async () => ({ ok: true }),
      reauthenticateForDeletion: async (_secret, purpose = 'deletion') =>
        proveSameAccount(client, A.id, await providerSignIn(), purpose, (p) => changed.push(p)),
      deleteAccount: async () => { log.push('deleteAccount'); return { ok: true }; },
      signOut: async () => {},
      getAccessToken: async () => (session() ? `token-${session()}` : null),
    };
    const result = await downloadVerifiedAccountData(A, adapter, undefined, {
      request: (async () => { requested = true; return new Response('{}'); }) as typeof fetch,
      createFile: async () => { fileMade = true; return { append: async () => {}, share: async () => { shared = true; }, discard: async () => {} }; },
      save: async () => { saved = true; },
    });
    assert.deepEqual(result, { ok: false, message: differentAccountLine('export') });
    assert.equal(requested, false, 'no export request is sent');
    assert.equal(fileMade, false, 'no file is made');
    assert.equal(shared, false, 'no share sheet opens');
    assert.equal(saved, false);
    assert.deepEqual(log, ['signOut:local']);
    assert.deepEqual(changed, ['export']);
  }
});

test('the different-account line is announced on the sign-in door and keeps the copy rules', () => {
  const deletion = differentAccountLine('deletion');
  const exported = differentAccountLine('export');
  // Founder-approved, 2026-11-24. Any change goes back to the founder.
  assert.equal(deletion, 'You signed in with a different account, so nothing was deleted. Sign in with the account you want to delete, then delete it again.');
  assert.equal(exported, 'You signed in with a different account, so nothing was downloaded. Sign in with the account you want, then download your data again.');
  for (const line of [deletion, exported]) {
    assert.doesNotMatch(line, /—|–/, 'no em or en dashes in learner copy');
    assert.doesNotMatch(line, /sign-in/i, 'learner copy writes "sign in" with no hyphen');
    assert.equal(guiltIn(line), undefined, 'no scolding');
  }

  // Drawn by AuthProvider, which outlives the signed-in tree the swap unmounts.
  const provider = readFileSync(path.join(AUTH_DIR, 'useAuth.tsx'), 'utf8');
  assert.match(provider, /adapter\.onAccountChanged\?\.\(/, 'AuthProvider must listen for the account change');
  assert.match(provider, /title="Different account"/);
  assert.match(provider, /differentAccountLine\(accountChanged\)/);
  // accessibilityLiveRegion is Android-only; VoiceOver needs the explicit announcement.
  assert.match(provider, /accessibilityLiveRegion="polite"[^>]*>\{differentAccountLine\(accountChanged\)\}/);
  assert.match(
    provider,
    /if \(accountChanged && Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(differentAccountLine\(accountChanged\)\)/,
    'on iOS the line must be announced, because the live region does nothing there',
  );
  const sheet = provider.slice(provider.indexOf('title="Different account"'));
  assert.match(sheet.slice(0, 400), /label="Continue"/);
});
