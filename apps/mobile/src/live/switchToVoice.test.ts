/**
 * Speak in a room that started typed (F903, founder decision 2026-10-28).
 *
 * A typed session has no speech pipeline: its mode is signed into the token
 * and the agent built no audio, so it cannot be upgraded in place. Speak asks
 * first, keeps the typed part (recap requested and banked, never shown), then
 * releases the lease and rebuilds the session as voice.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SWITCH_WAIT, leaveDuringSwitch, switchAfterStop, switchToVoiceCopy, switchToVoicePlan } from './switchToVoice.ts';
import { canResumeSpeaking } from './c2TranscriptPolicy.ts';
import { LEAVE_RECAP_WAIT_MS } from './leaveKeepingWork.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Speak in a typed start — F903', () => {
  test('Speak in a room that started typed switches the session to voice', () => {
    // The control is live in a typed start once the room is ready.
    assert.equal(canResumeSpeaking(false, true, false), true, 'Speak is still inert in a typed start');
    assert.equal(canResumeSpeaking(false, false, false), false);
    assert.equal(canResumeSpeaking(false, true, true), false);

    // It asks first, in the tutor's own name.
    const copy = switchToVoiceCopy('Céline');
    assert.deepEqual(copy, { title: 'Switch to speaking?', body: 'Céline starts this scene again with your voice.', stay: 'Stay', confirm: 'Switch' });
    for (const line of Object.values(copy)) assert.doesNotMatch(line, /—|\d/);
    assert.doesNotMatch(SWITCH_WAIT.headline + SWITCH_WAIT.note, /—|\d/);

    // With a reply the typed part is kept first; with none it just rebuilds; a stop never switches.
    assert.equal(switchToVoicePlan({ learnerReplies: 2, stopped: false }), 'keep-then-rebuild');
    assert.equal(switchToVoicePlan({ learnerReplies: 0, stopped: false }), 'rebuild');
    assert.equal(switchToVoicePlan({ learnerReplies: 2, stopped: true }), 'none');

    const screen = read('../ConvoScreen.tsx');
    // Speak in a typed start opens the sheet instead of doing nothing.
    assert.match(screen, /else if \(openedTyped\) setSwitchAsking\(true\);/);
    assert.match(screen, /switchToVoiceCopy\(tutorName\)/);
    // Keep: the recap is requested on the open room, and the wait shows instead of the end card.
    
    assert.match(screen, /if \(switching !== null\) \{\s*return <RoomWait/);
    assert.ok(screen.indexOf('if (switching !== null)') < screen.indexOf('if (live.recap) {'), 'the end card shows before the switch');
    // The rebuild releases the lease first (F201), then flips the mode once.
    assert.match(screen, /void live\.leave\(\)\.finally\(\(\) => \{[\s\S]{0,400}setOpenedTyped\(false\);/);
    // The typed part is not a sitting of its own: its replies carry into the voice
    // room and the one clock keeps running, so the scene settles once, at its end.
    assert.match(screen, /carriedRepliesRef\.current \+= live\.sceneReplies;/);
    const rebuild = screen.slice(screen.indexOf('const rebuildAsVoice = () => {'), screen.indexOf('const switchRebuild'));
    assert.doesNotMatch(rebuild, /clock\.reset\(\)|openedAtRef\.current = null/, 'the switch restarted the clock, so the typed minutes are lost');
    assert.match(screen, /switchingRef\.current = true; setSwitching\('waiting'\); live\.requestRecap\(\);/);
    assert.equal((screen.match(/setOpenedTyped\(false\)/g) ?? []).length, 1);
    assert.match(screen, /setTimeout\(\(\) => switchRebuild\.current\(\), LEAVE_RECAP_WAIT_MS\)/);
    assert.ok(LEAVE_RECAP_WAIT_MS <= 8_000);
    // The new voice room opens the microphone: Speak was the learner agreeing to be heard.
    assert.match(screen, /setMicWanted\(true\); micOnReadyAsked\.current = false;/);
    // The hook forgets the last session's recap and practice on a rebuild.
    const hook = read('./useLiveSession.ts');
    assert.match(hook, /setRecap\(null\);\s*setSceneReplies\(0\);\s*setPractice\(null\);\s*setDrills\(null\);/);
  });

  test('a safety stop during the switch cancels it and starts no voice session', () => {
    assert.equal(switchAfterStop({ switching: 'waiting', stopped: true }), 'cancel');
    assert.equal(switchAfterStop({ switching: 'rebuilding', stopped: true }), 'cancel');
    assert.equal(switchAfterStop({ switching: 'waiting', stopped: false }), 'carry-on');
    assert.equal(switchAfterStop({ switching: null, stopped: true }), 'carry-on');
    const screen = read('../ConvoScreen.tsx');
    // The stop cancels a switch in flight, and neither the timer, the recap nor the leave's end can rebuild after it.
    assert.match(screen, /if \(switchAfterStop\(\{ switching, stopped \}\) === 'cancel'\) \{ switchingRef\.current = false; setSwitching\(null\); \}/);
    const rebuild = screen.slice(screen.indexOf('const rebuildAsVoice = () => {'), screen.indexOf('const switchRebuild'));
    assert.match(rebuild, /^const rebuildAsVoice = \(\) => \{\s*if \(stopped \|\| stoppedRef\.current\) return;/);
    assert.match(rebuild, /\.finally\(\(\) => \{\s*if \(stoppedRef\.current\) return;/, 'a stop that lands during the teardown still rebuilds');
    // The stop screen comes before the switch's wait.
    assert.ok(screen.indexOf("if (safety.kind === 'stop')") < screen.indexOf('if (switching !== null) {'));
  });

  test("leaving while switching still keeps the typed part's minutes", () => {
    // Waiting for the typed recap: Leave becomes the F905 leave, so the recap settles as the scene's end.
    assert.equal(leaveDuringSwitch('waiting'), 'wait-for-recap');
    // The recap already came and was kept as a switch (not settled): settle the minutes locally, then go.
    assert.equal(leaveDuringSwitch('rebuilding'), 'settle-locally');
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /onLeave=\{leaveFromSwitch\}/);
    assert.match(screen, /if \(leaveDuringSwitch\(switching\) === 'wait-for-recap'\) \{ switchingRef\.current = false; setSwitching\(null\); setLeaveWaiting\(true\); setFinishing\(true\); \}/);
    assert.match(screen, /else \{ switchingRef\.current = false; leaveTimedOut\(\); \}/);
  });
});
