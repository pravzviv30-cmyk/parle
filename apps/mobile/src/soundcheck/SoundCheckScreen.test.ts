/** The sound-check screen's account and unread-state wiring, without a native renderer. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const source = readFileSync(fileURLToPath(new URL('./SoundCheckScreen.tsx', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const flat = source.replace(/\s+/g, ' ');

describe('the owned sound-check read', () => {
  test('corrupt evidence stays unknown with retry while the authored line remains available', () => {
    assert.match(flat, /loadSoundChecks\(\{ strict: true \}\)/);
    assert.match(flat, /setReference\(mission\?\.referencePhrases\[0\] \?\? null\); setPhase\('unread'\)/,
      'a failed read must not rotate from an invented empty history');
    assert.match(flat, /shownPhase === 'unread' \? \( <Card[\s\S]*?Retry sound checks/);
    assert.match(flat, /shownReference \? \( <Card tone="journal"[\s\S]*?tutorVoice\.speak\(shownReference\)/,
      'the local reference cannot be heard while evidence is unread');
    assert.match(flat, /shownPhase === 'unread' \? \([\s\S]*?\) : shownPhase === 'loading' \? \([\s\S]*?\) : shownPhase === 'result'/,
      'an unread check still offers the assessment controls');
    assert.match(flat, /phase === 'loading' \|\| phase === 'unread'\) return;/,
      'a stale tap can record or score before the evidence read succeeds');
  });

  test('old-account results, recording handlers and measured facts are fenced before render or reuse', () => {
    assert.match(flat, /readOwner\.scope === scopeGeneration\(\) && readOwner\.userId === userId && readOwner\.userId === activeUserId\(\) && readOwner\.missionId === missionId/);
    assert.match(flat, /const shownPhase = ownerMatches \? phase : 'loading'/);
    assert.match(flat, /const shownReference = ownerMatches \? reference : null/);
    assert.match(flat, /const shownAcoustic = ownerMatches \? acoustic : null/);
    assert.match(flat, /const shownResult = ownerMatches \? result : null/);
    assert.match(flat, /if \(!sameAccount\(\)\) return; setReference\(mission \? nextSoundCheckReference\(mission, evidence\) : null\); setAcoustic\(acousticFor\(headSound\(evidence\)\)\)/);
    assert.match(flat, /if \(!mission \|\| !reference \|\| !ownsReadNow\(\)\) return;/,
      'an old owner can persist a new check');
    assert.match(flat, /const score = await consumeRecording\([\s\S]*?if \(!ownsReadNow\(\)\) return;/,
      'a finished score can attach to a different learner');
  });

  test('leaving during a recording runs the cached-URI cleanup even if native stop is released', () => {
    assert.match(flat, /const abandoned = recorderUri\(recorder, preparedUri\.current\); preparedUri\.current = null; const work = abandonSoundCheckRecording\( recorder, stopRecorder, abandoned, discardRecording/);
    assert.match(flat, /const work = \(async \(\) => \{ await recorder\.stop\(\); \}\)\(\)\.finally/,
      'synchronous native stop throws must become rejected promises');
    assert.match(flat, /if \(cleanupRef\.current\) await cleanupRef\.current;/,
      'a new recording can race the previous account’s cleanup');
  });
});

describe('one take, one score, and only the learner on the mic', () => {
  test('a second tap while the take is stopping scores and saves it once', () => {
    // F1144: `phase` only moves after the awaited stop, so without a guard a
    // second tap reads the same recorder.uri, uploads it and persists it again.
    const toggle = flat.match(/const toggle = useCallback\(async \(\) => \{[\s\S]*?\}, \[reference, phase/)?.[0] ?? '';
    assert.match(toggle, /^const toggle = useCallback\(async \(\) => \{ if \(busyRef\.current \|\| !reference [^;]*?\) return; busyRef\.current = true; try \{/,
      'the guard is set before the first await of either path');
    assert.match(toggle, /\} finally \{ busyRef\.current = false; \} \}, \[reference, phase/,
      'an early return or a throw must clear the guard, or the mic locks');
    assert.equal(toggle.match(/await /g)?.length, toggle.slice(toggle.indexOf('try {')).match(/await /g)?.length,
      'an await runs before the guard is taken');
  });

  test('Hear it is quiet while the take is recording', () => {
    // F1146: the tutor's line played into the open mic is mixed into a scored take.
    const hear = flat.match(/<Pressable onPress=\{\(\) => \{ if \(ownsReadNow\(\)[\s\S]*?<\/Pressable>/)?.[0] ?? '';
    assert.match(hear, /onPress=\{\(\) => \{ if \(ownsReadNow\(\) && shownPhase !== 'recording'\) tutorVoice\.speak\(shownReference\); \}\}/);
    assert.match(hear, /disabled=\{shownPhase === 'recording'\}/);
    assert.match(hear, /accessibilityState=\{\{ disabled: shownPhase === 'recording' \}\}/);
    assert.match(hear, /shownPhase === 'recording' && \{ opacity: 0\.5 \}/);
  });

  test("the sound check's hear control is named by the word it shows", () => {
    // F951 rule: Voice Control finds a control by its visible words.
    const hear = flat.match(/<Pressable onPress=\{\(\) => \{ if \(ownsReadNow\(\)[\s\S]*?<\/Pressable>/)?.[0] ?? '';
    const label = hear.match(/accessibilityLabel="([^"]*)"/)?.[1];
    const shown = hear.match(/<Text [^>]*>([^<]*)<\/Text>/)?.[1];
    assert.equal(shown, 'Hear it');
    assert.equal(label, shown);
  });
});
