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
    assert.match(toggle, /^const toggle = useCallback\(async \(\) => \{ if \(busyRef\.current \|\| !reference [^;]*?\) return; const mine = \{\}; busyRef\.current = mine; try \{/,
      'the guard is set before the first await of either path');
    assert.match(toggle, /\} finally \{ if \(busyRef\.current === mine\) \{ busyRef\.current = null; setStarting\(false\); \} \} \}, \[reference, phase/,
      'an early return or a throw must clear the guard, or the mic locks; an old take must not clear a new one');
    assert.equal(toggle.match(/await /g)?.length, toggle.slice(toggle.indexOf('try {')).match(/await /g)?.length,
      'an await runs before the guard is taken');
  });

  test('Hear it is quiet while the take is recording', () => {
    // F1146: the tutor's line played into the open mic is mixed into a scored take,
    // and the start path awaits permission, the mode and prepare while phase is still 'ready'.
    assert.match(flat, /const hearQuiet = shownPhase === 'recording' \|\| starting;/);
    assert.match(flat, /return; \} try \{ setStarting\(true\); if \(cleanupRef\.current\) await cleanupRef\.current;/,
      'the start window opens before its first await');
    const hear = flat.match(/<Pressable onPress=\{\(\) => \{ if \(ownsReadNow\(\)[\s\S]*?<\/Pressable>/)?.[0] ?? '';
    assert.match(hear, /onPress=\{\(\) => \{ if \(ownsReadNow\(\) && !hearQuiet\) tutorVoice\.speak\(shownReference\); \}\}/);
    assert.match(hear, /disabled=\{hearQuiet\}/);
    assert.match(hear, /accessibilityState=\{\{ disabled: hearQuiet \}\}/);
    // DESIGN.md: an icon control says off in colour rather than opacity.
    assert.doesNotMatch(hear, /opacity: 0\.5/);
    assert.match(hear, /hearQuiet && \{ backgroundColor: t\.skeleton \}/);
    assert.match(hear, /<EarGlyph size=\{16\} color=\{hearQuiet \? t\.muted : t\.text\} \/>/);
    assert.match(hear, /<Text style=\{\[type\.label, \{ color: hearQuiet \? t\.muted : t\.text \}\]\}>Hear it<\/Text>/);
  });

  test('a new read never finds the mic held by an old take', () => {
    // A retry or a new mission or learner restarts the read; a guard left by the old take would leave the mic dead.
    assert.match(flat, /const owner = \{ scope: scopeGeneration\(\), userId, missionId \};[^}]*?setPhase\('loading'\); busyRef\.current = null; setStarting\(false\); void Promise\.resolve\(\)\.then\(\(\) => loadSoundChecks/);
  });

  test('a self-guided tap while the take is stopping saves nothing more', () => {
    // F1328: inside the stop or the start window, toggle owns the take and saves it once.
    assert.match(flat, /const selfGuidedTap = useCallback\(\(\) => \{ if \(busyRef\.current\) return;/);
    assert.match(flat, /<IconAction layout="inline" icon="tick-circle" label="I said it without assessment" disabled=\{shownPhase === 'scoring'\} onPress=\{selfGuidedTap\} \/>/);
  });

  test('I said it without assessment during a take stops the mic and removes the take', () => {
    // F1329: choosing self-guided mid-take used to leave the recorder running, the mic held and the file on disk.
    const tap = flat.match(/const selfGuidedTap = useCallback\(\(\) => \{[\s\S]*?\}, \[/)?.[0] ?? '';
    assert.match(tap, /if \(phase === 'recording'\) \{ const abandoned = recorderUri\(recorder, preparedUri\.current\); preparedUri\.current = null; const work = abandonSoundCheckRecording\( recorder, stopRecorder, abandoned, discardRecording, resetRecordingAudio, \)\.finally\(\(\) => \{ if \(cleanupRef\.current === work\) cleanupRef\.current = null; \}\); cleanupRef\.current = work; \} selfGuided\(\);/,
      'the take is stopped, discarded and the mic released through the leave path');
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
