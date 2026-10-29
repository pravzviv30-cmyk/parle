/**
 * How Home's numbers move while Home stays mounted (F767, Phase 4 review).
 *
 * Home is a tab: it stays mounted under every screen pushed over it, and the
 * game layer reads again the moment a sitting settles. Two rules follow, held
 * here as pure functions and then as the wiring the cards use:
 *
 * - a counter is never handed a lower value while it is mounted: a fall, and a
 *   day's number on a new day, mount the counter again where it stands;
 * - a new value is drawn only where the learner can see it, after the
 *   takeovers, and only what was drawn is remembered.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BURST_WINDOW_MS, RESUME_AFTER_MS } from '../celebrate/queue.ts';
import { onTakeoverOnScreenChange, setTakeoverOnScreen, takeoverOnScreen } from '../celebrate/onScreen.ts';
import {
  DRAW_SETTLE_MS,
  RING_STEPS,
  drawMoved,
  firstDraw,
  heroCounts,
  mayDraw,
  nextDraw,
  questCounts,
  risen,
  type DrawGate,
  type HomeDraw,
} from './homeDraw.ts';
import { withShown, type ShownField } from './homeSeen.ts';

const D1 = '2026-10-07';
const D2 = '2026-10-08';

const flat = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');
const read = (relative: string): string => flat(readFileSync(new URL(relative, import.meta.url), 'utf8'));

/** Every counter that stayed mounted between two draws only rose or stood, and none starts above itself. */
function neverDown(before: HomeDraw, after: HomeDraw): string[] {
  const wrong: string[] = [];
  for (const [field, counter] of Object.entries(after.counters)) {
    if (counter.from > counter.to) wrong.push(`${field} starts above where it lands`);
    const was = before.counters[field as ShownField];
    if (was !== undefined && was.mount === counter.mount && counter.to < was.to) wrong.push(`${field} was handed ${counter.to} while mounted at ${was.to}`);
  }
  return wrong;
}

describe("Home's numbers on a mounted Home — F767", () => {
  test("a number that fell, or a day's number on a new day, is drawn again where it stands and never counts down", () => {
    // Drawn yesterday evening: a 5-day run, the goal met, all three quests.
    const evening = firstDraw(
      withShown(null, { streak: 4, minutes: 4, ring: 400, level: 3, questsDone: 2 }, D1),
      { streak: 5, minutes: 12, ring: 1000, level: 3, questsDone: 3 },
      D1,
    );
    // The first draw counts up from what Home last showed, once.
    assert.deepEqual(evening.counters.streak, { from: 4, to: 5, mount: 0 });
    assert.deepEqual(evening.counters.ring, { from: 400, to: 1000, mount: 0 });
    assert.deepEqual(evening.counters.questsDone, { from: 2, to: 3, mount: 0 });
    assert.deepEqual(evening.counters.level, { from: 3, to: 3, mount: 0 });
    assert.equal(risen(evening.counters.streak), true, 'a run that rose since Home last drew it does not light the flame');

    // Next morning, Home still mounted: the new day's quests are dealt and the
    // minutes start again. The day's numbers are mounted again at nought, so
    // "All three quests done today." never runs down to nought and a full ring
    // never drains; the run and the level stand.
    const morning = nextDraw(evening, { streak: 5, minutes: 0, ring: 0, level: 3, questsDone: 0 }, D2);
    assert.deepEqual(morning.counters.questsDone, { from: 0, to: 0, mount: 1 });
    assert.deepEqual(morning.counters.ring, { from: 0, to: 0, mount: 1 });
    assert.deepEqual(morning.counters.minutes, { from: 0, to: 0, mount: 1 });
    assert.equal(morning.counters.streak, evening.counters.streak, 'the run is drawn again although it did not move');
    assert.deepEqual(neverDown(evening, morning), []);

    // A rise since midnight counts up from nought on the new mount.
    const practised = nextDraw(morning, { streak: 6, minutes: 7, ring: 700, level: 4, questsDone: 1 }, D2);
    assert.deepEqual(practised.counters.questsDone, { from: 0, to: 1, mount: 1 });
    assert.deepEqual(practised.counters.ring, { from: 0, to: 700, mount: 1 });
    assert.deepEqual(practised.counters.streak, { from: 4, to: 6, mount: 0 }, 'the run does not count on from where it stands');
    assert.deepEqual(practised.counters.level, { from: 3, to: 4, mount: 0 });
    assert.deepEqual(neverDown(morning, practised), []);

    // A run that resets is drawn at nought where it stands, never counted
    // down; the next practice draws the new run at one (F918) and lights the flame.
    const reset = nextDraw(practised, { streak: 0, minutes: 0, ring: 0, level: 4, questsDone: 0 }, '2026-10-10');
    assert.deepEqual(reset.counters.streak, { from: 0, to: 0, mount: 1 }, 'a reset run counts down');
    assert.equal(risen(reset.counters.streak), false);
    const restarted = nextDraw(reset, { streak: 1, minutes: 2, ring: 200, level: 4, questsDone: 0 }, '2026-10-10');
    // F918: a running streak never draws "0 days", so the new run lands on one rather than counting up from nought.
    assert.deepEqual(restarted.counters.streak, { from: 1, to: 1, mount: 1 });
    assert.equal(risen(restarted.counters.streak), false);

    // A goal raised in Profile lowers the ring's fraction: drawn again, not drained.
    const raised = nextDraw(restarted, { streak: 1, minutes: 2, ring: 100, level: 4, questsDone: 0 }, '2026-10-10');
    assert.deepEqual(raised.counters.ring, { from: 100, to: 100, mount: restarted.counters.ring!.mount + 1 });

    // A number that leaves (no goal, so no ring) is dropped; one that arrives
    // is drawn as it stands, never counted up from a guess.
    const noGoal = nextDraw(raised, { streak: 1, minutes: 2, level: 4, questsDone: 0 }, '2026-10-10');
    assert.equal(noGoal.counters.ring, undefined);
    assert.deepEqual(nextDraw(noGoal, { streak: 1, minutes: 2, ring: 400, level: 4, questsDone: 0 }, '2026-10-10').counters.ring, { from: 400, to: 400, mount: 0 });

    // Whatever arrives, in any order and across any days, a mounted counter is
    // never handed a lower value and never starts above itself.
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    let drawn = firstDraw(null, { streak: 3, minutes: 5, ring: 500, level: 2, questsDone: 1 }, D1);
    let day = 7;
    for (let step = 0; step < 400; step += 1) {
      if (next(5) === 0) day += 1;
      const today = `2026-10-${String(day).padStart(2, '0')}`;
      const after = nextDraw(drawn, { streak: next(9), minutes: next(30), ring: next(1001), level: 1 + next(6), questsDone: next(4) }, today);
      assert.deepEqual(neverDown(drawn, after), [], `step ${step}`);
      drawn = after;
    }

    // What the cards hand in: the run (nought with none), the minutes, the
    // ring in thousandths and the level; the quests done.
    assert.deepEqual(
      heroCounts({
        flame: { lit: false, count: null, words: '', label: '' },
        goal: { minutes: 6, target: 10, fraction: 0.6, met: false, words: '', label: '' },
        level: { level: 2, words: '', label: '' },
      }),
      { streak: 0, minutes: 6, ring: 600, level: 2 },
    );
    assert.equal(RING_STEPS, 1000);
    assert.deepEqual(questCounts({ title: '', done: 2, progress: '', allDone: false, rows: [] }), { questsDone: 2 });

    // Only a draw that shows something new is remembered again.
    assert.equal(drawMoved(null, evening), true);
    assert.equal(drawMoved(evening, nextDraw(evening, { streak: 5, minutes: 12, ring: 1000, level: 3, questsDone: 3 }, D1)), false);
    assert.equal(drawMoved(evening, morning), true);

    // The cards key every counter on its mount and draw only from the draw.
    const hero = read('../game/TodayHero.tsx');
    for (const key of ['run', 'ring', 'level']) assert.match(hero, new RegExp(`key=\\{\`${key}-\\$\\{\\w+\\.mount\\}\`\\}`), `the hero's ${key} is not keyed on its mount`);
    assert.doesNotMatch(hero, /\bfrom=\{[^}]*\?\?/, 'a counter starts from a fallback guess');
    const quests = read('../game/QuestsCard.tsx');
    assert.match(quests, /key=\{`done-\$\{done\.mount\}`\}/, "the quests' count is not keyed on its mount");
    assert.match(quests, /key=\{`\$\{drawn\.draw\.day\}:\$\{row\.id\}:\$\{row\.target\}`\}/, "a quest's bar can be handed a lower fill on a new day");
  });

  test('Home draws a new value only where the learner can see it, after the takeovers, and remembers only what it drew', () => {
    // The gate: on top, in front, nothing holding the queue, no takeover.
    const open: DrawGate = { focused: true, active: true, held: false, takeover: false };
    assert.equal(mayDraw(open), true);
    assert.equal(mayDraw({ ...open, focused: false }), false, 'Home draws under the sitting that settled');
    assert.equal(mayDraw({ ...open, active: false }), false, 'Home draws behind the app');
    assert.equal(mayDraw({ ...open, held: true }), false, 'Home draws under an end card or a sheet');
    assert.equal(mayDraw({ ...open, takeover: true }), false, 'Home draws under a takeover');

    // Reopening waits out the queue's pause between takeovers and its burst
    // window, so the next card of a run is waited for too.
    assert.equal(DRAW_SETTLE_MS, RESUME_AFTER_MS + BURST_WINDOW_MS);
    assert.ok(DRAW_SETTLE_MS > RESUME_AFTER_MS, 'Home draws in the pause between two takeovers');

    // Walk the main flow through the rules: Home shows a 4-day run and 3
    // minutes; the learner opens a drill; the drill settles; its end card
    // holds the queue; back on Home a takeover plays; then Home draws.
    let drawn = firstDraw(null, { streak: 4, minutes: 3, ring: 300, level: 2, questsDone: 1 }, D1);
    const steps: { gate: DrawGate; fresh: Parameters<typeof nextDraw>[1] }[] = [
      { gate: { ...open, focused: false }, fresh: { streak: 5, minutes: 9, ring: 900, level: 3, questsDone: 2 } },
      { gate: { ...open, focused: false, held: true }, fresh: { streak: 5, minutes: 9, ring: 900, level: 3, questsDone: 2 } },
      { gate: { ...open, takeover: true }, fresh: { streak: 5, minutes: 9, ring: 900, level: 3, questsDone: 2 } },
    ];
    for (const { gate, fresh } of steps) if (mayDraw(gate)) drawn = nextDraw(drawn, fresh, D1);
    assert.deepEqual(drawn.counters.streak, { from: 4, to: 4, mount: 0 }, 'the run moved where the learner could not see it');
    drawn = nextDraw(drawn, { streak: 5, minutes: 9, ring: 900, level: 3, questsDone: 2 }, D1);
    assert.deepEqual(drawn.counters.streak, { from: 4, to: 5, mount: 0 }, 'the run does not tick up in front of the learner');
    assert.deepEqual(drawn.counters.ring, { from: 300, to: 900, mount: 0 });

    // The takeover signal the gate reads: the host says when its card is up.
    let heard = 0;
    const stop = onTakeoverOnScreenChange(() => {
      heard += 1;
    });
    setTakeoverOnScreen(true);
    assert.equal(takeoverOnScreen(), true);
    setTakeoverOnScreen(true);
    setTakeoverOnScreen(false);
    stop();
    setTakeoverOnScreen(true);
    setTakeoverOnScreen(false);
    assert.equal(heard, 2, 'a takeover appearing or going is not heard once each');

    // The wiring: the host says it, the gate reads every source, waits out
    // the settle on reopening, and the hook draws and remembers only through it.
    const host = read('../celebrate/CelebrationHost.tsx');
    assert.match(host, /const showing = snapshot\.current !== null; useEffect\(\(\) => setTakeoverOnScreen\(showing\), \[showing\]\);/, 'the host never says a takeover is up');
    const hook = read('./useHomeDraw.ts');
    assert.match(hook, /const focused = useIsFocused\(\);/);
    assert.match(hook, /AppState\.addEventListener\('change', \(state\) => setActive\(inFront\(state\)\)\)/);
    // An app state the OS has not answered yet never shuts Home for good.
    assert.match(hook, /const inFront = \(state: AppStateStatus \| null \| undefined\): boolean => state !== 'background' && state !== 'inactive';/);
    // The first draw never waits (no sand left under a sheet), and behind a
    // closed gate it is drawn still; every later draw waits for the gate.
    assert.match(hook, /firstDraw\(gate \? seen : null, fresh, today\)/);
    assert.match(hook, /if \(!gate\) return; const next = \{ model, draw: nextDraw\(before\.draw, fresh, today\) \};/);
    assert.deepEqual(firstDraw(null, { streak: 6, ring: 800 }, D1).counters, { streak: { from: 6, to: 6, mount: 0 }, ring: { from: 800, to: 800, mount: 0 } });
    assert.match(hook, /onCelebrationHoldChange\(\(\) => setHeld\(celebrationsHeld\(\)\)\)/);
    assert.match(hook, /onTakeoverOnScreenChange\(\(\) => setTakeover\(takeoverOnScreen\(\)\)\)/);
    assert.match(hook, /const open = mayDraw\(\{ focused, active, held, takeover \}\);/);
    assert.match(hook, /setTimeout\(\(\) => setSettled\(true\), DRAW_SETTLE_MS\)/, 'reopening draws before a run of takeovers has finished');
    assert.match(hook, /return open && settled;/);
    assert.equal((hook.match(/markShown\(/g) ?? []).length, 2, 'something other than a draw remembers a value as shown');
    assert.match(hook, /if \(drawMoved\(before\.draw, next\.draw\)\) void loadHomeSeen\(\)\.then\(\(seen\) => markShown\(fresh, today, seen\)\);/);

    // The hero asks the game layer again when the day turns while Home is on
    // top, so midnight's new ring and quests arrive without leaving the tab.
    const hero = read('../game/TodayHero.tsx');
    assert.match(hero, /if \(dayTurned\(today, Date\.now\(\)\)\) refresh\(\);/, 'the hero keeps yesterday after midnight');
    assert.match(hero, /\}, DAY_CHECK_MS\);/);
  });
});
