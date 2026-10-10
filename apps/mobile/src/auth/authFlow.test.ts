import { evidence } from '../../test/evidence.ts';
/**
 * The under-13 refusal before an account holds for the launch (F637, F639, F641).
 *
 * Founder decision, 2026-09-30: firmer, and clear on refusal. Once a learner
 * says they are younger than 13, the refusal holds for the rest of the launch,
 * across the "I have an account" detour and across a sign-in and sign-out, and
 * the saved first-run draft is cleared with any first name typed. Nothing about
 * the refusal is written to the device, so a relaunch may ask again, like the
 * age gate.
 *
 * apps/mobile has no renderer (docs/TESTING.md), so the wiring is a read of the
 * three files that carry it: `App.tsx`'s `Gate` holds the refusal, because it
 * stays mounted for the launch while `AuthFlow` is unmounted by every sign-in;
 * `AuthFlow.tsx` hands it to the first run and guards the door to sign-up; and
 * the first-run screen reads its draft only when it mounts. The one value here
 * is the page the first run reopens on, which is plain data.
 *
 * The screen's own half (the refusal handler, `keep` writing nothing once
 * refused) is pinned in `onboarding/firstRun.test.ts`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { describe, test } from 'node:test';

import { PRE_ACCOUNT_PAGES, freshPreAccountDraft } from '../onboarding/preAccountDraft.ts';

const AUTH_DIR = import.meta.dirname;

/** A file as written, comments and all, for the tests that read words rather than code. */
const raw = (...parts: string[]) => readFileSync(path.resolve(AUTH_DIR, ...parts), 'utf8');
/** Source with comments blanked, so a sentence about a call is not the call. */
const strip = (source: string) => {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
};
const read = (...parts: string[]) => strip(raw(...parts));
/** Text with comment markers and line breaks folded, so a wrapped sentence reads whole. */
const prose = (text: string) => text.replace(/\n\s*(?:\/\/|\*)[ \t]?/g, ' ').replace(/\s+/g, ' ');

const FLOW = read('AuthFlow.tsx');
const APP = read('..', '..', 'App.tsx');
const SCREEN = read('..', 'onboarding', 'PreAccountOnboarding.tsx');

/** One JSX element's source, from its opening tag to the `/>` that closes it. */
function element(source: string, tag: string): string {
  const at = source.search(new RegExp(`<${tag}(?=\\s|>)`));
  assert.ok(at >= 0, `<${tag}> is not rendered`);
  return source.slice(at, source.indexOf('/>', at) + 2);
}

/** The body of an arrow prop such as `onCreateAccount={(draft) => { ... }}`. */
function handler(source: string, prop: string): string {
  const at = source.indexOf(`${prop}={`);
  assert.ok(at >= 0, `${prop} is not passed`);
  return source.slice(at, source.indexOf('}}', at) + 2);
}

/** A `useCallback` in App.tsx, from its name to the dependency list that closes it. */
function callback(name: string): string {
  const at = APP.indexOf(`const ${name} = useCallback(`);
  assert.ok(at > 0, `App.tsx has no ${name}`);
  return APP.slice(at, APP.indexOf('}, [', at));
}

/** Every `if (...)` condition in a stretch of source, one level of calls deep. */
const conditions = (source: string) =>
  [...source.matchAll(/\bif \(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1]!);

/** Gate, the one component that decides between the signed-in app and this flow. */
const GATE = APP.slice(APP.indexOf('function Gate()'), APP.indexOf('export default function App()'));

/** The sentence the founder's answer comes down to, in every place that explains it. */
const SIGN_IN_AND_OUT = /Signing in and out again does not end it; only closing the app does\./;
/** The narrower answer the founder did not give, in either of the words it was written in. */
const SIGN_IN_ENDS = /Signing in ends[^.]*refusal|refusal[^.]*until someone signs in/i;

describe('the under-13 refusal before an account holds for the launch (F637, F639, F641)', () => {
  test('the flow passes the refusal up to Gate, which holds it and clears the saved draft', () => {
    // Required, not optional: a Gate that forgot to wire either would not
    // compile, rather than quietly keeping a refused child's first name on the
    // device, or offering the pill again to the next flow it mounts.
    assert.match(FLOW, /\n\s*refused: boolean;/, 'the flow takes the refusal as optional, so a caller can leave it out');
    assert.match(FLOW, /\n\s*onRefuse: \(\) => void;/, 'the discard on refusal is optional, so a caller can leave the draft on the device');

    const screen = element(FLOW, 'PreAccountOnboarding');
    assert.match(screen, /\brefused=\{refused\}/, 'the flow does not hand the refusal back to the screen');
    assert.match(screen, /\bonRefuse=\{onRefuse\}/, 'the flow does not pass the refusal up');

    const flowInGate = element(GATE, 'AuthFlow');
    assert.match(flowInGate, /\brefused=\{preAccountRefused\}/, 'Gate does not hand the refusal to the flow');
    assert.match(flowInGate, /\bonRefuse=\{refusePreAccount\}/, 'Gate does not hear the refusal');

    const refuse = callback('refusePreAccount');
    assert.match(refuse, /setPreAccountRefused\(true\);/, 'Gate hears the refusal but does not hold it');
    assert.match(refuse, /\bdiscardPreAccountDraft\(\);/, 'Gate holds the refusal but never clears the saved draft');
    const discard = APP.slice(APP.indexOf('const discardPreAccountDraft'), APP.indexOf('}, []);', APP.indexOf('const discardPreAccountDraft')));
    assert.match(discard, /setPreAccountDraft\(null\);/, 'the discard keeps the draft in memory');
    assert.match(discard, /void clearPreAccountDraft\(\);/, 'the discard leaves the draft on the device');
  });

  test("under-thirteen refusal is owned by the launch and passed to signed-out and signed-in onboarding", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); });

  test("a refused flow renders refusal rather than a new eligible draft", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /initialDraft=\{refused \? refusalPage\(\)/); assert.match(screen, /const title = refused \?/); assert.match(screen, /footer = refused/); assert.match(screen, /if \(operation\.current \|\| !draft\.eligibilityConfirmed \|\| refused\) return/); });

  test("Create one can reset an introduction but cannot bypass a launch refusal", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /const draft = refused \? refusalPage\(\) : freshPreAccountDraft\(\)/); assert.match(flow, /if \(!refused\) onDraftChange\(draft\)/); assert.match(flow, /if \(refused\) return/); assert.match(flow, /onCreateAccount=\{newAccount\}/); });

  test("ordinary draft changes do not remount onboarding; only an explicit new account advances its revision", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /key=\{revision\}/); assert.equal((flow.match(/setRevision\(/g) ?? []).length, 1); const newAccount = flow.slice(flow.indexOf('const newAccount ='), flow.indexOf('const signIn =')); assert.match(newAccount, /setRevision/); assert.doesNotMatch(app, /<AuthFlow key=/); assert.match(app, /refused=\{preAccountRefused\}/); });

  test('switching from onboarding sign-in to sign-up preserves the completed plan and email', () => {
    const start = FLOW.indexOf('  const createFromIntroduction = ');
    const end = FLOW.indexOf('  if (!introducing)', start);
    assert.ok(start > 0 && end > start);
    const saved = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorChosen: true, tutorVoice: 'emilie', reason: 'trip', firstName: 'Camille', accountEmail: 'camille@example.com', accountMode: 'signin', accountReturnPage: 'keep', page: 'account' };
    const writes: unknown[] = []; const screens: string[] = []; let resets = 0;
    const bindings = { pageMotion: { locked: { current: false } }, refused: false, signupDraft: saved, newDraft: null, initialDraft: null,
      newAccount: () => { resets++; }, setSignupDraft: (value: unknown) => writes.push(value), onDraftChange: () => {}, onCreateAccount: () => {}, switchScreen: (next: string) => screens.push(next) };
    new Function(...Object.keys(bindings), stripTypeScriptTypes(FLOW.slice(start, end)) + '\ncreateFromIntroduction();')(...Object.values(bindings));
    assert.equal(resets, 0);
    assert.deepEqual(writes, [{ ...saved, accountMode: 'signup' }]);
    assert.deepEqual(screens, ['signup']);
    assert.match(FLOW, /onCreateAccount=\{createFromIntroduction\}/);
  });

  test("onboarding and privacy document refusal across authentication without storing a child marker", () => { for (const path of ['docs/ONBOARDING.md','docs/PRIVACY_AND_SAFETY.md']) { const doc = evidence(path); assert.match(doc, /sign-in and sign-out/); assert.match(doc, /remainder of the launch|rest of the launch/); assert.match(doc, /no refusal marker/); } });
});
