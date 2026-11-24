/**
 * The plan the first run builds (come alive, README Part 5.C rows 1 to 5):
 * the daily goal the learner taps, the personal plan and its edit sheet. Read
 * from source, because there is no renderer in this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';

describe('the personal plan and the daily goal', () => {
  test('the daily goal is only what the learner taps, and the questions draw no retired plan slots', () => {
    // Nothing selected until tapped, and no plan slots or chips on the questions.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /\[5, 10, 15, 20, 'none'\]/);
    assert.match(screen, /selected=\{draft\.minutes === minutes\}/);
    assert.match(screen, /onPress=\{\(\) => choose\(\{ minutes \}\)\}/, 'Choose each time is no longer an answer of its own');
    assert.match(screen, /<PersonalPlan draft=\{draft\}/);
    assert.doesNotMatch(screen, /<PlanCard|<Chip|<Label|<TokenFlight|useTokenFlight/, 'retired plan slots must not clutter the questions');
  });

  test('C names real minutes and interests without implying learning completion', () => {
    // 2026-10-21 UI-008, artboard B-OB-Plan: the answers moved onto the sun band as chips
    // (planChips.ts), drawn over the canvas map-route drawing.
    const plan = evidence('apps/mobile/src/onboarding/planChips.ts');
    assert.match(plan, /const minutes = minutesOf\(draft\)/);
    assert.match(plan, /minutes === 'none' \? 'Choose each time' : `\$\{minutes\} min a day`/);
    assert.match(plan, /\(draft\.interests \?\? \[\]\)\.map/);
    assert.match(evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'), /<BArt name="map-route"/);
    assert.match(evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'), /planChips\(draft\)\.map/);
    assert.match(evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'), /accessibilityLabel="Adjust my plan" onPress=\{\(\) => open\('plan'\)\}/);
    assert.doesNotMatch(plan, /<ProgressRing|mastery|fluency|numberOfLines/);
    const motion = evidence('apps/mobile/assets/bold-rhythm/source/plan/scene.rml');
    assert.match(motion, /loopValue="loop"/);
    const renderer = evidence('apps/mobile/src/onboarding/motion/BoldScene.native.tsx');
    assert.match(renderer, /C2Scene/);
    const c2 = evidence('apps/mobile/src/onboarding/motion/C2Scene.tsx');
    assert.match(c2, /c2MotionRuns\(\{ active, visible, foreground, reduced \}\)/);
  });

  test('plan editing commits all six answers so new interests reach the live scenario', () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const save = screen.slice(screen.indexOf('const sheetFooter ='), screen.indexOf(") : surface === 'start' ?"));
    // F917, 2026-10-29: the level goes through startLevelChange, which also clears a stale Skip ahead.
    assert.ok(save.includes('...startLevelChange(draftRef.current, edit.startLevel)'), 'Done must commit startLevel');
    for (const key of ['reason', 'minutes', 'speakingConfidence', 'practiceFocus']) {
      assert.ok(save.includes(`${key}: edit.${key}`), `Done must commit ${key}`);
    }
    assert.match(save, /interests: \[\.\.\.\(edit\.interests \?\? \[\]\)\]/);
  });

  test('the personal plan always reads its first authored practice rather than the latest attempt', () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const plan = evidence('apps/mobile/src/onboarding/PersonalPlan.tsx');
    assert.match(screen, /page === 'plan' && <PersonalPlan draft=\{draft\}/);
    assert.match(plan, /const plan = planFor\(draft\);/);
    // F916, 2026-10-29: the real first scene, and one deduplicated method pair.
    assert.match(plan, /firstConversationLines\(draft, \{ guestScene \}\)/);
    assert.match(plan, /\{plan\.method\}/);
    // 2026-10-21 UI-008, artboard B-OB-Plan: the goal is the band's first chip.
    assert.match(evidence('apps/mobile/src/onboarding/planChips.ts'), /BOLD_GOALS\.find\(g => g\.key === draft\.reason\)/);
    assert.doesNotMatch(plan, /startingSupport\(draft\)/, 'the support sentence is shown twice');
    assert.doesNotMatch(plan, /taskIndex|attempts|\btask\.(prompt|translation|title)\b/);
  });
});
