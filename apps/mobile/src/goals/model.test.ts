/**
 * The goal-step record, held to its contract (Stage 4, 2026-09-25).
 *
 * Contract tests 1 to 3: the validator refuses every shape a sentence could
 * ride in on, the merge is commutative, idempotent and associative (including
 * the two-differing-copies case a per-key pick gets wrong), and the cap keeps
 * the newest sixty in one total order whatever order the rows arrive in.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { stableStringify } from '../sync/envelope.ts';
import { factKey } from '../profile/memory.ts';
import {
  GOAL_STEPS_VERSION,
  MAX_GOAL_STEPS,
  isGoalStepEvent,
  mergeGoalSteps,
  readGoalSteps,
  uniqueGoalSteps,
  type GoalStepEvent,
} from './model.ts';

const SESSION = '3f1c2a9e-6b1d-4a0e-9c55-1f2e3d4c5b6a';
const GOAL = factKey('Order a coffee in Paris');

const started = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  kind: 'step-started',
  id: SESSION,
  at: 1_700_000_000_000,
  goalKey: GOAL,
  task: 'mission:cafe',
  ...over,
});

const used = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  kind: 'used-outside',
  id: `u.${SESSION}`,
  at: 1_700_000_100_000,
  goalKey: GOAL,
  ...over,
});

describe('the goal-step validator — contract test 1', () => {
  test('accepts the two shapes and nothing near them', () => {
    assert.equal(isGoalStepEvent(started()), true, 'a step-started row was refused');
    assert.equal(isGoalStepEvent(used()), true, 'a used-outside row was refused');
    // Every task family a later build may write survives, even though this
    // build only writes missions.
    assert.equal(isGoalStepEvent(started({ task: 'situation:scene-market' })), true);
    assert.equal(isGoalStepEvent(started({ task: 'moment:interview:m1' })), true);
    assert.equal(isGoalStepEvent(started({ task: 'mission:a-mission-no-build-knows' })), true, 'a newer build\'s mission was refused');
  });

  test('refuses an extra key, a sentence in the task, and a key that factKey did not make', () => {
    assert.equal(isGoalStepEvent({ ...started(), note: 'x' }), false, 'an extra key rode along');
    assert.equal(isGoalStepEvent({ ...used(), task: 'mission:cafe' }), false, 'a used-outside row carried a task');
    assert.equal(isGoalStepEvent(started({ task: 'mission:order a coffee' })), false, 'a task with a space was accepted');
    assert.equal(isGoalStepEvent(started({ task: 'lesson:cafe' })), false, 'an unknown task family was accepted');
    assert.equal(isGoalStepEvent(started({ task: 'mission:' })), false, 'an empty task id was accepted');
    assert.equal(isGoalStepEvent(started({ goalKey: 'Order a coffee' })), false, 'a goal key that is not its own factKey was accepted');
    assert.equal(isGoalStepEvent(started({ goalKey: '' })), false, 'an empty goal key was accepted');
    assert.equal(isGoalStepEvent(started({ goalKey: 'a'.repeat(121) })), false, 'a goal key over 120 characters was accepted');
    assert.equal(isGoalStepEvent(started({ goalKey: 'a'.repeat(120) })), true, 'a goal key at the ceiling was refused');
  });

  test('refuses an id that is not a pack id, an unprefixed used-outside id, and a bad time', () => {
    assert.equal(isGoalStepEvent(started({ id: 'not a pack id' })), false, 'a step id with a space was accepted');
    assert.equal(isGoalStepEvent(started({ id: 'u.' + SESSION })), false, 'a step id that is not a pack id was accepted');
    assert.equal(isGoalStepEvent(used({ id: SESSION })), false, 'a used-outside id without u. was accepted');
    assert.equal(isGoalStepEvent(used({ id: 'u.bad id' })), false, 'a used-outside id naming no pack was accepted');
    assert.equal(isGoalStepEvent(started({ at: 1.5 })), false, 'a fractional time was accepted');
    assert.equal(isGoalStepEvent(started({ at: 0 })), false, 'a zero time was accepted');
    assert.equal(isGoalStepEvent(started({ at: '1700000000000' })), false, 'a string time was accepted');
    assert.equal(isGoalStepEvent(started({ kind: 'step-finished' })), false, 'an unknown kind was accepted');
    for (const junk of [null, 'x', 7, [], [started()]]) assert.equal(isGoalStepEvent(junk), false);
  });

  test('a stored blob is readable only at this build\'s version', () => {
    assert.equal(GOAL_STEPS_VERSION, 1);
    assert.equal(readGoalSteps({ version: 2, steps: [started()] }), null, 'a newer blob was read as this build\'s');
    assert.equal(readGoalSteps({ version: 1 }), null);
    assert.deepEqual(readGoalSteps({ version: 1, steps: [started(), { junk: true }] })?.steps, [started()]);
  });
});

/** The deterministic chooser policy.test.ts uses, so a failing seed can be replayed. */
function chooser(seed: number) {
  let state = (seed * 2654435761) >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return {
    int: (n: number): number => Math.floor(next() * n),
    one: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    bool: (): boolean => next() < 0.5,
  };
}

const IDS = ['pack-a', 'pack-b', 'pack-c', 'pack-d'];
const KEYS = [factKey('order a coffee'), factKey('check into a hotel')];

function blob(seed: number): unknown {
  const pick = chooser(seed);
  if (seed % 13 === 0) return null;
  const steps: unknown[] = [];
  for (let i = 0; i < pick.int(8); i += 1) {
    const id = pick.one(IDS);
    // A small time range on purpose, so equal `at` and two differing copies of
    // one (kind, id) at different times are common rather than rare.
    const at = 1 + pick.int(6);
    if (pick.bool()) steps.push({ kind: 'step-started', id, at, goalKey: pick.one(KEYS), task: pick.one(['mission:cafe', 'mission:hotel']) });
    else steps.push({ kind: 'used-outside', id: `u.${id}`, at, goalKey: pick.one(KEYS) });
  }
  if (pick.int(5) === 0) steps.push({ junk: 'row' });
  return { version: 1, steps };
}

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

describe('the goal-step merge — contract test 2', () => {
  test('commutative, idempotent and associative over two hundred seeds', () => {
    let differingCopies = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const a = blob(seed * 3 + 1);
      const b = blob(seed * 5 + 2);
      const c = blob(seed * 7 + 3);
      const ab = mergeGoalSteps(a, b);
      assert.ok(same(ab, mergeGoalSteps(b, a)), `seed ${seed}: depends on which device asked`);
      assert.ok(same(mergeGoalSteps(ab, ab), ab), `seed ${seed}: not idempotent`);
      assert.ok(
        same(mergeGoalSteps(mergeGoalSteps(a, b), c), mergeGoalSteps(a, mergeGoalSteps(b, c))),
        `seed ${seed}: the grouping changed the answer`,
      );
      const all = mergeGoalSteps(ab, c).steps;
      const perKey = new Map<string, Set<number>>();
      for (const row of all) perKey.set(`${row.kind} ${row.id}`, (perKey.get(`${row.kind} ${row.id}`) ?? new Set()).add(row.at));
      if ([...perKey.values()].some((times) => times.size > 1)) differingCopies += 1;
    }
    // The case a per-key canonical pick gets wrong has to actually occur, or the
    // associativity above proves nothing about it.
    assert.ok(differingCopies > 20, `only ${differingCopies} seeds held two differing copies of one row`);
  });

  test('the whole row is the identity: a per-key pick would lose the older copy by text order', () => {
    // "5" sorts after "100" as text, so a canonical-string pick keyed on
    // (kind, id) keeps the OLDER copy. Whole-row union keeps both.
    const older = started({ at: 5 });
    const newer = started({ at: 100 });
    const merged = mergeGoalSteps({ version: 1, steps: [older] }, { version: 1, steps: [newer] });
    assert.deepEqual(merged.steps.map((row) => row.at), [5, 100]);
    // The reader view shows one row per (kind, id), the canonical max.
    const view = uniqueGoalSteps(merged.steps);
    assert.equal(view.length, 1);
    assert.equal(view[0]!.at, 5, 'the reader picks by canonical rendering, the same one on every device');
  });

  test('an absent or corrupt side contributes nothing and takes nothing', () => {
    const mine = { version: 1, steps: [started()] };
    for (const junk of [null, 'x', 42, [], { version: 'one' }, { steps: 'lots' }]) {
      assert.deepEqual(mergeGoalSteps(mine, junk).steps, [started()]);
    }
    assert.deepEqual(mergeGoalSteps(null, null), { version: 1, steps: [] });
  });
});

describe('the goal-step cap — contract test 3', () => {
  test('seventy rows in, the sixty newest by at out, ties in (kind, id, canonical) order, byte-identical either way round', () => {
    assert.equal(MAX_GOAL_STEPS, 60);
    const rows: GoalStepEvent[] = [];
    for (let i = 0; i < 70; i += 1) {
      // Pairs share an `at`, so the tie-break is exercised all the way down.
      const at = 1000 + Math.floor(i / 2);
      rows.push(
        i % 2 === 0
          ? { kind: 'step-started', id: `pack-${String(i).padStart(3, '0')}`, at, goalKey: GOAL, task: 'mission:cafe' }
          : { kind: 'used-outside', id: `u.pack-${String(i - 1).padStart(3, '0')}`, at, goalKey: GOAL },
      );
    }
    const forward = mergeGoalSteps({ version: 1, steps: rows }, null);
    const backward = mergeGoalSteps(null, { version: 1, steps: [...rows].reverse() });
    assert.equal(JSON.stringify(forward), JSON.stringify(backward), 'the arrival order changed the bytes');
    assert.equal(forward.steps.length, MAX_GOAL_STEPS);
    assert.equal(forward.steps[0]!.at, 1005, 'the cap kept something older than the newest sixty');
    assert.equal(forward.steps[forward.steps.length - 1]!.at, 1034);
    // Equal `at`: step-started sorts before used-outside by kind.
    assert.equal(forward.steps[0]!.kind, 'step-started');
    assert.equal(forward.steps[1]!.kind, 'used-outside');
    // Every row is re-emitted in the fixed key order.
    for (const row of forward.steps) {
      assert.deepEqual(Object.keys(row), row.kind === 'step-started' ? ['kind', 'id', 'at', 'goalKey', 'task'] : ['kind', 'id', 'at', 'goalKey']);
    }
  });
});
