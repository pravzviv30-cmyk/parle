import { evidence } from '../../test/evidence.ts';
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

test("onboarding removes decorative chrome while retaining progress, back and separate opt-ins", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /<SetupProgress/); assert.match(screen, /label="Back"/); assert.match(screen, /title="Optional usage data"/); assert.match(screen, /title="Remember my learning"/); assert.doesNotMatch(screen, /<Chip|<Label|<ProgressDots|<TutorMark|mascot/i); });

test('a finished warm-up is recorded once as exposure, and a skip or the preview records nothing', () => {
  const screen = read('./ConversationPracticeScreen.tsx');
  // Raised only where the last listening round is answered.
  assert.equal((screen.match(/setWarmedUp\(true\)/g) ?? []).length, 1, 'the warm-up is marked complete from more than one place');
  const finished = screen.slice(screen.indexOf('if (round + 1 >= listening.length) {'), screen.indexOf("setStage('ready');", screen.indexOf('if (round + 1 >= listening.length) {')));
  assert.match(finished, /setWarmedUp\(true\)/, 'finishing the last round does not mark the warm-up complete');
  const skip = screen.slice(screen.indexOf('Skip warm-up and recall') - 200, screen.indexOf('Skip warm-up and recall') + 120);
  assert.doesNotMatch(skip, /setWarmedUp/, 'skipping the warm-up records it as completed');
  // Recorded through the store, once, never for the preview, and with no grade.
  const effect = screen.slice(screen.indexOf('if (!warmedUp || previewPack || !pack || warmupRecordedRef.current) return;'));
  assert.ok(effect.length > 0, 'the warm-up recording is not guarded against the preview, a re-render, or a missing pack');
  assert.match(effect, /warmupRecordedRef\.current = true;/);
  assert.match(effect, /recordWarmupCompleted\(\{ warmupId: warmupIdRef\.current, packId: pack\.id, at: Date\.now\(\) \}\)/);
  assert.match(screen, /mintPracticeId\(Date\.now\(\), 'w'\)/, 'the warm-up id is not a minted practice id');
  assert.doesNotMatch(screen, /gradeCards|recordActivity|recordPracticeEvent\(\{ kind: 'session-completed'/, 'the warm-up grades, earns XP or claims a practice sitting');
});
