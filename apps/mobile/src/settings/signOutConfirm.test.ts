import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { SIGN_OUT_CONFIRM, signOutStep } from './signOutConfirm.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('sign-out confirmation (F938)', () => {
  test('sign-out asks first, and staying keeps the learner signed in', () => {
    const closed = { open: false, signOut: false };
    const asked = signOutStep(closed, 'ask');
    assert.deepEqual(asked, { open: true, signOut: false }, 'the row signs out instead of asking');
    assert.deepEqual(signOutStep(asked, 'stay'), closed, 'staying signs the learner out');
    assert.deepEqual(signOutStep(asked, 'dismiss'), closed, 'a dismissal signs the learner out');
    assert.deepEqual(signOutStep(asked, 'leave'), { open: false, signOut: true });
    assert.equal(signOutStep(closed, 'leave').signOut, false, 'a stray leave without the sheet signs out');

    for (const line of Object.values(SIGN_OUT_CONFIRM)) assert.ok(!/[—·]/.test(line), `${line} carries an em dash or middot`);

    // Wiring: the row only opens the sheet; the sheet's link is the one door to onSignOut.
    const settings = strip(read('./SettingsScreen.tsx'));
    assert.doesNotMatch(settings, /label=\{SIGN_OUT_ROW\}[^/]*onPress=\{onSignOut\}/, 'the Sign out row still signs out on the first tap');
    assert.match(settings, /label=\{SIGN_OUT_ROW\}[^/]*onPress=\{\(\) => stepSignOut\('ask'\)\}/, 'the Sign out row does not open the confirmation');
    const sheet = settings.match(/<ConfirmSheet[\s\S]*?\/>/)?.[0] ?? '';
    assert.match(sheet, /title=\{SIGN_OUT_CONFIRM\.title\}/, 'no sign-out ConfirmSheet');
    assert.match(sheet, /cancelLabel=\{SIGN_OUT_CONFIRM\.stay\}/, 'staying is not the solid pill');
    assert.match(sheet, /confirmLabel=\{SIGN_OUT_CONFIRM\.leave\}/, 'signing out is not the quiet link');
    assert.match(sheet, /onCancel=\{\(\) => stepSignOut\('dismiss'\)\}/, 'a dismissal does not keep the learner');
    assert.match(sheet, /onConfirm=\{\(\) => stepSignOut\('leave'\)\}/, 'the link does not sign out');
    assert.match(settings, /if \(next\.signOut\) onSignOut\(\)/, 'leaving never reaches onSignOut');
  });
});

describe('sign-out and unsynced practice (F938)', () => {
  test('the sign-out sheet never claims unsynced practice is saved to the account', async () => {
    const { signOutBody } = await import('./signOutConfirm.ts');
    assert.equal(signOutBody(0), SIGN_OUT_CONFIRM.body);
    const pending = signOutBody(2);
    assert.notEqual(pending, SIGN_OUT_CONFIRM.body, 'pending writes are still told they are saved to the account');
    assert.doesNotMatch(pending, /saved to your account/);
    assert.match(pending, /next time you sign in on this phone/);
    assert.ok(!/[—·]/.test(pending));
    const settings = strip(read('./SettingsScreen.tsx'));
    const sheet = settings.match(/<ConfirmSheet[\s\S]*?\/>/)?.[0] ?? '';
    assert.doesNotMatch(sheet, /body=\{SIGN_OUT_CONFIRM\.body\}/, 'the sheet still shows the fixed body');
  });

  test('sign-out flushes pending writes before stopping sync', async () => {
    const { flushBeforeSignOut } = await import('./signOutConfirm.ts');
    const order: string[] = [];
    let pending = 1;
    await flushBeforeSignOut({ pending: () => pending, flush: async () => { order.push('flush'); pending = 0; } }, 50);
    order.push('stop');
    assert.deepEqual(order, ['flush', 'stop']);
    // A flush that never answers is bounded.
    const started = Date.now();
    await flushBeforeSignOut({ pending: () => 1, flush: () => new Promise(() => {}) }, 30);
    assert.ok(Date.now() - started < 1000, 'a stuck flush holds sign-out');
    // A failing flush still lets sign-out go.
    await flushBeforeSignOut({ pending: () => 1, flush: () => Promise.reject(new Error('offline')) }, 30);
    // App wiring: the onSignOut path flushes before auth.signOut, and the engine is registered.
    const app = strip(read('../../App.tsx'));
    assert.match(app, /await flushBeforeSignOut\(\);\s*await auth\.signOut\(\)/, 'sign-out does not flush first');
    assert.match(app, /registerSignOutSync\(\{[\s\S]*?engine\.stopped\(\)/, 'the engine is not registered for sign-out');
  });
});
