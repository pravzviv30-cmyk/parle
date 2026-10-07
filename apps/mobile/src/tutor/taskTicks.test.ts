/**
 * A scene goal ticking in the room (come alive, core loop 2.7; F765).
 *
 * The transition rules are `taskTicks.ts`, run here. The list, the hook and
 * the conversation screen load React Native, so the last test reads them as
 * text and holds them to drawing and saying what the rules decide, silently.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MissionTasks } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import { FINAL_TICK_HOLD_MS, NO_TICKS, isFinalTick, newlyAchieved, tickAnnouncement, ticksAfter } from './taskTicks.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

type Items = MissionTasks['items'];
const goals = (achieved: readonly boolean[]): Items =>
  achieved.map((done, i) => ({ id: `goal-${i}`, goalEn: ['Greet the server', 'Order a coffee', 'Pay and say thanks'][i] ?? `Goal ${i}`, achieved: done })) as Items;

describe('a scene goal ticks in the room — F765', () => {
  test('a goal ticks only when it is seen unticked and then ticked, and never after a stop', () => {
    // The first look is not news: a reconnect or a resumed room never animates.
    assert.deepEqual(newlyAchieved(null, goals([true, true, false])), []);
    let step = ticksAfter(NO_TICKS, { session: 's1', items: goals([true, false, false]), stopped: false });
    assert.deepEqual(step.fresh, [], 'goals already reached when the list appeared ticked again');
    // The list's own rule, against its first look: the same answer.
    const firstLook = new Set(['goal-0']);
    assert.deepEqual(newlyAchieved(firstLook, goals([true, false, false])), []);
    assert.deepEqual(newlyAchieved(firstLook, goals([true, true, false])), ['goal-1']);

    // The learner orders: one goal ticks, once.
    step = ticksAfter(step.state, { session: 's1', items: goals([true, true, false]), stopped: false });
    assert.deepEqual(step.fresh, ['goal-1']);
    assert.equal(step.final, false, 'a goal that left one to go was taken for the last');
    const again = ticksAfter(step.state, { session: 's1', items: goals([true, true, false]), stopped: false });
    assert.equal(again.state, step.state, 'the same view moved the list again');
    assert.deepEqual(again.fresh, []);

    // A safety stop moves nothing and remembers nothing new (F137).
    const stopped = ticksAfter(step.state, { session: 's1', items: goals([true, true, true]), stopped: true });
    assert.equal(stopped.state, step.state, 'a goal ticked after the session was stopped');
    assert.deepEqual(stopped.fresh, []);
    assert.equal(stopped.final, false);

    // A new session starts again, and its first look is not news either.
    const next = ticksAfter(step.state, { session: 's2', items: goals([true, true, true]), stopped: false });
    assert.deepEqual(next.fresh, [], 'a new session replayed the last one\'s goals');
    assert.equal(next.final, false);
    assert.equal(next.state.cue, null);
  });

  test("the last goal holds the scene's card for the orb's ripple and sets the orb's cue, once", () => {
    let step = ticksAfter(NO_TICKS, { session: 's1', items: goals([true, true, false]), stopped: false });
    assert.equal(step.state.cue, null);
    step = ticksAfter(step.state, { session: 's1', items: goals([true, true, true]), stopped: false });
    assert.equal(step.final, true, 'the last goal was not taken for the last');
    assert.equal(isFinalTick(step.fresh, goals([true, true, true])), true);
    assert.ok(step.state.cue !== null && step.state.cue.startsWith('s1:'), 'the orb was given no ripple for the last goal');
    // Every goal reached at once on the first look is no tick, so no ripple.
    assert.equal(isFinalTick([], goals([true, true, true])), false);
    assert.equal(isFinalTick(['goal-0'], []), false);
    // The hold is the ripple: the second ring a beat behind the first.
    assert.ok(FINAL_TICK_HOLD_MS > 0 && FINAL_TICK_HOLD_MS <= 1000, `the card waits ${FINAL_TICK_HOLD_MS} ms, longer than a ripple`);

    const hook = stripComments(read('./useTaskTicks.ts'));
    assert.match(hook, /if \(step\.final && !reduced\) setHoldingCard\(true\);/, 'the card is held with movement reduced, or not for the ripple');
    assert.match(hook, /setTimeout\(\(\) => setHoldingCard\(false\), FINAL_TICK_HOLD_MS\)/, 'the card is held for longer than the ripple, or forever');
    assert.match(hook, /if \(holdingCard && \(reduced \|\| stopped\)\) setHoldingCard\(false\);/, 'a stop or Reduce Motion leaves the card waiting');
    const convo = stripComments(read('../ConvoScreen.tsx'));
    assert.match(convo, /const card = win\.showing && !ticks\.holdingCard \? winCard\(missionId\) : null;/, 'the card does not wait for the ripple');
    assert.match(convo, /<OrbCue value=\{ticks\.cue\}>/, 'the orb in the scene never hears the last goal');
    assert.match(convo, /useTaskTicks\(missionItems, live\.sessionId, \{ stopped, reduced: reducedMotion \}\)/);
  });

  test('a tick is announced in the goal\'s own words, with no count, and the list plays nothing', () => {
    assert.equal(tickAnnouncement(['Order a coffee']), 'Goal reached: Order a coffee.');
    assert.equal(tickAnnouncement(['Order a coffee.', 'Pay and say thanks']), 'Goal reached: Order a coffee. Goal reached: Pay and say thanks.');
    assert.equal(tickAnnouncement(['  ']), null);
    assert.equal(tickAnnouncement([]), null);
    const line = tickAnnouncement(['Greet the server'])!;
    assert.doesNotMatch(line, /\d|[—–·]/, 'a mid-session line carries a number or a dash');
    assert.equal(streakGuiltIn(line), undefined);

    const list = stripComments(read('./MissionTaskList.tsx'));
    // Fresh against the list's first look, decided in the render the goal turns.
    assert.match(list, /if \(firstLook\.current === null && items\.length > 0\) firstLook\.current = achievedIds\(items\);/, 'goals already reached when the list appeared would tick again');
    assert.match(list, /const fresh = new Set\(newlyAchieved\(firstLook\.current, items\)\);/);
    assert.match(list, /<Enter from="none" scaleFrom=\{0\.6\} duration=\{DUR\.fast\} play=\{ticking\} style=\{st\.cover\}>/, 'a tick does not pop its disc');
    assert.match(list, /<Enter from="none" scaleFrom=\{0\.4\} delay=\{DUR\.micro\} duration=\{DUR\.fast\} play=\{ticking\}>\s*<CheckGlyph size=\{14\} color=\{paper\.ink\} \/>/, 'the check does not land a beat after the disc, in ink on mint');
    assert.match(list, /\{ticking \? <Glint when/, 'the row does not glint, or glints for a goal already reached');
    assert.match(list, /AccessibilityInfo\.announceForAccessibility\(line\)/, 'a screen reader is not told which goal was reached');
    assert.match(list, /scrollTo\(\{ y: [^}]*animated: !reduced \}\)/, 'the ticked row is not scrolled into view, or glides with movement reduced');
    assert.doesNotMatch(list, /\bof \d|\d+ of|sound\/|haptics|celebrate\/effects/, 'the list counts goals or plays a sound or haptic in the room');
  });
});
