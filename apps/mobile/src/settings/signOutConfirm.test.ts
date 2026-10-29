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
    assert.deepEqual(signOutStep(asked, 'leave'), { open: true, signOut: true });
    assert.equal(signOutStep(closed, 'leave').signOut, false, 'a stray leave without the sheet signs out');

    for (const line of Object.values(SIGN_OUT_CONFIRM)) assert.ok(!/[—·]/.test(line), `${line} carries an em dash or middot`);

    // Wiring: the row only opens the sheet; the sheet's link is the one door to onSignOut.
    const settings = strip(read('./SettingsScreen.tsx'));
    assert.doesNotMatch(settings, /label=\{SIGN_OUT_ROW\}[^/]*onPress=\{onSignOut\}/, 'the Sign out row still signs out on the first tap');
    assert.match(settings, /label=\{SIGN_OUT_ROW\}[^/]*onPress=\{\(\) => (void )?stepSignOut\('ask'\)\}/, 'the Sign out row does not open the confirmation');
    const sheet = settings.match(/<ConfirmSheet[\s\S]*?\/>/)?.[0] ?? '';
    assert.match(sheet, /title=\{SIGN_OUT_CONFIRM\.title\}/, 'no sign-out ConfirmSheet');
    assert.match(sheet, /cancelLabel=\{SIGN_OUT_CONFIRM\.stay\}/, 'staying is not the solid pill');
    assert.match(sheet, /confirmLabel=\{SIGN_OUT_CONFIRM\.leave\}/, 'signing out is not the quiet link');
    assert.match(sheet, /onCancel=\{\(\) => (void )?stepSignOut\('dismiss'\)\}/, 'a dismissal does not keep the learner');
    assert.match(sheet, /onConfirm=\{\(\) => (void )?stepSignOut\('leave'\)\}/, 'the link does not sign out');
    assert.match(settings, /if \(!next\.signOut \|\| signOutSheet\.signOut\) return;[\s\S]{0,60}await flushBeforeSignOut\(\);\s*onSignOut\(\)/, 'leaving never reaches onSignOut');
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
    // Exactly one flush before sign-out: Settings runs it (busy sheet); App does not repeat it.
    assert.doesNotMatch(app, /flushBeforeSignOut\(/, 'App.tsx flushes a second time on sign-out');
    const settingsSource = strip(read('./SettingsScreen.tsx'));
    assert.equal(settingsSource.match(/flushBeforeSignOut\(/g)?.length, 1, 'Settings must flush exactly once');
    assert.match(settingsSource, /await flushBeforeSignOut\(\);\s*onSignOut\(\)/, 'Settings does not flush before sign-out');
    assert.match(app, /registerSignOutSync\(\{[\s\S]*?engine\.stopped\(\)/, 'the engine is not registered for sign-out');
  });
});

describe('sign-out busy state (F938)', () => {
  test('the sign-out sheet stays open and busy while it saves', () => {
    const closed = { open: false, signOut: false };
    const asked = signOutStep(closed, 'ask');
    const leaving = signOutStep(asked, 'leave');
    assert.deepEqual(leaving, { open: true, signOut: true }, 'the sheet closes before the save finishes');
    // A dismissal during the save does not cancel the confirmed sign-out.
    assert.deepEqual(signOutStep(leaving, 'dismiss'), leaving, 'a dismissal cancels the confirmed sign-out');
    assert.deepEqual(signOutStep(leaving, 'stay'), leaving, 'staying cancels the confirmed sign-out');
    assert.deepEqual(signOutStep(leaving, 'leave'), leaving, 'a second tap signs out twice');
    assert.deepEqual(signOutStep(leaving, 'done'), closed, 'the sheet does not close when sign-out completes');
    assert.ok(!/[—·…]/.test(SIGN_OUT_CONFIRM.leaving));

    const settings = strip(read('./SettingsScreen.tsx'));
    const sheet = settings.match(/<ConfirmSheet[\s\S]*?\/>/)?.[0] ?? '';
    assert.match(sheet, /busy=\{signOutSheet\.signOut\}/, 'the sheet is not busy while signing out');
    assert.match(sheet, /busyLabel=\{SIGN_OUT_CONFIRM\.leaving\}/);
    assert.match(settings, /await flushBeforeSignOut\(\)[\s\S]{0,80}onSignOut\(\)/, 'Settings signs out before the save');

    // ConfirmSheet: busy defaults off, and while busy every way out is ignored.
    const layout = read('../layout.tsx');
    const confirm = layout.slice(layout.indexOf('type ConfirmSheetProps'), layout.indexOf('\n}\n', layout.indexOf('export function ConfirmSheet')));
    assert.match(confirm, /busy\?: boolean/);
    assert.match(confirm, /busy = false/, 'existing callers become busy');
    assert.match(confirm, /onClose=\{busy \? ignore : onCancel\}/, 'the scrim still dismisses while busy');
    assert.match(confirm, /disabled=\{busy\}/, 'buttons stay live while busy');
  });
});
