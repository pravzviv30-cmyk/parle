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
  assert.match(source, /offer: reviewOffer\(deck, now\)/);
  assert.match(source, /const review = offeredReview\(value\.offer, locks\.access\('conversationPractice'\)\)/, 'Home must offer only what Review deals a free learner');
  assert.match(source, /nextTaskKind\([^)]*review !== null\)/);
  assert.match(source, /FrenchBlock french=\{review\.front\} \/>/);
  assert.doesNotMatch(source, /english=\{(?:value\.)?review\.back\}/, 'the review preview must not expose the hidden meaning before recall');
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
test("the review door reads the load's now, not a fresh clock", () => {
  const source = readFileSync(new URL('./NextTaskCard.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  // Two clock reads: one in the load, which the door reads; the held words
  // describe billing, read apart from the load, so they read the render clock.
  assert.equal(source.match(/Date\.now\(\)/g)?.length, 2, 'NextTaskCard reads the clock somewhere new');
  assert.match(source, /setValue\(\{ scope, now, /);
  assert.match(source, /reviewRow\(value\.deck, value\.now, /);
  assert.match(source, /heldWords\(billing, Date\.now\(\)\)/);
  assert.doesNotMatch(source, /reviewRow\([^)]*Date\.now\(\)/, 'the review door reads a fresh clock');
});
test('F961: coming back to Home keeps the held billing answer, so the hero does not flash to loading', () => {
  const source = readFileSync(new URL('./NextTaskCard.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(source, /setBillingAnswered\(false\)|setBilling\(null\)/, 'every focus puts the billing read back to unanswered');
  assert.match(source, /setBillingRead\(held => held !== null && held\.scope === scope && held\.live === reads \? held :/);
  assert.match(source, /const reads = live && user !== null;/, 'the offline answer must not be held once the learner is online');
  // fetchBillingStatus never rejects: a failure resolves null, which must not wipe the held billing.
  assert.match(source, /fetchBillingStatus\(user\.id\)\.then\(result => \{[^}]*setBillingRead\(held => \(\{ scope, live: reads, billing: result \?\? \(held !== null \? held\.billing : null\), answered: true \}\)\)/);
  assert.doesNotMatch(source, /fetchBillingStatus\(user\.id\)\.catch/, 'fetchBillingStatus never rejects, so a catch is dead code');
  assert.doesNotMatch(source, /\.then\(result => \{[^}]*setBillingRead\(\{ scope, live: reads, billing: result,/, 'a null result must not overwrite the held billing');
  const loading = source.match(/<Text style=\{[^}]*\}[^>]*>Finding your next task…<\/Text>|<Text style=\{[^>]*\]\}>Finding your next task…<\/Text>|<Text style=\{type\.small\}>Finding your next task…<\/Text>/g) ?? [];
  assert.equal(loading.length, 2);
  for (const text of loading) assert.equal(text, '<Text style={[type.small, { color: t.text }]}>Finding your next task…</Text>');
});
