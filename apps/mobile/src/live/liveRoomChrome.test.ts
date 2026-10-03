/**
 * The live room should feel like a conversation, not a progress dashboard.
 *
 * These are source-contract tests because the mobile suite deliberately has no
 * React Native renderer. They hold the visual chrome at the same seams the
 * safe-area and connection-line tests already inspect.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const convo = read('../ConvoScreen.tsx');
const lesson = read('../SessionView.tsx');
const liveLesson = read('../LiveSessionScreen.tsx');
const header = read('./LiveRoomHeader.tsx');

describe('quiet live-room chrome', () => {
  test('neither live surface draws the old progress rail', () => {
    assert.doesNotMatch(convo, /\bStationLine\b/, 'the free conversation still draws the stray top rail');
    assert.doesNotMatch(lesson, /\bStationLine\b/, 'the guided lesson still draws the stray top rail');
  });

  test('both rooms use the compact end control and retain confirmation', () => {
    assert.equal(
      (convo.match(/<LiveRoomHeader\b/g) ?? []).length,
      2,
      'the choosing room and the active scene do not share the same end control',
    );
    assert.match(convo, /accessibilityLabel="End conversation"/, 'the icon has no spoken conversation label');
    assert.match(lesson, /<LiveRoomHeader[\s\S]{0,160}accessibilityLabel="End lesson"/, 'the lesson has no named end control');
    assert.match(convo, /onEnd=\{\(\) => setConfirming\(true\)\}/, 'the conversation icon bypasses confirmation');
    assert.match(liveLesson, /onLeave=\{\(\) => setConfirming\(true\)\}/, 'the lesson icon bypasses confirmation');
    assert.match(convo, /<ConfirmSheet\b/, 'the conversation lost its confirmation sheet');
    assert.match(liveLesson, /<ConfirmSheet\b/, 'the lesson lost its confirmation sheet');
  });

  test('the outlined circle has a 44pt target and visible, motion-free press feedback', () => {
    assert.match(header, /<RoundButton kind="close"/, 'the exit is not the shared round button');
    const parts = read('../components.tsx');
    const round = parts.slice(parts.indexOf('export function RoundButton'), parts.indexOf('export function ColourCard'));
    assert.match(round, /next \? HIT \+ space\(5\) : HIT/, 'the close disc is below the shared touch floor');
    assert.match(round, /borderRadius: disc \/ 2/, 'the exit is not round');
    assert.match(round, /<Press haptic="light"/, 'the exit loses the shared press feedback');
    assert.match(round, /paper\.card/, 'the resting disc is not white');
    assert.doesNotMatch(header, /\bAnimated\b|opacity:/, 'the header adds an independent animation');
    assert.match(header, /accessibilityHint="Opens a confirmation before ending the session"/, 'the icon does not explain its safe two-step exit');
  });

  test('conversation controls and status announcements survive the chrome change', () => {
    for (const seam of [
      '<Transcript',
      'Type instead',
      'live.sendHelp()',
      'live.sendSlower()',
      'live.sendHear',
      '<SupportBlock',
    ]) {
      assert.ok(convo.includes(seam), `${seam} disappeared while the header changed`);
    }
    assert.match(convo, /status=\{[\s\S]{0,220}accessibilityLiveRegion="polite"/, 'conversation status is no longer announced');
    assert.match(lesson, /status=\{[\s\S]{0,220}accessibilityLiveRegion="polite"/, 'lesson status is no longer announced');
  });
});
