/**
 * No takeover inside a sitting or under its end card (F766; README Part 6).
 *
 * The settle pipeline publishes a sitting's moments the instant it has read
 * them back, before the page can mount the end card that holds the queue, and
 * the game layer's catch-up can bring a moment back while a sitting is open.
 * Here the real pipeline settles against an in-memory disk and the real
 * celebration queue listens, on a fake clock, bound to the real `seen` list
 * and crash-replay queue the way the host binds them. The holds are the real
 * ones. Then the pages, the end card and the game layer are read as text,
 * because this workspace has no renderer (docs/TESTING.md).
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '@luvani/core';

import {
  attachCelebrationListener,
  celebrationKey,
  discardBufferedCelebrations,
  publishCelebrations,
  type CelebrationEvent,
} from '../celebrate/events.ts';
import {
  BURST_WINDOW_MS,
  RESUME_AFTER_MS,
  celebrationsHeld,
  createCelebrationQueue,
  holdCelebrations,
  onCelebrationHoldChange,
  type CelebrationQueue,
} from '../celebrate/queue.ts';
import { seedExistingLearner } from '../game/catchUp.ts';
import { dropCelebrations, enqueueCelebrations } from '../game/gameLocal.ts';
import { configureGameEnvironment, onSettleChain, settleSitting } from '../game/settle.ts';
import { hasSeen, markSeen } from '../game/store.ts';
import { NO_OUTSIDE_FACTS } from '../game/view.ts';
import { recordActivity } from '../progress/activity.ts';
import { scopeGeneration, setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { createSettleHold } from './settleHold.ts';

function installDisk(): void {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => map.get(key) ?? null;
  shared.setItem = async (key: string, value: string): Promise<void> => {
    map.set(key, value);
  };
  shared.removeItem = async (key: string): Promise<void> => {
    map.delete(key);
  };
  shared.multiRemove = async (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
  };
}

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const flat = (relative: string): string =>
  read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');
/** The text of a function or hook from its declaration to the next top-level one. */
function region(source: string, start: string): string {
  const at = source.indexOf(start);
  assert.ok(at >= 0, `${start} moved; this test is reading the wrong thing`);
  const next = source.slice(at + start.length).search(/ (?:export )?function [A-Z]\w*\(| export function use\w*\(/);
  return next < 0 ? source.slice(at) : source.slice(at, at + start.length + next);
}
const before = (source: string, first: string, then: string): boolean => {
  const a = source.indexOf(first);
  const b = source.indexOf(then);
  return a >= 0 && b >= 0 && a < b;
};

const MINUTE = 60_000;
/** Local noon, in the past, so no sitting is near a midnight and the store takes its rows. */
const NOON = new Date(2026, 9, 5, 12, 0, 0).getTime();

let uids = 0;
let restore: () => void = () => {};
const running: (() => void)[] = [];

beforeEach(() => {
  installDisk();
  resetSyncRegistry();
  setActiveUser(`77777777-7777-4777-8777-${String(++uids).padStart(12, '0')}`);
  restore = configureGameEnvironment({
    now: () => NOON,
    billing: () => Promise.resolve(null),
    canRecord: () => Promise.resolve(false),
    outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: 10 }),
  });
  discardBufferedCelebrations();
});

afterEach(() => {
  while (running.length > 0) running.pop()!();
  restore();
  discardBufferedCelebrations();
});

/** The host's queue, bound as `CelebrationHost.tsx` binds it, on a fake clock. */
function host() {
  let now = NOON;
  let serial = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const queue: CelebrationQueue = createCelebrationQueue({
    now: () => now,
    setTimer: (run, ms) => {
      serial += 1;
      timers.set(serial, { at: now + ms, run });
      return serial;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    generation: scopeGeneration,
    hasSeen,
    markSeen,
    enqueuePending: enqueueCelebrations,
    dropPending: dropCelebrations,
    stopEffects: () => {},
  });
  running.push(queue.start());
  running.push(attachCelebrationListener(queue.receive));
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 20; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  async function advance(ms: number): Promise<void> {
    const until = now + ms;
    await flush();
    for (let fired = 0; fired < 1000; fired += 1) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined) break;
      timers.delete(due[0]);
      now = Math.max(now, due[1].at);
      due[1].run();
      await flush();
    }
    now = until;
    await flush();
  }
  const showing = () => queue.snapshot().current?.card ?? null;
  /** Continue through every card the queue plays from here; their types, in order. */
  async function playAll(): Promise<string[]> {
    const played: string[] = [];
    for (let card = showing(); card !== null && played.length < 10; card = showing()) {
      played.push(card.type);
      queue.reachedFinal(card.id);
      queue.dismiss(card.id);
      await advance(RESUME_AFTER_MS + BURST_WINDOW_MS);
    }
    return played;
  }
  return { queue, advance, showing, playAll };
}

/** A finished drill set settled the way DrillScreen settles it. */
function settleDrill(at: number) {
  return settleSitting({
    source: 'drill',
    at,
    xpEarned: 12,
    activeMs: 3 * MINUTE,
    write: () => recordActivity('drill', 12, at, { durationMs: 3 * MINUTE, activeMs: 3 * MINUTE, finished: true }),
  });
}

describe('celebrations wait for the learner to leave — F766', () => {
  test('no takeover starts under an end card or inside a sitting', async () => {
    // The game layer has introduced this learner, so a settle may publish.
    assert.equal(await seedExistingLearner(), null);
    const h = host();

    // Unheld, the settle's own moment starts the instant it is published: the
    // gap the page closes by holding the queue before it settles.
    const control = await settleDrill(NOON - 30 * MINUTE);
    assert.ok(control !== null && control.streak.extendedNow, 'the first practice of the day did not extend the streak');
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'streak-extended', 'the settle published nothing, so this test proves nothing');
    assert.equal((await h.playAll())[0], 'streak-extended');
    assert.equal(h.showing(), null);

    // The next day: the page holds before it settles, as every sitting page does.
    restore();
    const tomorrow = NOON + 24 * 60 * MINUTE;
    restore = configureGameEnvironment({
      now: () => tomorrow,
      billing: () => Promise.resolve(null),
      canRecord: () => Promise.resolve(false),
      outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: 10 }),
    });
    await h.advance(24 * 60 * MINUTE);
    const page = createSettleHold();
    page.take();
    assert.equal(celebrationsHeld(), true);
    const delta = await settleDrill(tomorrow - MINUTE);
    await onSettleChain(async () => {});
    assert.ok(delta !== null && delta.streak.extendedNow, 'the next day did not extend the streak');
    page.claim();
    await h.advance(BURST_WINDOW_MS + RESUME_AFTER_MS);
    assert.equal(h.showing(), null, 'a takeover started before the end card was up to hold it');

    // The end card mounts with its own hold and the page's handed over; it
    // reads, and nothing starts under it.
    const card = holdCelebrations();
    await h.advance(10 * 1000);
    assert.equal(h.showing(), null, 'a takeover started under the end card');
    // The card goes: its own hold, then the one handed to it. Only then.
    card();
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing(), null, 'the card let go of its own hold and the takeover started while it was still going');
    page.release();
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'streak-extended', 'the moment never played once the learner left the card');
    assert.equal((h.showing()!.shows[0] as Extract<CelebrationEvent, { type: 'streak-extended' }>).data.day, localDayKey(tomorrow));
    await h.playAll();
    assert.equal(h.showing(), null);

    // A sitting page is open, and a catch-up brings a moment back from a crash:
    // it waits until the page goes, and the hold change is heard, so the game
    // layer can run a catch-up it put off.
    let heard = 0;
    const stopHearing = onCelebrationHoldChange(() => {
      heard += 1;
    });
    const sitting = holdCelebrations();
    // A level this learner is nowhere near, so nothing above has played it.
    const replay: CelebrationEvent = {
      type: 'level-up',
      key: celebrationKey.level(9),
      origin: 'account',
      at: tomorrow,
      data: { before: 8, level: 9 },
    };
    publishCelebrations([replay]);
    await h.advance(60 * 1000);
    assert.equal(h.showing(), null, 'a moment brought back by a catch-up started inside a sitting');
    sitting();
    stopHearing();
    assert.ok(heard >= 2, 'taking and letting go of a hold is not heard');
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'level-up', 'the moment waiting behind the sitting never played');

    // The page's hold: taken once, dropped unless an end card is to take it
    // over, and safe to let go twice.
    const held: string[] = [];
    const fake = createSettleHold(() => {
      held.push('take');
      return () => held.push('release');
    });
    fake.take();
    fake.take();
    assert.deepEqual(held, ['take'], 'holding twice held twice');
    fake.drop();
    assert.deepEqual(held, ['take', 'release'], 'a settle that never started kept the queue held');
    fake.take();
    fake.claim();
    fake.drop();
    assert.equal(fake.held, true, 'the hold an end card is to take over was dropped before the card came');
    fake.release();
    fake.release();
    assert.deepEqual(held, ['take', 'release', 'take', 'release'], 'a hold was let go twice, or never');
    // The page goes while its settle is still on its way: the hold goes with
    // it, and the settle answering afterwards takes none nobody could let go.
    fake.take();
    fake.close();
    fake.take();
    fake.claim();
    assert.equal(fake.held, false, 'a settle that answered after the page left held the queue for good');
    assert.deepEqual(held, ['take', 'release', 'take', 'release', 'take', 'release']);
    fake.open();
    fake.take();
    assert.equal(fake.held, true, 'a page that came back cannot hold the queue');
    fake.close();

    // Every sitting page holds while it is up and before it settles, and hands
    // the hold to its end card.
    const hook = flat('./useSittingEnd.ts');
    assert.match(region(hook, 'export function useSittingHold('), /useEffect\(\(\) => holdCelebrations\(\), \[\]\);/, 'a sitting page does not hold the queue while it is up');
    const end = region(hook, 'export function useSittingEnd(');
    assert.match(end, /useSittingHold\(\);/, 'a page that waits for its end card does not hold the queue while it is up');
    assert.match(end, /hold\.take\(\); hold\.claim\(\);/, 'naming the sitting does not hold the queue first');
    assert.match(end, /if \(end\.state === 'unsettled'\) hold\.release\(\);/, 'a sitting whose delta never came keeps the queue held');
    assert.match(end, /useEffect\(\(\) => \{ hold\.open\(\); return \(\) => hold\.close\(\); \}, \[hold\]\);/, 'leaving the page keeps the queue held');

    const drill = flat('../DrillScreen.tsx');
    const bank = region(drill, 'const persistGrades = useCallback(');
    assert.ok(before(bank, "if (state.finished) expect({ source: 'drill', at: endedAt });", 'void settleSitting('), 'the drill set settles before it holds the queue');
    const practice = drill.slice(drill.indexOf('const finishPractice = useCallback('), drill.indexOf('const persistGrades = useCallback('));
    assert.ok(before(practice, 'holdForSettle();', 'completePracticeSitting('), 'the practice set settles before it holds the queue');
    assert.match(practice, /else dropSettleHold\(\);/, 'a plan that settled nothing keeps the queue held');
    const review = flat('../ReviewScreen.tsx');
    assert.ok(before(review, "if (finished) expect({ source: 'review', at: endedAt });", 'void settleSitting('), 'the review settles before it holds the queue');
    const daily = flat('../daily/DailyPracticeScreen.tsx');
    assert.ok(before(daily, 'holdForSettle();', 'await beginSettle()'), 'today\'s phrase settles before it holds the queue');
    assert.match(daily, /finally \{ dropSettleHold\(\);/, 'today\'s phrase keeps the queue held when nothing settled');
    for (const [name, page] of [['DrillScreen', drill], ['ReviewScreen', review], ['DailyPracticeScreen', daily]] as const) {
      assert.match(page, /= useSittingEnd\(\);/, `${name} neither holds the queue while it is up nor waits for its end card`);
      const cards = page.match(/<EndCard\b[^>]*\/>/g) ?? [];
      assert.ok(cards.length > 0, `${name} draws no end card`);
      for (const card of cards) assert.match(card, /release=\{release\}/, `${name} never hands its hold to the end card`);
    }
    const nav = flat('../nav/RootNavigator.tsx');
    const lesson = region(nav, 'function LessonRoute(');
    assert.match(lesson, /useSittingHold\(\);/, 'the lesson does not hold the queue while it is up');
    assert.match(lesson, /useEffect\(\(\) => \{ endHold\.open\(\); return \(\) => endHold\.close\(\); \}, \[endHold\]\);/, 'leaving the lesson keeps the queue held');
    assert.ok(before(lesson, 'endHold.take();', "void settleSitting({ source: 'lesson'"), 'the lesson settles before it holds the queue');
    assert.match(lesson, /release=\{endHold\.release\}/, 'the lesson never hands its hold to the end card');
    assert.match(flat('../SummaryScreen.tsx'), /<EndCard delta=\{delta\} release=\{release\} \/>/);

    // The end card lets the handed hold go only when it goes.
    const endCard = flat('../celebrate/EndCard.tsx');
    assert.match(endCard, /useEffect\(\(\) => holdCelebrations\(\), \[\]\);/);
    assert.match(endCard, /useEffect\(\(\) => \(\) => handed\.current\?\.\(\), \[\]\);/, 'the end card never lets the handed hold go, or lets it go early');

    // The game layer puts off a foreground catch-up while the queue is held,
    // and runs it once the hold lifts.
    const provider = flat('../game/GameProvider.tsx');
    assert.match(provider, /if \(next !== 'active' \|\| !current\(\)\) return; if \(celebrationsHeld\(\)\) \{ owed = true; return; \} catchUpNow\(\);/, 'a return to the foreground catches up inside a sitting');
    assert.match(provider, /onCelebrationHoldChange\(\(\) => \{ if \(!owed \|\| celebrationsHeld\(\) \|\| !current\(\)\) return; owed = false; catchUpNow\(\); \}\)/, 'a catch-up put off for a sitting never runs');
    assert.match(provider, /offHolds\(\);/, 'the provider keeps listening to the holds after it goes');
  });
});
