import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { addressAfterSignOut, landingAfterAuth, sawSignedOut, type AuthPhase } from './landing.ts';

const APP = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const walk = (statuses: AuthPhase[]) => statuses.reduce(sawSignedOut, false);

describe('where a signed-in learner lands (F938)', () => {
  test('signing back in lands on Today', () => {
    assert.equal(landingAfterAuth({ justOnboarded: false, signedInThisLaunch: walk(['loading', 'signedIn', 'signedOut', 'signedIn']) }), 'today');
    assert.equal(landingAfterAuth({ justOnboarded: false, signedInThisLaunch: walk(['loading', 'signedOut', 'signedIn']) }), 'today');
    // A first run (including "Save and finish the scene") keeps its own landing.
    assert.equal(landingAfterAuth({ justOnboarded: true, signedInThisLaunch: true }), 'first-run');
    // On web a sign-out wipes the address the last learner left behind.
    assert.equal(addressAfterSignOut('web', true, true), '/');
    assert.equal(addressAfterSignOut('ios', true, true), null);
    assert.equal(addressAfterSignOut('web', false, true), null);

    assert.match(APP, /signedInThisLaunch=\{signedOutThisLaunch\.current\}/, 'Gate does not tell the signed-in tree how it arrived');
    assert.match(APP, /landingAfterAuth\(\{ justOnboarded, signedInThisLaunch \}\)/, 'openFirstRun does not ask where to land');
    assert.match(APP, /landing === 'today'[\s\S]{0,200}resetRoot\(\{[\s\S]{0,120}name: 'Tabs', state: \{ routes: \[\{ name: 'Home' \}\] \}/, 'a sign-in does not reset to Today');
    assert.match(APP, /addressAfterSignOut\(Platform\.OS, was, status === 'signedOut'\)/, 'sign-out does not clear the web address');
    assert.match(APP, /window\.history\.replaceState\(/, 'the address is not replaced');
  });

  test('a cold load with a session keeps its address', () => {
    assert.equal(walk(['loading', 'signedIn']), false);
    assert.equal(landingAfterAuth({ justOnboarded: false, signedInThisLaunch: walk(['loading', 'signedIn']) }), 'keep');
    // Only the 'today' branch resets; 'keep' leaves the linking-resolved state alone.
    const openFirstRun = APP.match(/const openFirstRun = useCallback\([\s\S]*?\n  \}, \[/)?.[0] ?? '';
    assert.equal((openFirstRun.match(/resetRoot\(/g) ?? []).length, 2, 'openFirstRun resets on a path other than first run and sign-in');
  });
});
