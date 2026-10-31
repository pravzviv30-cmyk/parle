import { evidence } from '../../test/evidence.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { drillSource } from '../testing/drillSource.ts';

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

test('conversation warm-up helper and recall handoff remain readable on a dark card', () => {
  const screen = read('./ConversationPracticeScreen.tsx');
  // 2026-10-21 UI-008: the foreground is the theme's text and muted tokens now, ink and soft ink in light as before.
  assert.match(screen, /style=\{\[type\.heading, \{ color: t\.text, marginVertical: space\(3\) \}\]\}>Try it without the choices\./,
    'the recall handoff must use the selected foreground, not React Native black');
  assert.match(screen, /style=\{\[type\.small, \{ color: t\.muted, marginTop: space\(3\) \}\]\}>\{reading \? 'The same meaning, without audio\.'/,
    'audio and quiet-reading helper text share the dark-card foreground');
});

test('French choice exercises do not give away meanings through visible or spoken option glosses', () => {
  // The choice kinds moved to drill/kinds/choose.tsx (drill-b T1); read the drill whole.
  const screen = drillSource();
  assert.doesNotMatch(screen, /gloss=\{(?:candidate|option).en\}/);
  assert.doesNotMatch(screen, /\{exercise.line.en\}/);
});

test("onboarding removes decorative chrome while retaining real progress and separate opt-ins without visible back controls", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /<OnboardingLayout/); assert.match(screen, /onboardingProgress\(/); assert.doesNotMatch(screen, /label="Back"|icon="back"/); assert.match(screen, /title="Share usage analytics"/); assert.match(screen, /title="Remember my learning"/); assert.doesNotMatch(screen, /<Chip|<Label|<ProgressDots|<TutorMark|mascot/i); });

test('a finished warm-up is recorded once as exposure, and a skip or the preview records nothing', () => {
  const screen = read('./ConversationPracticeScreen.tsx');
  // Raised only where the last listening round is answered.
  assert.equal((screen.match(/setWarmedUp\(true\)/g) ?? []).length, 1, 'the warm-up is marked complete from more than one place');
  const finished = screen.slice(screen.indexOf('if (round + 1 >= listening.length) {'), screen.indexOf("setStage('ready');", screen.indexOf('if (round + 1 >= listening.length) {')));
  assert.match(finished, /setWarmedUp\(true\)/, 'finishing the last round does not mark the warm-up complete');
  const skip = screen.slice(screen.indexOf('Skip warm-up and recall') - 200, screen.indexOf('Skip warm-up and recall') + 120);
  assert.doesNotMatch(skip, /setWarmedUp/, 'skipping the warm-up records it as completed');
  // Recorded through the store, once, never for the preview, and with no grade.
  const guard = 'if (!warmedUp || previewPack || !pack || !ownsNow() || warmupRecordedRef.current) return;';
  const start = screen.indexOf(guard);
  assert.notEqual(start, -1, 'the warm-up recording must require a completed warm-up, a real pack, its current account and a first write');
  const effect = screen.slice(start, screen.indexOf('useEffect(() => {', start));
  assert.match(effect, /warmupRecordedRef\.current = true;/);
  assert.match(effect, /recordWarmupCompleted\(\{ warmupId: warmupIdRef\.current, packId: pack\.id, at: Date\.now\(\) \}\)/);
  assert.match(screen, /mintPracticeId\(Date\.now\(\), 'w'\)/, 'the warm-up id is not a minted practice id');
  assert.doesNotMatch(screen, /gradeCards|recordActivity|recordPracticeEvent\(\{ kind: 'session-completed'/, 'the warm-up grades, earns XP or claims a practice sitting');
  assert.match(screen, /const visiblePack = ownerMatches \? pack : undefined/, 'an earlier account must not remain visible while effects reload');
});

// 2026-10-20, B3, B-Practice: Practice's three steps open the warm-up on the
// stage they name. Only "listen" is honoured from the route; anything else,
// a web address included, opens on matching, and recall stays a Drill sitting.
test('the warm-up opens on the stage Practice names, and nothing else opens past matching', () => {
  const screen = read('./ConversationPracticeScreen.tsx');
  assert.match(screen, /useState<'match' \| 'listen' \| 'ready'>\(initialStage\)/);
  assert.match(screen, /setStage\(initialStage\); setSelected\(null\);/, 'a reload keeps the previous run\'s stage');
  assert.match(screen, /initialStage\?: 'match' \| 'listen';/, 'the warm-up can open on recall, skipping the exposure it records');
  const navigator = read('../nav/RootNavigator.tsx');
  assert.match(navigator, /initialStage=\{route\.params\.stage === 'listen' \? 'listen' : 'match'\}/);
  assert.doesNotMatch(screen, /MainUI|useMainAppearance/, 'the ported screen still wears the appearance shims');
});
