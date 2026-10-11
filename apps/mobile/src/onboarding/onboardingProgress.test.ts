import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingProgress, onboardingSteps } from './onboardingProgress.ts';

describe('onboarding progress from actual conditional routes', () => {
  test('every route increases without reaching completion early', () => {
    const steps = onboardingSteps();
    let last = 0;
    for (const page of steps) {
      const value = onboardingProgress({ page });
      assert.ok(value.fraction > last);
      assert.ok(value.fraction < 1);
      assert.equal(value.total, steps.length);
      assert.equal(value.step, steps.indexOf(page) + 1);
      last = value.fraction;
    }
    assert.equal(onboardingProgress({ page: 'account-welcome', complete: true }).fraction, 1);
  });
  test('the shorter variant and signed-in route omit their real conditional steps', () => {
    const steps = onboardingSteps({ five: true, signedIn: true });
    assert.ok(!steps.includes('start-level'));
    assert.ok(!steps.includes('account'));
    assert.ok(!steps.includes('account-welcome'));
    assert.equal(steps.at(-1), 'keep');
    const tutor = onboardingProgress({ page: 'choose-tutor', five: true, signedIn: true });
    assert.equal(tutor.step, steps.indexOf('choose-tutor') + 1);
    assert.equal(tutor.total, steps.length);
  });
  test('skipped routes are removed, not credited as completed work', () => {
    const skipped = ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'remind'];
    const steps = onboardingSteps({ skipped });
    const plan = onboardingProgress({ page: 'plan', skipped });
    assert.equal(plan.step, 2);
    assert.equal(plan.fraction, 1.5 / steps.length);
    assert.ok(!steps.includes('remind'));
  });
  test('invalid skip lists cannot remove required routes or the completion handoff', () => {
    const skipped = [...onboardingSteps(), 'unknown'];
    const steps = onboardingSteps({ skipped });
    for (const required of ['hear-it', 'plan', 'choose-tutor', 'practice', 'recap', 'keep', 'account', 'account-welcome']) assert.ok(steps.includes(required));
    const value = onboardingProgress({ page: 'account-welcome', skipped });
    assert.ok(Number.isFinite(value.fraction));
    assert.ok(value.fraction < 1);
    assert.equal(value.step, value.total);
    assert.equal(onboardingSteps({ signedIn: true, skipped }).at(-1), 'keep');
  });
  test('reopening restores progress from the saved route and route history', () => {
    const saved = { page: 'choose-tutor', five: true, completed: ['hear-it', 'reason', 'interests', 'confidence', 'focus', 'time', 'plan'] };
    assert.deepEqual(onboardingProgress(saved), onboardingProgress(JSON.parse(JSON.stringify(saved))));
    const beforeBack = onboardingProgress({ ...saved, page: 'practice', completed: [...saved.completed, 'choose-tutor'] });
    const back = onboardingProgress({ ...saved, page: 'plan', completed: [...saved.completed, 'choose-tutor'] });
    assert.ok(back.fraction >= (beforeBack.fraction - 0.5 / back.total));
    assert.equal(back.step, 7);
  });
  test('signup, a repeated guest exchange, and retired pages have stable mappings', () => {
    assert.deepEqual(onboardingProgress({ page: 'signup' }), onboardingProgress({ page: 'account' }));
    assert.deepEqual(onboardingProgress({ page: 'frequency' }), onboardingProgress({ page: 'time' }));
    assert.deepEqual(onboardingProgress({ page: 'home' }), onboardingProgress({ page: 'keep' }));
    assert.deepEqual(onboardingProgress({ page: 'first-line' }), onboardingProgress({ page: 'hear-it' }));
    assert.equal(onboardingProgress({ page: 'practice' }).step, 10);
  });
  test('legacy repair uses the same mapping with its actual four routes', () => {
    const steps = onboardingSteps({ repair: true });
    assert.deepEqual(steps, ['age', 'name', 'meet', 'voice']);
    assert.deepEqual(onboardingProgress({ page: 'voice', repair: true }), { fraction: 0.875, step: 4, total: 4, complete: false });
  });
});
