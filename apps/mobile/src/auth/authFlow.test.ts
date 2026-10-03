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

  test('the under-13 refusal outlasts a sign-in and sign-out in the same launch, and is still memory only', () => {
    // F641. Gate unmounts AuthFlow whenever someone is signed in, and a
    // sign-out mounts a new one. Refuse on save, "I have an account", then
    // Google or Apple creates an account; OnboardingFlow's age page and
    // AgeRefusal sign out; the new flow must still be refused. So the refusal
    // lives in Gate, which is drawn once for the whole launch.
    assert.equal((APP.match(/<Gate\b/g) ?? []).length, 1, 'Gate is drawn from more than one place, so the refusal could be lost to a second copy');
    assert.match(APP, /<Gate \/>/, 'Gate is keyed or handed props, so the refusal could be remounted away');
    assert.match(GATE, /const \[preAccountRefused, setPreAccountRefused\] = useState\(false\);/, 'Gate does not hold the refusal');
    assert.ok(GATE.includes('<SignedInRoot') && GATE.includes('<AuthFlow'), 'Gate no longer sits above both sides of the sign-in door; this test is reading the wrong thing');

    // Nothing hands it back. One setter call in the whole app, and it is true.
    assert.deepEqual(
      [...APP.matchAll(/setPreAccountRefused\(([^)]*)\)/g)].map((m) => m[1]),
      ['true'],
      'something sets the refusal back, so a sign-out or a sign-in could end it',
    );

    // The flow keeps no copy of its own, so a newly mounted flow reads Gate's.
    assert.doesNotMatch(FLOW, /useState[^\n]*refus|\[refused,|setRefused/, 'the flow holds its own refusal again, which a sign-in unmounts');

    // Memory only. The value appears in Gate twice, where it is declared and
    // where it is handed to the flow, and never beside a storage call.
    const uses = APP.split('\n').filter((line) => /\bpreAccountRefused\b/.test(line));
    assert.equal(uses.length, 2, `the refusal is read somewhere new (${uses.map((line) => line.trim()).join(' | ')})`);
    for (const line of uses) {
      assert.doesNotMatch(line, /save|clear|persist|write|storage|AsyncStorage|SecureStore|localStorage/i, `the refusal reaches a storage call (${line.trim()})`);
    }
    assert.doesNotMatch(
      APP,
      /(?:save\w*|clear\w*|persist\w*|write\w*|setItem|setItemAsync)\([^)]*[Rr]efus/,
      'a storage call is handed the refusal; a marker would be data about a minor the founder did not choose to keep',
    );
    assert.doesNotMatch(
      FLOW,
      /AsyncStorage|SecureStore|localStorage|savePreAccountDraft|clearPreAccountDraft|storage\//,
      'the flow writes to the device itself',
    );
    assert.doesNotMatch(read('..', 'onboarding', 'preAccountDraft.ts'), /refus|underAge/i, 'the draft carries the refusal to the device');
  });

  test('after a refusal the first run reopens on the refusal page, never on a fresh first page', () => {
    // Sign-in's back returns to the welcome, which is the one first run.
    assert.equal((FLOW.match(/<PreAccountOnboarding\b/g) ?? []).length, 1, 'the first run is drawn from more than one place in the flow');
    assert.match(FLOW, /<SignInScreen onBack=\{\(\) => setScreen\('welcome'\)\}/, 'sign-in no longer returns to the first run');

    // Once refused, the flow hands the screen a page to open on, not the
    // draft the refusal cleared.
    const screen = element(FLOW, 'PreAccountOnboarding');
    assert.match(screen, /\binitialDraft=\{refused \? refusalPage\(\) : initialDraft\}/, 'a refused learner who comes back meets the first run afresh');
    assert.match(
      FLOW,
      /const refusalPage = \(\): PreAccountOnboardingDraft => \(\{ \.\.\.freshPreAccountDraft\(\), page: 'save' \}\);/,
      'the refused first run no longer opens on a fresh draft at the save page',
    );

    // That draft, as data: the save page, the last of the six, and nothing a
    // learner answered or typed.
    const reopened = { ...freshPreAccountDraft(), page: 'save' as const };
    assert.equal(reopened.page, PRE_ACCOUNT_PAGES[PRE_ACCOUNT_PAGES.length - 1], 'the save page is no longer the last page of the first run');
    assert.equal(reopened.firstName, null, 'a refused first run reopens with a first name in it');
    assert.equal(reopened.startLevel, null);
    assert.equal(reopened.reason, null);
    assert.equal(reopened.minutes, null);
    assert.equal(reopened.reminderTime, null);
    assert.equal(reopened.analyticsConsent, false);

    // And the screen opens where the draft says, drawing the save page as the
    // refusal whenever it is refused.
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'the screen no longer opens on the page it is handed');
    assert.match(SCREEN, /const \[underAge, setUnderAge\] = useState\(refused\);/, 'the screen does not take the refusal it is handed');
    assert.match(SCREEN, /const refusedHere = page === 'save' && underAge;/, 'the save page is no longer where the refusal is drawn');
  });

  test('sign-in\'s "Create one" leads to the refusal once refused, because the flow has one door to sign-up', () => {
    assert.match(
      FLOW,
      /const toSignUp = \(\) => setScreen\(refused \? 'welcome' : 'signup'\);/,
      'the door to sign-up does not check the refusal',
    );
    assert.equal(
      (FLOW.match(/setScreen\([^)]*'signup'/g) ?? []).length,
      1,
      'sign-up is reached by a door that does not check the refusal',
    );
    assert.match(element(FLOW, 'SignInScreen'), /\bonCreateAccount=\{toSignUp\}/, 'sign-in\'s "Create one" goes round the refusal');

    // The save page's pill writes the draft only when not refused, so the
    // write never runs ahead of the one door.
    const pill = handler(element(FLOW, 'PreAccountOnboarding'), 'onCreateAccount');
    assert.match(pill, /\bif \(!refused\) \{\s*setSignupDraft\(draft\);\s*onCreateAccount\(draft\);\s*\}/, 'the save page\'s pill writes the draft before the door checks the refusal');
    assert.match(pill, /\btoSignUp\(\);/, 'the save page\'s pill goes round the one door to sign-up');
    assert.equal((FLOW.match(/\bonCreateAccount\(/g) ?? []).length, 1, 'the draft is written on the way to sign-up from somewhere unguarded');
  });

  test('clearing the draft does not remount the first run or drop the refusal within the launch', () => {
    // The discard sets App's draft to null, and so re-renders Gate. It must
    // re-render the same flow, not a new one.
    assert.doesNotMatch(element(GATE, 'AuthFlow'), /\bkey=/, 'App.tsx keys the flow, so a new key would remount the first run');
    const render = GATE.slice(GATE.indexOf("if (status === 'loading'"));
    assert.ok(render.includes('<AuthFlow'), 'Gate no longer renders the flow; this test is reading the wrong thing');
    for (const condition of conditions(render.slice(0, render.indexOf('<AuthFlow')))) {
      assert.doesNotMatch(condition, /preAccountDraft|draft\b|refus/i, `Gate branches on the draft or the refusal (${condition}), so a refusal could unmount the flow`);
    }
    assert.deepEqual(
      [...APP.matchAll(/setDraftLoaded\(([^)]*)\)/g)].map((m) => m[1]),
      ['true'],
      'the draft can be marked unloaded again, which would take the flow down behind a loading screen',
    );

    // Inside the flow, the first run is not keyed and is not chosen by the draft.
    assert.doesNotMatch(element(FLOW, 'PreAccountOnboarding'), /\bkey=/, 'the flow keys the first run, so a new key would remount it');
    for (const condition of conditions(FLOW)) {
      assert.doesNotMatch(condition, /initialDraft/, `the flow branches on the draft (${condition}), so clearing it could swap the screen`);
    }

    // And the screen reads the draft only as it mounts, so a draft that turns
    // to null under it moves nothing on the page.
    const reads = SCREEN.split('\n')
      .filter((line) => /\binitialDraft\b/.test(line))
      .filter((line) => !/^\s*initialDraft,\s*$/.test(line) && !/^\s*initialDraft: PreAccountOnboardingDraft \| null;\s*$/.test(line));
    assert.ok(reads.length > 0, 'the screen no longer reads its draft; this test is reading the wrong thing');
    for (const line of reads) {
      assert.match(line, /useState(?:<[^>]*>)?\(\(\) => /, `the screen reads its draft after mounting (${line.trim()}), so clearing it could move the page`);
    }
  });

  test('the onboarding and privacy docs say a sign-in and sign-out does not end the under-13 refusal before an account', () => {
    // F641. The founder's answer was the whole launch. "Signing in ends the
    // first run, and the refusal with it" narrowed it, and sat beside
    // sentences it contradicted. Every place that explains the refusal says
    // the same thing, and names Gate, not the flow, as what holds it.
    const onboardingRaw = raw('..', '..', '..', '..', 'docs', 'ONBOARDING.md');
    const onboarding = prose(onboardingRaw);
    const ageAt = onboardingRaw.indexOf('**The age question sits on the save page.**');
    assert.ok(ageAt > 0, 'docs/ONBOARDING.md no longer explains the age question on the save page');
    const age = prose(onboardingRaw.slice(ageAt, onboardingRaw.indexOf('\n\n', ageAt)));
    assert.match(age, SIGN_IN_AND_OUT, 'the onboarding doc no longer says a sign-in and sign-out leaves the refusal standing');
    assert.match(age, /on a shared phone, an adult who signs out later in the same launch meets the refusal page until the app is reopened\./, 'the onboarding doc no longer states the tradeoff');
    assert.match(age, /nothing is saved again in that launch/, 'the onboarding doc no longer says the draft stays cleared for the launch');

    const privacyRaw = raw('..', '..', '..', '..', 'docs', 'PRIVACY_AND_SAFETY.md');
    const privacy = prose(privacyRaw);
    const heading = '### An under-13 answer before an account keeps nothing';
    const sectionAt = privacyRaw.indexOf(heading);
    assert.ok(sectionAt > 0, 'the privacy doc no longer says what an under-13 answer before an account keeps');
    const section = prose(privacyRaw.slice(sectionAt, privacyRaw.indexOf('**The ceiling, plainly.**', sectionAt)));
    assert.match(section, SIGN_IN_AND_OUT, 'the privacy doc no longer says a sign-in and sign-out leaves the refusal standing');
    assert.match(section, /`Gate` in `App\.tsx`, which stays mounted for the whole launch, holds it/, 'the privacy doc names something other than Gate as holding the refusal');
    assert.match(section, /`keep` writes nothing for the rest of the launch/, 'the privacy doc no longer says nothing is saved again that launch');
    assert.match(
      privacyRaw.slice(privacyRaw.indexOf('## Not true yet')),
      /An under-13 answer before an account lasts the launch and no longer/,
      'Not true yet no longer says the refusal lasts the launch',
    );

    const header = prose(raw('AuthFlow.tsx').slice(0, raw('AuthFlow.tsx').indexOf('*/')));
    assert.match(header, SIGN_IN_AND_OUT, 'the flow\'s own header no longer says a sign-in and sign-out leaves the refusal standing');
    assert.match(header, /`Gate` in `App\.tsx`, which stays mounted for the whole launch, holds it\./, 'the flow\'s header names something other than Gate as holding the refusal');

    for (const [name, text] of [
      ['docs/ONBOARDING.md', onboarding],
      ['docs/PRIVACY_AND_SAFETY.md', privacy],
      ['AuthFlow.tsx', prose(raw('AuthFlow.tsx'))],
      ['App.tsx', prose(raw('..', '..', 'App.tsx'))],
      ['PreAccountOnboarding.tsx', prose(raw('..', 'onboarding', 'PreAccountOnboarding.tsx'))],
    ] as const) {
      assert.doesNotMatch(text, SIGN_IN_ENDS, `${name} says a sign-in ends the refusal, which narrows the founder's answer`);
    }
  });
});
