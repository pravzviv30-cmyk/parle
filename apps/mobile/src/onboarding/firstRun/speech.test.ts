/**
 * When the first run offers speaking (F756; founder decision D13).
 *
 * Guest speech has its own server admission, and the service says at the start
 * of a guest practice whether it is open. Speaking is the default only on that
 * yes; otherwise typing comes first and nobody lands on an unavailable
 * microphone. A take the service refuses for speech moves calmly to typing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { SPEECH_UNAVAILABLE, speakingOffered, speechRefused, startMode } from './speech.ts';

const LIVE = { token: 'a'.repeat(43), speechAvailable: true, offline: false } as const;

describe('speaking in the first run — F756', () => {
  test('speaking is offered in the first run only when the server says speech is available', () => {
    // The rule.
    assert.equal(speakingOffered(LIVE), true, 'a live practice the server opened for speech does not offer it');
    assert.equal(startMode(LIVE), 'spoken', 'speech the server opened is not the default');
    for (const [why, guest] of [
      ['the server said no', { ...LIVE, speechAvailable: false }],
      ['the server said nothing', { token: LIVE.token, offline: false }],
      ['the practice is offline', { ...LIVE, offline: true }],
      ['there is no guest capability', { ...LIVE, token: null }],
      ['there is no practice', null],
    ] as const) {
      assert.equal(speakingOffered(guest), false, `speaking is offered when ${why}`);
      assert.equal(startMode(guest), 'typed', `typing does not come first when ${why}`);
    }
    assert.equal(speechRefused(new Error(SPEECH_UNAVAILABLE)), true);
    for (const other of [new Error('unavailable'), new Error('limit'), new Error('expired'), 'speech-unavailable', null]) {
      assert.equal(speechRefused(other), false, `${String(other)} was read as the service refusing speech`);
    }

    // The service: a 503 from the audio path, and only that, is the refusal.
    const service = evidence('apps/mobile/src/onboarding/guestPractice.ts');
    assert.match(service, /response\.status === 503 && path === 'audio' \? SPEECH_UNAVAILABLE : 'unavailable'/, 'a refused take reads as a broken connection');
    assert.match(service, /speechAvailable: data\.speechAvailable === true/, 'the start no longer records the server\'s answer about speech');

    // The screen: the mode comes from the rule, Speak instead only on its yes,
    // and a refused take turns to typing with nothing to retry.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /setMode\(startMode\(next\)\);/, 'a fresh practice opens in a mode the server did not offer');
    assert.match(screen, /\{mode === 'typed' && speakingOffered\(guest\) \? \( <IconAction icon="microphone" label=\{FIRST_RUN_COPY\.speakInstead\}/, 'Speak instead is offered without the server\'s yes');
    assert.equal((screen.match(/setMode\('spoken'\)/g) ?? []).length, 1, 'something other than Speak instead turns the microphone on');
    const refused = screen.slice(screen.indexOf('if (speechRefused(error)) {'), screen.indexOf('setIssue( error instanceof Error && error.message === \'expired\''));
    assert.ok(refused.length > 0, 'a refused take is not told apart from a broken connection');
    assert.match(refused, /setMode\('typed'\);/);
    assert.match(refused, /speechAvailable: false/);
    assert.match(refused, /setIssue\(FIRST_RUN_COPY\.speechPaused\);/);
    assert.doesNotMatch(screen, /Start speaking|Speaking is unavailable right now|start\(true, /, 'the start sheet offers speaking before the server has said it is available');
    // The permission is still asked only on the tap that starts a take.
    assert.doesNotMatch(screen, /requestRecordingPermissions/);
    assert.match(evidence('apps/mobile/src/onboarding/GuestRecording.tsx'), /onPress=\{\(\) => void record\(\)/);
  });
});
