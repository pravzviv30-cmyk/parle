import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const driver = read('../SessionScreen.tsx');
const routes = read('../nav/RootNavigator.tsx');

test('offline lessons preserve the chosen text mode', () => {
  assert.match(routes, /textMode=\{textMode\}/);
  assert.doesNotMatch(routes, /<SessionScreen|import \{ SessionScreen \}/);
  assert.match(routes, /if \(!live \|\| user === null\) return/);
  assert.match(routes, /<LocalPracticeCard/);
  assert.match(driver, /onType=\{textMode \? speak : undefined\}/);
  assert.match(driver, /if \(textMode\) \{\s*tutorVoice\.stop\(\);\s*setPhase\('awaiting'\);\s*return;/);
});

test('offline typing has no silence pressure, sound controls or fabricated pronunciation result', () => {
  assert.match(driver, /if \(textMode \|\| phase !== 'awaiting' \|\| session.finished\) return/);
  assert.match(driver, /phonemes: textMode \? \[\] : mockObservations/);
  assert.match(driver, /durationSec: textMode \? 0 : estimateDurationSec/);
  assert.match(driver, /const onHearLine = !textMode &&/);
  assert.match(driver, /const onOptionHear = !textMode &&/);
  assert.match(driver, /Offline typed practice · No audio or microphone/);
});

test('a failed rehearsal plan check can retry without clearing the draft', () => {
  const screen = read('./RealMomentScreen.tsx');
  assert.match(screen, /label="Check my plan again" onPress=\{\(\) => setPlanAttempt/);
  assert.match(screen, /\[user, planAttempt, momentsAttempt\]/);
  assert.match(screen, /if \(cancelled\) return;/);
});
