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
    assert.match(header, /width: HIT,[\s\S]{0,80}height: HIT/, 'the end control is smaller than the shared 44pt floor');
    assert.match(header, /borderRadius: radius\.control/, 'the end control must share the Atelier control shape');
    assert.match(header, /borderWidth: HAIRLINE/, 'the end control lost its quiet outline');
    assert.match(header, /backgroundColor: paper\.card/, 'the resting control is not on the porcelain/card palette');
    assert.match(header, /endPressed:[\s\S]{0,140}borderColor: accent\.primary/, 'pressing the icon gives no violet feedback');
    assert.match(header, /endPressed:[\s\S]{0,180}backgroundColor: paper\.groundDeep/, 'pressed feedback depends on opacity alone');
    assert.doesNotMatch(header, /\bAnimated\b|opacity:/, 'the header adds motion or opacity-only feedback to a simple exit');
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
