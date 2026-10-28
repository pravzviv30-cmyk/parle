import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { tutorGate } from '../tutor/gate.ts';

const source = readFileSync(new URL('./MissionHero.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const open = (textMode: boolean | undefined) => {');
const end = source.indexOf('\n  if (vivid)', start);
assert.ok(start > 0 && end > start, 'exercise the actual shared Home and Speak launch handler');
const handler = `${stripTypeScriptTypes(source.slice(start, end))}\nreturn open;`;
const setupStart = source.indexOf('  const owner = scopeGeneration();');
const setupEnd = source.indexOf('  /** The start that did not happen', setupStart);
assert.ok(setupStart > 0 && setupEnd > setupStart, 'exercise the production visit ownership and effect cleanup');
const setup = `${stripTypeScriptTypes(source.slice(setupStart, setupEnd))}\nreturn { launchContext, launchPending };`;

function deferred() {
  let resolve!: (value: boolean) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<boolean>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness() {
  const probes: ReturnType<typeof deferred>[] = [];
  const navigations: unknown[][] = [], checks: boolean[] = [], held: unknown[] = [], events: unknown[] = [];
  let scope = 1, focused = true, refIndex = 0, effectIndex = 0;
  const hero = { id: 'cafe' };
  const refs: { current: unknown }[] = [];
  const effects: { dependencies: unknown[]; cleanup?: () => void }[] = [];
  const setChecking = (value: boolean) => checks.push(value);
  const useRef = (value: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value });
  const useEffect = (effect: () => (() => void) | undefined, dependencies: unknown[]) => {
    const index = effectIndex++, held = effects[index];
    if (held && held.dependencies.length === dependencies.length && dependencies.every((value, i) => Object.is(value, held.dependencies[i]))) return;
    held?.cleanup?.(); effects[index] = { dependencies, cleanup: effect() };
  };
  const runSetup = new Function('scopeGeneration', 'focused', 'hero', 'useRef', 'useEffect', 'setChecking', setup);
  const render = () => { refIndex = 0; effectIndex = 0; return runSetup(() => scope, focused, hero, useRef, useEffect, setChecking); };
  const { launchContext, launchPending } = render();
  const world = {
    checking: false, setChecking,
    setHeldBack: (value: unknown) => held.push(value),
    recheck: () => { const probe = deferred(); probes.push(probe); return probe.promise; },
    tutorGate, heroStart: () => ({ missionId: 'mission:cafe', params: { missionId: 'mission:cafe' } }),
    trackProductEvent: (event: unknown) => { events.push(event); return Promise.resolve(); },
    nav: { navigate: (...args: unknown[]) => navigations.push(args) },
    hero, launchContext, launchPending, scopeGeneration: () => scope,
  };
  const open = new Function(...Object.keys(world), handler)(...Object.values(world)) as (typing: boolean) => void;
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  return { open, probes, navigations, checks, held, events, settle, launchContext, launchPending,
    accountChanged() { scope++; render(); },
    blur() { focused = false; render(); },
    refocus() { focused = true; render(); },
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

test('repeated Home scene taps share one connection check and open one room', async () => {
  const h = harness(); h.open(false); h.open(true);
  assert.equal(h.probes.length, 1, 'React state has not rendered yet, so the first tap must lock synchronously');
  h.probes[0]!.resolve(true); await h.settle(); h.open(false);
  assert.deepEqual(h.navigations, [['Convo', { textMode: false, missionId: 'mission:cafe' }]]);
  assert.equal(h.events.length, 1, 'only the accepted start records mission intent');
});

test('a scene connection check cannot navigate after its card has unmounted', async () => {
  const h = harness(); h.open(false); const writes = h.checks.length;
  h.unmount(); h.probes[0]!.resolve(true); await h.settle();
  assert.deepEqual(h.navigations, [], 'a departed card must not pull the learner into a live room');
  assert.equal(h.checks.length, writes, 'the stale result cannot update an unmounted card');
  assert.deepEqual(h.events, []);
});

test('a scene connection check cannot carry the previous account into a room', async () => {
  const h = harness(); h.open(false); h.accountChanged();
  h.probes[0]!.resolve(true); await h.settle();
  assert.deepEqual(h.navigations, [], 'an old account probe cannot launch with the newly active identity');
  assert.deepEqual(h.events, []);
});

test('leaving and returning to Home does not revive a pending scene tap', async () => {
  const h = harness(); h.open(false); h.blur(); h.refocus();
  h.probes[0]!.resolve(true); await h.settle();
  assert.deepEqual(h.navigations, [], 'returning to the card is a new visit, not consent to its old pending start');
});

test('a failed connection check cannot draw recovery on a departed card', async () => {
  const h = harness(); h.open(true); h.unmount();
  h.probes[0]!.reject(new Error('unavailable')); await h.settle();
  assert.deepEqual(h.held, [], 'stale rejection must not draw a recovery state after unmount');
});

test('an offline scene preserves the requested typing mode and allows a deliberate retry', async () => {
  const h = harness(); h.open(true); h.probes[0]!.resolve(false); await h.settle();
  assert.deepEqual(h.held, [{ textMode: true }]);
  h.open(true); h.probes[1]!.resolve(true); await h.settle();
  assert.deepEqual(h.navigations, [['Convo', { textMode: true, missionId: 'mission:cafe' }]]);
});

test('an old visit cannot unlock or overwrite a new visit’s connection check', async () => {
  const h = harness(); h.open(false); h.blur(); h.refocus(); h.open(true);
  assert.equal(h.probes.length, 2, 'a deliberate start after returning uses a fresh check');
  h.probes[0]!.resolve(false); await h.settle();
  assert.deepEqual(h.held, [], 'the old offline answer cannot replace the current start');
  h.open(false); assert.equal(h.probes.length, 2, 'the old result must not release the new synchronous lock');
  h.probes[1]!.resolve(true); await h.settle();
  assert.deepEqual(h.navigations, [['Convo', { textMode: true, missionId: 'mission:cafe' }]]);
});
