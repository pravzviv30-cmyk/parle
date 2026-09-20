import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('recognition feedback uses the two-miss policy and resets it for each listening round', () => {
  const screen = read('./ConversationPracticeScreen.tsx');
  assert.match(screen, /checkRecognition\(attempt, choice === current.correctIndex\)/);
  assert.match(screen, /checkRecognition\(pairAttempts\[selected\] \?\? NEW_ATTEMPT/);
  assert.match(screen, /if \(choice === null\) return/);
  assert.match(screen, /if \(next.outcome === 'retry'\) setChoice\(null\)/);
  assert.match(screen, /setAttempt\(NEW_ATTEMPT\)/);
  assert.match(screen, /attempt.outcome === 'revealed' \? `The meaning is:/);
  assert.doesNotMatch(screen, /title="From your conversation"/);
  assert.match(screen, /<Label>\{pack.title.en\}<\/Label>/);
});

test('French choice exercises do not give away meanings through visible or spoken option glosses', () => {
  const screen = read('../DrillScreen.tsx');
  assert.doesNotMatch(screen, /gloss=\{(?:candidate|option).en\}/);
  assert.doesNotMatch(screen, /\{exercise.line.en\}/);
});

test('onboarding removes decorative chrome but retains progress, back navigation and consent', () => {
  const pre = read('../onboarding/PreAccountOnboarding.tsx');
  assert.doesNotMatch(pre, /A little French, every day|chapterNumber/);
  assert.match(pre, /<ProgressDots/);
  assert.match(pre, /CONSENT_ROW/);
  for (const file of ['SignUpScreen', 'SignInScreen']) {
    const auth = read(`../auth/${file}.tsx`);
    assert.match(auth, /<ScreenHeader title=\{false\} divider=\{false\} back=/);
    assert.doesNotMatch(auth, /Le début de votre histoire/);
  }
});
