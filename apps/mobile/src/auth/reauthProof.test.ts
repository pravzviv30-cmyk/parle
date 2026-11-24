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
import { differentAccountLine, reauthenticationLine } from './friendly.ts';
import { downloadVerifiedAccountData } from '../privacy/export.ts';
import { setActiveUser } from '../storage/scope.ts';
import { guiltIn } from '../copy/guilt.ts';
import type { AuthAdapter, AuthUser } from './types.ts';

const AUTH_DIR = import.meta.dirname;
const A: AuthUser = { id: 'learner-a', email: null, provider: 'google' };

/**
 * A client signed in as A whose next provider sign-in returns `returns`
 * (null: no session at all). `signOutThrows` is a failed chunk delete in
 * secureSessionStorage, which leaves the other account signed in.
 */
function fakeClient(returns: string | null, { signOutThrows = false } = {}) {
  const log: string[] = [];
  let sessionId: string | null = A.id;
  const client: SessionClient = {
    auth: {
      getSession: async () => ({ data: { session: sessionId ? { user: { id: sessionId } } : null } }),
      signOut: async (options) => {
        log.push(`signOut:${options.scope}`);
        if (signOutThrows) throw new Error('chunk delete failed');
        sessionId = null; return {};
      },
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
    const run = await exportAs('learner-b');
    assert.deepEqual(run.result, { ok: false, message: differentAccountLine('export') });
    assert.equal(run.requested, false, 'no export request is sent');
    assert.equal(run.fileMade, false, 'no file is made');
    assert.equal(run.shared, false, 'no share sheet opens');
    assert.equal(run.saved, false);
    assert.deepEqual(run.log, ['signOut:local']);
    assert.deepEqual(run.changed, ['export']);
  }

  // Control: the same account coming back still exports.
  {
    const run = await exportAs(A.id);
    assert.equal(run.requested, true, 'the export goes ahead for the account that asked');
    assert.deepEqual(run.log, []);
    assert.deepEqual(run.changed, []);
  }
});

/** Export through the real verified path, with the helper in the adapter's place. */
async function exportAs(returns: string) {
  const { log, client, providerSignIn, session } = fakeClient(returns);
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
    exportId: () => '11111111-1111-4111-8111-111111111111',
    // The request is where this test stops caring: it proves the export began.
    request: (async () => { requested = true; return new Response('{}', { status: 503 }); }) as typeof fetch,
    createFile: async () => { fileMade = true; return { append: async () => {}, share: async () => { shared = true; }, discard: async () => {} }; },
    save: async () => { saved = true; },
  });
  return { result, log, changed, requested, fileMade, shared, saved };
}

test('a sign-out that fails leaves no claim that the switch was undone', async () => {
  const { log, client, providerSignIn, session } = fakeClient('learner-b', { signOutThrows: true });
  const changed: string[] = [];
  const result = await proveSameAccount(client, A.id, await providerSignIn(), 'deletion', (p) => changed.push(p));
  assert.equal(session(), 'learner-b', 'the fake really left B signed in');
  assert.deepEqual(log, ['signOut:local']);
  assert.deepEqual(changed, [], 'no "Different account" sheet while B is still signed in');
  assert.deepEqual(result, { ok: false, message: reauthenticationLine('deletion') });
});

test('a provider sign-in that leaves no session refuses without the different-account sheet', async () => {
  const { log, client, providerSignIn, session } = fakeClient(null);
  const changed: string[] = [];
  const result = await proveSameAccount(client, A.id, await providerSignIn(), 'export', (p) => changed.push(p));
  assert.equal(session(), null);
  assert.deepEqual(changed, [], 'nobody to have switched to, so no sheet');
  assert.deepEqual(result, { ok: false, message: reauthenticationLine('export') });
  assert.deepEqual(log, [], 'nothing to sign out');
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
  // On iOS the line is announced once the sheet has shown, after the Sheet has
  // moved VoiceOver to its heading; announced on mount, that focus move cut it off.
  assert.match(
    provider,
    /title="Different account"[^>]*onShow=\{\(\) => \{ if \(accountChanged && Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(differentAccountLine\(accountChanged\)\); \}\}/,
    'on iOS the line must be announced after the sheet shows, because the live region does nothing there',
  );
  assert.equal(provider.match(/announceForAccessibility/g)?.length, 1, 'one announcement, from onShow, not a second on mount');
  const sheetSource = readFileSync(path.resolve(AUTH_DIR, '..', 'components.tsx'), 'utf8');
  assert.match(
    sheetSource.slice(sheetSource.indexOf('export function Sheet')),
    /<Modal visible=\{present\}[^>]*onShow=\{\(\) => \{ focusHeading\(\); onShow\?\.\(\); \}\}/,
    'the Sheet must move focus to its heading first and only then hand over to its onShow',
  );
  const sheet = provider.slice(provider.indexOf('title="Different account"'));
  assert.match(sheet.slice(0, 400), /label="Continue"/);
});
