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
