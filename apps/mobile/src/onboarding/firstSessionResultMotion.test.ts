import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const result = readFileSync(new URL('./FirstSessionResult.tsx', import.meta.url), 'utf8');
const achievement = result.slice(result.indexOf('function Achievement('), result.indexOf('export function FirstSessionSummary('));
const scenes = readFileSync(new URL('./motion/OnboardingScenes.tsx', import.meta.url), 'utf8');
const reveal = scenes.slice(scenes.indexOf('export function RevealItem('), scenes.indexOf('\nconst styles ='));

function effectBody(source: string, dependencies: string) {
  const marker = '  useEffect(() => {';
  const start = source.indexOf(marker);
  const end = source.indexOf(`  }, [${dependencies}]);`, start);
  assert.ok(start >= 0 && end > start, 'the production reveal effect must be exercised');
  return source.slice(start + marker.length, end);
}

function achievementHarness() {
  const run = new Function('reduced', 'index', 'revealStep', 'setRevealed', 'setTimeout', 'clearTimeout', effectBody(achievement, 'reduced, index'));
  const revealStep = { current: 0 };
  const timers = new Map<number, () => void>();
  const history = [0];
  let nextId = 0;
  let cleanup: (() => void) | undefined;
  const setRevealed = (next: number) => history.push(next);
  return {
    history, timers,
    preference(reduced: boolean | null) {
      cleanup?.();
      cleanup = run(reduced, 0, revealStep, setRevealed,
        (callback: () => void) => { const id = ++nextId; timers.set(id, callback); return id; },
        (id: number) => timers.delete(id));
    },
    advanceOne() { const next = timers.entries().next().value; if (next) { timers.delete(next[0]); next[1](); } },
    advanceAll() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    unmount() { cleanup?.(); },
  };
}

function revealHarness() {
  const run = new Function('reduced', 'active', 'index', 'entered', 'value', 'Animated', 'Easing', 'NATIVE_DRIVER', effectBody(reveal, 'active, index, reduced, value'));
  const entered = { current: false };
  const history = [0];
  const value = { stopAnimation() {}, setValue(next: number) { history.push(next); } };
  let starts = 0;
  let cleanup: (() => void) | undefined;
  return {
    history,
    starts: () => starts,
    preference(reduced: boolean | null, active = true) {
      cleanup?.();
      cleanup = run(reduced, active, 0, entered, value, {
        timing: (_value: unknown, config: { duration: number }) => {
          assert.equal(config.duration, 280, 'the existing bounded entrance duration must remain');
          return { start() { starts++; }, stop() {} };
        },
      }, { out: () => undefined, cubic: undefined }, false);
    },
    finish() { value.setValue(1); },
    unmount() { cleanup?.(); },
  };
}

test('achievement words wait for the motion answer and then reveal in order', () => {
  const h = achievementHarness();
  h.preference(null);
  assert.equal(h.timers.size, 0, 'an unknown preference must not schedule a reveal');
  assert.deepEqual(h.history, [0]);
  h.preference(false); h.advanceAll();
  assert.deepEqual(h.history, [0, 1, 2, 3], 'resolving the preference must never show all words and retract them');
  assert.match(achievement, /useReduceMotion\(true\)/, 'unknown must stay distinct from confirmed Reduce Motion');
});

test('turning Reduce Motion off never retracts already earned words', () => {
  for (const partiallyRevealed of [false, true]) {
    const h = achievementHarness();
    if (partiallyRevealed) { h.preference(false); h.advanceOne(); }
    h.preference(true);
    assert.equal(h.history.at(-1), 3, 'Reduce Motion lands the full readable statement');
    const landedAt = h.history.length;
    h.preference(false); h.advanceAll();
    assert.ok(h.history.slice(landedAt).every(step => step === 3), 'completed achievement text must never rewind to one third');
    assert.equal(h.timers.size, 0);
  }
});

test('leaving an achievement cancels scheduled and already queued word callbacks', () => {
  const h = achievementHarness(); h.preference(false);
  const queued = [...h.timers.values()];
  h.unmount();
  assert.equal(h.timers.size, 0, 'cleanup must clear all remaining timers');
  queued.forEach(callback => callback());
  assert.deepEqual(h.history, [0], 'a callback queued before cleanup cannot update a departed row');
});

test('a revealed achievement row and its Save button do not replay on motion preference changes', () => {
  const h = revealHarness();
  h.preference(null); assert.equal(h.starts(), 0);
  h.preference(false); assert.equal(h.starts(), 1);
  h.finish(); h.preference(true);
  const landedAt = h.history.length;
  h.preference(false);
  assert.equal(h.starts(), 1, 'the settled row must not start a second entrance');
  assert.ok(h.history.slice(landedAt).every(value => value === 1), 'a visible row must never hide on a preference toggle');
  h.unmount();
});

test('a row shown with Reduce Motion stays visible when ordinary motion returns', () => {
  const h = revealHarness(); h.preference(true);
  assert.equal(h.history.at(-1), 1);
  h.preference(false);
  assert.equal(h.starts(), 0, 'turning motion on cannot replay an already shown row');
  assert.equal(h.history.at(-1), 1);
});
