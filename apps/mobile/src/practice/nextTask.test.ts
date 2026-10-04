import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTaskKind } from './nextTask.ts';
import { localPracticeFor } from './localPractice.ts';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';
import { readFileSync } from 'node:fs';
test('unfinished personal practice wins even when the live trial is used or the network is down', () => {
  assert.equal(nextTaskKind({ kind: 'resume', source: null }, false, null), 'practice');
  assert.equal(nextTaskKind({ kind: 'resume', source: null }, true, { plan: 'trial', reason: 'exhausted' }), 'practice');
});
test('no personal material leads to a scene, a truthful allowance gate or genuine offline practice', () => {
  const none = { kind: 'none', fallback: 'first' } as const;
  assert.equal(nextTaskKind(none, true, null), 'scene');
  assert.equal(nextTaskKind(none, false, null), 'local');
  assert.equal(nextTaskKind(none, true, { plan: 'trial', reason: 'exhausted' }), 'plans');
  assert.equal(nextTaskKind(none, true, { plan: 'trial', reason: null }), 'scene');
});
test('legacy authored review stays useful offline and before an exhausted trial gate, without replacing a resumable sitting', () => {
  const none = { kind: 'none', fallback: 'first' } as const;
  assert.equal(nextTaskKind(none, false, null, true), 'review');
  assert.equal(nextTaskKind(none, true, { plan: 'trial', reason: 'exhausted' }, true), 'review');
  assert.equal(nextTaskKind({ kind: 'resume', source: null }, false, null, true), 'practice');
  const source = readFileSync(new URL('./NextTaskCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /value.scope === scopeGeneration\(\)\) nav.navigate/);
  assert.match(source, /review: dueCards\(deck, now\)\[0\] \?\? null/);
  assert.match(source, /FrenchBlock french=\{value.review.front\} \/>/);
  assert.doesNotMatch(source, /english=\{value.review.back\}/, 'the review preview must not expose the hidden meaning before recall');
});
test('every chosen tutor has the same real bundled coffee line for offline practice', () => {
  const source = readFileSync(new URL('../daily/tutorAudioManifest.ts', import.meta.url), 'utf8');
  for (const voice of TUTOR_VOICE_OPTIONS) {
    const group = [...source.matchAll(/  (\w+): \{\n([\s\S]*?)\n  \},/g)].find(row => row[1] === voice.value);
    assert.ok(group, voice.value);
    const row = [...group[2]!.matchAll(/"([^"]+)": require\('\.\.\/\.\.\/assets\/daily-tutors\/([^']+)'\)/g)].find(row => row[1] === DEMO_REPLY_ID);
    assert.ok(row, `missing bundled café recording for ${voice.value}`);
    const bytes = readFileSync(new URL(`../../assets/daily-tutors/${row[2]}`, import.meta.url));
    assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
    const phrase = localPracticeFor(voice.value, DAILY_ITEMS, { [voice.value]: { [DEMO_REPLY_ID]: 1 } }); assert.ok(phrase, voice.value);
    assert.match(phrase.fr, /café/); assert.match(phrase.en, /coffee/);
    assert.equal(localPracticeFor(voice.value, DAILY_ITEMS, {}), null);
  }
});
test('production navigation cannot mount simulated speech or bank a fabricated lesson', () => {
  const source = readFileSync(new URL('../nav/RootNavigator.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import \{ SessionScreen \}|<SessionScreen|mockObservations/);
  assert.match(source, /if \(!live \|\| user === null\) return[\s\S]*?<LocalPracticeCard/);
  assert.match(source, /if \(user === null \|\| !ownsLesson\(\)\) return/);
  assert.match(source, /textMode=\{textMode\}/);
});

test('the local practice puts the real French and assessment limit before recording and decoration', () => {
  const source = readFileSync(new URL('../daily/DailyPracticeScreen.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('{item.fr}</Text>') < source.indexOf('<Illustration'));
  assert.ok(source.indexOf('Nothing is graded.') < source.indexOf('Record my take'));
  assert.match(source, /Your take is deleted when you leave/);
});
