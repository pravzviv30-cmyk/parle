/**
 * The celebration queue (F743): what plays after a sitting, in what order, how
 * often, and what stops it.
 *
 * The queue is pure, so these run it against a fake clock and fake stores: the
 * synced `seen` list, the phone's crash-replay queue and the scope generation.
 * The holds are the real ones (`holdCelebrations`, `suppressCelebrations`, the
 * audio focus holds), so a test that holds the queue is holding it the way a
 * sheet, a safety stop or a microphone does.
 */

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { holdLive, holdMic } from '../sound/audioFocus.ts';
import { sfxSuppressed } from '../sound/sfxGate.ts';
import {
  CELEBRATION_TTL_MS,
  MAX_TAKEOVERS,
  attachCelebrationListener,
  celebrationKey,
  discardBufferedCelebrations,
  publishCelebrations,
  type CelebrationEvent,
  type CelebrationOrigin,
} from './events.ts';
import {
  BADGES_PER_CARD,
  BURST_WINDOW_MS,
  MEMORY_LEDGER_LIMIT,
  RESUME_AFTER_MS,
  claimInPlace,
  createCelebrationQueue,
  createMemoryLedger,
  holdCelebrations,
  isShowable,
  planBurst,
  suppressCelebrations,
  type QueueDeps,
  type TakeoverCard,
} from './queue.ts';

const AT = 1_791_000_000_000;
const DAY = '2026-10-06';

function streak(day = DAY, current = 5, origin: CelebrationOrigin = 'account'): CelebrationEvent {
  return { type: 'streak-extended', key: celebrationKey.streak(day), origin, at: AT, data: { day, current, lifetimeDays: current + 10 } };
}
function milestone(n = 7, day = DAY): CelebrationEvent {
  const runStart = '2026-09-30';
  return { type: 'streak-milestone', key: celebrationKey.milestone(n, runStart), origin: 'account', at: AT, data: { day, current: n, lifetimeDays: 40, milestone: n, runStart } };
}
function chest(day = DAY, xp = 15): CelebrationEvent {
  return { type: 'quest-chest', key: celebrationKey.chest(day), origin: 'account', at: AT, data: { day, xp } };
}
function level(before: number, to: number): CelebrationEvent {
  return { type: 'level-up', key: celebrationKey.level(to), origin: 'account', at: AT, data: { before, level: to } };
}
function badge(id: string, origin: CelebrationOrigin = 'account'): CelebrationEvent {
  return { type: 'badge-earned', key: celebrationKey.badge(id), origin, at: AT, data: { id } };
}
function purchase(transactionId: string): CelebrationEvent {
  return { type: 'purchase-confirmed', key: celebrationKey.purchase(transactionId), origin: 'account', at: AT, data: { transactionId } };
}
function saved(phraseKey: string): CelebrationEvent {
  return { type: 'phrase-saved', key: celebrationKey.saved(phraseKey), origin: 'account', at: AT, data: { phraseKey } };
}

const running: (() => void)[] = [];
afterEach(() => {
  while (running.length > 0) running.pop()!();
});

/** A queue on a fake clock, over fake stores that record every write. */
function harness(options: { seen?: readonly string[]; unreadable?: boolean; slowMarks?: boolean } = {}) {
  let now = AT;
  let serial = 0;
  let generation = 1;
  let stops = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const seen = new Set(options.seen ?? []);
  const pending = new Set<string>();
  const marked: string[] = [];
  const dropped: string[] = [];
  const asked: string[] = [];
  // With slowMarks, a seen mark reaches the list only when the test lets the write land.
  const unlanded: (() => void)[] = [];
  const deps: QueueDeps = {
    now: () => now,
    setTimer: (run, ms) => {
      serial += 1;
      timers.set(serial, { at: now + ms, run });
      return serial;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    generation: () => generation,
    hasSeen: async (key) => {
      asked.push(key);
      if (options.unreadable) throw new Error('unreadable');
      return seen.has(key);
    },
    markSeen: async (marks) => {
      for (const mark of marks) marked.push(mark.key);
      const land = () => {
        for (const mark of marks) seen.add(mark.key);
      };
      if (!options.slowMarks) {
        land();
        return 'durable';
      }
      return new Promise((resolve) => {
        unlanded.push(() => {
          land();
          resolve('durable');
        });
      });
    },
    enqueuePending: async (items) => {
      for (const item of items) pending.add(item.key);
      return 'durable';
    },
    dropPending: async (keys) => {
      for (const key of keys) {
        pending.delete(key);
        dropped.push(key);
      }
      return 'durable';
    },
    stopEffects: () => {
      stops += 1;
    },
  };
  const queue = createCelebrationQueue(deps);
  running.push(queue.start());
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  async function advance(ms: number): Promise<void> {
    const until = now + ms;
    await flush();
    for (let fired = 0; ; fired += 1) {
      // A queue that keeps re-arming a timer at the same instant would spin a real phone too.
      assert.ok(fired < 1000, 'the queue re-arms a timer without end');
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
  const showing = (): TakeoverCard | null => queue.snapshot().current?.card ?? null;
  /** The card on screen reaches its final frame, then Continue. */
  async function playThrough(): Promise<TakeoverCard> {
    const card = showing();
    assert.ok(card, 'nothing is on screen to play through');
    queue.reachedFinal(card.id);
    queue.dismiss(card.id);
    await advance(RESUME_AFTER_MS);
    return card;
  }
  /** Every card the queue plays from here, in order. */
  async function playAll(): Promise<TakeoverCard[]> {
    const cards: TakeoverCard[] = [];
    while (showing() !== null && cards.length < 10) cards.push(await playThrough());
    return cards;
  }
  return {
    queue,
    advance,
    flush,
    showing,
    playThrough,
    playAll,
    seen,
    pending,
    marked,
    dropped,
    asked,
    stops: () => stops,
    signOut: () => {
      generation += 1;
    },
    /** Every seen mark still being written reaches the list. */
    landMarks: () => {
      while (unlanded.length > 0) unlanded.shift()!();
    },
  };
}

describe('the celebration queue — F743', () => {
  test('at most three takeovers play after a sitting, in streak, chest, level, badge order', async () => {
    const h = harness();
    // One sitting's moments, published in no particular order.
    const sitting = [badge('first-conversation'), level(3, 4), chest(), streak(), badge('streak-7')];
    h.queue.receive(sitting);
    await h.advance(BURST_WINDOW_MS);
    const cards = await h.playAll();
    assert.deepEqual(
      cards.map((card) => card.type),
      ['streak-extended', 'quest-chest', 'level-up'],
      'the takeovers play the streak, then the chest, then the level',
    );
    assert.equal(cards.length, MAX_TAKEOVERS, 'a fourth takeover played');
    assert.deepEqual(cards[0]!.also, [], 'a row sits on a card that is not the last');
    assert.deepEqual(
      cards[2]!.also.map((event) => event.key),
      [celebrationKey.badge('first-conversation'), celebrationKey.badge('streak-7')],
      'the badges past the budget are rows on the last card, in the order they were earned',
    );
    await h.flush();
    assert.deepEqual(new Set(h.marked), new Set(sitting.map((event) => event.key)), 'a moment that became a row is not remembered as played');
    assert.deepEqual([...h.pending], [], 'played moments stay in the crash-replay queue');

    // Three cards within the budget all play, badge last, and nothing becomes a row.
    const fits = harness();
    fits.queue.receive([badge('scene-own'), streak('2026-10-07'), level(4, 5)]);
    await fits.advance(BURST_WINDOW_MS);
    const played = await fits.playAll();
    assert.deepEqual(played.map((card) => card.type), ['streak-extended', 'level-up', 'badge-earned']);
    assert.ok(played.every((card) => card.also.length === 0));

    // A purchase confirmed in the same burst goes first.
    const paid = harness();
    paid.queue.receive([chest('2026-10-08'), purchase('regular.1793000000000'), streak('2026-10-08')]);
    await paid.advance(BURST_WINDOW_MS);
    assert.deepEqual((await paid.playAll()).map((card) => card.type), ['purchase-confirmed', 'streak-extended', 'quest-chest']);
  });

  test('a safety stop clears the celebration queue and refuses new moments', async () => {
    // A moment published before any host listened waits in the contract's buffer.
    discardBufferedCelebrations();
    publishCelebrations([streak('2026-10-05')]);

    const h = harness();
    h.queue.receive([streak(), chest(), level(1, 2)]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'streak-extended');
    assert.deepEqual(h.queue.waitingKeys(), [celebrationKey.chest(DAY), celebrationKey.level(2)]);
    assert.equal(h.pending.size, 3, 'the waiting moments were not written to the crash-replay queue');

    const stopsBefore = h.stops();
    const release = suppressCelebrations();
    assert.equal(h.showing(), null, 'the moment on screen kept playing over the safety stop');
    assert.deepEqual(h.queue.waitingKeys(), [], 'moments still wait behind the safety stop');
    assert.ok(h.stops() > stopsBefore, 'the stopped moment kept its haptics or its sound');
    assert.equal(sfxSuppressed(), true, 'sound effects can still play over the safety stop');
    await h.flush();
    assert.deepEqual([...h.pending], [], 'a cleared moment would come back from the crash-replay queue after the stop');
    assert.deepEqual(h.marked, [], 'a moment the stop cleared was remembered as played');

    const late: CelebrationEvent[] = [];
    const detach = attachCelebrationListener((events) => late.push(...events));
    detach();
    assert.deepEqual(late, [], 'a moment published before the host listened survived the safety stop');

    h.queue.receive([badge('first-conversation'), level(2, 3), saved('p-1')]);
    await h.advance(BURST_WINDOW_MS + RESUME_AFTER_MS + 1000);
    assert.equal(h.showing(), null, 'a new moment played while the safety stop was up');
    assert.deepEqual(h.queue.waitingKeys(), [], 'a new moment queued behind the safety stop');
    assert.equal(h.queue.snapshot().toast, null, 'a toast showed over the safety stop');

    release();
    release();
    assert.equal(sfxSuppressed(), false, 'sound effects stayed silent after the safety stop left');
    h.queue.receive([badge('scene-own')]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'badge-earned', 'the queue never came back after the safety stop left');
  });

  test('a moment already in the synced seen list never plays again', async () => {
    const h = harness({ seen: [celebrationKey.level(4)] });
    h.queue.receive([level(3, 4)]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing(), null, 'a level that already played on another device played again');
    assert.deepEqual(h.queue.waitingKeys(), []);
    assert.ok(h.dropped.includes(celebrationKey.level(4)), 'a crash-replay copy of a moment that already played was left behind');

    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS);
    const card = h.showing();
    assert.equal(card?.type, 'badge-earned');
    h.queue.reachedFinal(card!.id);
    await h.flush();
    assert.ok(h.seen.has(celebrationKey.badge('streak-7')), 'a moment that reached its final frame was not marked seen');
    h.queue.dismiss(card!.id);
    await h.advance(RESUME_AFTER_MS);

    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing(), null, 'a moment played twice on the device that played it');

    // Another device reading the same synced list.
    const other = harness({ seen: [...h.seen] });
    other.queue.receive([badge('streak-7')]);
    await other.advance(BURST_WINDOW_MS);
    assert.equal(other.showing(), null, 'a moment played again on a second device');

    // Skipped is played: Continue before the final frame still remembers it.
    h.queue.receive([chest('2026-10-09')]);
    await h.advance(BURST_WINDOW_MS);
    const skipped = h.showing();
    assert.equal(skipped?.type, 'quest-chest');
    h.queue.dismiss(skipped!.id);
    await h.flush();
    assert.ok(h.seen.has(celebrationKey.chest('2026-10-09')), 'a skipped moment was not remembered, so it would play again');

    // A list that cannot be read is never a reason to risk a second showing.
    const unreadable = harness({ unreadable: true });
    unreadable.queue.receive([level(5, 6)]);
    await unreadable.advance(BURST_WINDOW_MS);
    assert.equal(unreadable.showing(), null);
    assert.deepEqual(unreadable.dropped, [], 'a moment the store could not vouch for was dropped from the crash-replay queue');
  });

  test('moments that arrive within the burst window play as one burst, in order', async () => {
    const h = harness();
    h.queue.receive([level(2, 3)]);
    await h.advance(BURST_WINDOW_MS - 50);
    assert.equal(h.showing(), null, 'a moment started before the rest of its sitting could arrive');
    h.queue.receive([streak()]);
    await h.advance(BURST_WINDOW_MS - 1);
    assert.equal(h.showing(), null, 'the window did not wait for the moment that arrived inside it');
    await h.advance(1);
    assert.deepEqual((await h.playAll()).map((card) => card.type), ['streak-extended', 'level-up']);

    // A moment that arrives while a card is showing joins the burst and its budget.
    const running = harness();
    running.queue.receive([streak(), chest()]);
    await running.advance(BURST_WINDOW_MS);
    assert.equal(running.showing()?.type, 'streak-extended');
    running.queue.receive([level(1, 2), badge('streak-7')]);
    await running.advance(BURST_WINDOW_MS);
    const rest = await running.playAll();
    assert.deepEqual(rest.map((card) => card.type), ['streak-extended', 'quest-chest', 'level-up']);
    assert.deepEqual(rest[2]!.also.map((event) => event.key), [celebrationKey.badge('streak-7')], 'a late moment past the budget became a fourth takeover');
  });

  test('a moment that arrives during the third card becomes a row on it, never a fourth takeover', async () => {
    /** A run of three cards, with the third on screen. */
    async function third(h: ReturnType<typeof harness>): Promise<TakeoverCard> {
      h.queue.receive([streak(), chest(), level(3, 4)]);
      await h.advance(BURST_WINDOW_MS);
      await h.playThrough();
      await h.playThrough();
      const card = h.showing();
      assert.equal(card?.type, 'level-up');
      return card!;
    }

    // Still playing: the late moment joins the card on screen as a row.
    const h = harness();
    const last = await third(h);
    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS);
    const now = h.showing();
    assert.equal(now?.id, last.id, 'the third card was taken off the screen for the late moment');
    assert.deepEqual(now!.also.map((event) => event.key), [celebrationKey.badge('streak-7')], 'the late moment is not a row on the third card');
    assert.equal(h.queue.snapshot().current?.card, now, 'the frame was not told about its new row');
    h.queue.reachedFinal(now!.id);
    await h.flush();
    assert.ok(h.seen.has(celebrationKey.badge('streak-7')), 'a row on the final frame was not remembered as played');
    h.queue.dismiss(now!.id);
    await h.advance(RESUME_AFTER_MS + BURST_WINDOW_MS + 1000);
    assert.equal(h.showing(), null, 'a fourth takeover played after the third');
    assert.deepEqual(h.queue.waitingKeys(), []);

    // Already landed: the row is drawn on the final frame, so it is remembered at once.
    const landed = harness();
    const done = await third(landed);
    landed.queue.reachedFinal(done.id);
    landed.queue.receive([level(4, 5), badge('scene-own')]);
    await landed.advance(BURST_WINDOW_MS);
    assert.deepEqual(
      landed.showing()!.also.map((event) => event.key),
      [celebrationKey.level(5), celebrationKey.badge('scene-own')],
      'the late moments are not rows on the landed card, in order',
    );
    assert.ok(landed.seen.has(celebrationKey.level(5)) && landed.seen.has(celebrationKey.badge('scene-own')), 'a row added to a landed card was never remembered');
    assert.equal(landed.pending.has(celebrationKey.level(5)), false, 'a row already drawn would replay after a crash');
    landed.queue.dismiss(done.id);
    await landed.advance(RESUME_AFTER_MS + BURST_WINDOW_MS);
    assert.equal(landed.showing(), null, 'a fourth takeover played after the third');

    // After the third card has gone, before the run has ended: never a fourth card, and never remembered as played.
    const gap = harness();
    const gone = await third(gap);
    gap.queue.reachedFinal(gone.id);
    gap.queue.dismiss(gone.id);
    gap.queue.receive([badge('first-conversation')]);
    await gap.advance(RESUME_AFTER_MS + BURST_WINDOW_MS + 1000);
    assert.equal(gap.showing(), null, 'a fourth takeover played straight after the third');
    assert.equal(gap.seen.has(celebrationKey.badge('first-conversation')), false, 'a moment nobody saw was remembered as played');
    assert.ok(gap.pending.has(celebrationKey.badge('first-conversation')), 'a moment left for the catch-up lost its crash-replay copy');

    // The run has ended, so the next moment starts a burst of its own, and the one left behind can come back.
    gap.queue.receive([badge('first-conversation')]);
    await gap.advance(BURST_WINDOW_MS);
    assert.equal(gap.showing()?.type, 'badge-earned', 'the queue never started another burst after the budget was spent');

    // A spent budget belongs to the account that spent it, even before the sign-out reaches the queue.
    const next = harness();
    const theirs = await third(next);
    next.queue.reachedFinal(theirs.id);
    next.queue.dismiss(theirs.id);
    next.signOut();
    next.queue.receive([badge('scene-own', 'guest')]);
    await next.advance(RESUME_AFTER_MS + BURST_WINDOW_MS);
    assert.equal(next.showing()?.type, 'badge-earned', 'the account that left spent the next one\'s budget');
  });

  test('a moment published again while its seen mark is still being written plays once', async () => {
    const h = harness({ slowMarks: true });
    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS);
    const card = h.showing();
    assert.equal(card?.type, 'badge-earned');
    await h.playThrough();
    assert.equal(h.seen.has(celebrationKey.badge('streak-7')), false, 'the seen mark landed, so this test proves nothing');
    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS + RESUME_AFTER_MS);
    assert.equal(h.showing(), null, 'a moment played twice because its seen mark had not landed yet');
    h.landMarks();
    await h.flush();
    assert.ok(h.seen.has(celebrationKey.badge('streak-7')));
  });

  test('a hold pauses the queue and never drops a moment', async () => {
    const holds: [string, () => () => void][] = [
      ['a sheet or an end card', holdCelebrations],
      ['a microphone', holdMic],
      ['a live room', holdLive],
    ];
    for (const [what, take] of holds) {
      const h = harness();
      const release = take();
      h.queue.receive([streak()]);
      await h.advance(BURST_WINDOW_MS + 5000);
      assert.equal(h.showing(), null, `a moment started behind ${what}`);
      assert.deepEqual(h.queue.waitingKeys(), [celebrationKey.streak(DAY)], `${what} dropped the moment instead of pausing it`);
      release();
      await h.advance(0);
      assert.equal(h.showing()?.type, 'streak-extended', `the moment never played once ${what} let go`);
    }

    // The app leaving the screen holds it too, and it resumes after a short pause on return.
    const h = harness();
    h.queue.setActive(false);
    h.queue.receive([chest()]);
    await h.advance(BURST_WINDOW_MS + 5000);
    assert.equal(h.showing(), null, 'a moment started behind the app');
    h.queue.setActive(true);
    await h.advance(0);
    assert.equal(h.showing(), null, 'a moment started the instant the app came back, before the learner could see it');
    await h.advance(RESUME_AFTER_MS);
    assert.equal(h.showing()?.type, 'quest-chest');

    // A card already on screen when a hold begins lands on its final frame and stays.
    const before = h.stops();
    const release = holdMic();
    assert.equal(h.queue.snapshot().paused, true, 'the card on screen was not told to land');
    assert.ok(h.stops() > before, 'the card kept sounding while the microphone opened');
    assert.equal(h.showing()?.type, 'quest-chest', 'a hold took the card off the screen');
    release();
    assert.equal(h.queue.snapshot().paused, false);
  });

  test('a moment held past its time to live is dropped, and leaves the crash-replay queue', async () => {
    const h = harness();
    const release = holdMic();
    h.queue.receive([level(1, 2)]);
    await h.advance(BURST_WINDOW_MS);
    assert.ok(h.pending.has(celebrationKey.level(2)), 'a waiting moment is not in the crash-replay queue');
    await h.advance(CELEBRATION_TTL_MS - BURST_WINDOW_MS - 1);
    assert.deepEqual(h.queue.waitingKeys(), [celebrationKey.level(2)], 'a moment was dropped before its time');
    await h.advance(1);
    assert.deepEqual(h.queue.waitingKeys(), [], 'a moment waited past its time to live');
    assert.equal(h.pending.has(celebrationKey.level(2)), false, 'an expired moment would replay after a crash');
    release();
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing(), null, 'an expired moment played');
    assert.deepEqual(h.marked, [], 'an expired moment was remembered as played');
  });

  test('a milestone replaces the same day\'s streak moment, and badges share a card three at a time', async () => {
    const cards = planBurst([streak(DAY, 7), milestone(7, DAY)], MAX_TAKEOVERS);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!.type, 'streak-milestone', 'the plain streak moment played beside its milestone');
    assert.deepEqual(new Set(cards[0]!.covers.map((e) => e.key)), new Set([celebrationKey.streak(DAY), celebrationKey.milestone(7, '2026-09-30')]), 'the replaced streak moment would play later');

    const newest = planBurst([streak('2026-10-06', 5), streak('2026-10-05', 4)], MAX_TAKEOVERS);
    assert.equal(newest.length, 1, 'two streak days made two streak cards');
    assert.equal((newest[0]!.shows[0]!.data as { current: number }).current, 5, 'an older day\'s run was shown');
    const later = planBurst([streak('2026-10-07', 8), milestone(7, '2026-10-06')], MAX_TAKEOVERS);
    assert.equal(later[0]!.type, 'streak-extended', 'a milestone replaced a later day\'s run, so the card shows a run that has moved on');
    assert.equal(later[0]!.covers.length, 2);

    const ids = ['streak-7', 'first-conversation', 'scene-own', 'phrases-25', 'recall-100'];
    const badges = planBurst(ids.map((id) => badge(id)), MAX_TAKEOVERS);
    assert.deepEqual(badges.map((card) => card.shows.length), [BADGES_PER_CARD, 2]);
    assert.deepEqual(badges.flatMap((card) => card.shows.map((event) => (event.data as { id: string }).id)), ids);

    const levels = planBurst([level(2, 3), level(3, 4)], MAX_TAKEOVERS);
    assert.equal(levels.length, 1, 'two levels in one sitting made two cards');
    assert.deepEqual(levels[0]!.shows[0]!.data, { before: 2, level: 4 }, 'the merged level card does not run from the first level to the last');

    // The queue merges what arrives in one burst, and a duplicate never queues twice.
    const h = harness();
    h.queue.receive([streak(DAY, 7), milestone(7, DAY), streak(DAY, 7)]);
    await h.advance(BURST_WINDOW_MS);
    const played = await h.playAll();
    assert.deepEqual(played.map((card) => card.type), ['streak-milestone']);
  });

  test('a guest moment is remembered in memory only, and plays once', async () => {
    const h = harness();
    h.queue.receive([streak(DAY, 1, 'guest')]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'streak-extended');
    assert.deepEqual(h.asked, [], 'a guest moment was looked up in an account\'s seen list');
    assert.equal(h.pending.size, 0, 'a guest moment was written to an account\'s crash-replay queue');
    await h.playThrough();
    await h.flush();
    assert.deepEqual(h.marked, [], 'a guest moment was written to an account\'s seen list');
    h.queue.receive([streak(DAY, 1, 'guest')]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing(), null, 'a guest moment played twice');

    const ledger = createMemoryLedger(2);
    ledger.add('a');
    ledger.add('b');
    ledger.add('c');
    assert.equal(ledger.size, 2);
    assert.equal(ledger.has('a'), false, 'the in-memory ledger grows without a bound');
    assert.equal(ledger.has('c'), true);
    assert.equal(MEMORY_LEDGER_LIMIT, 256);
    assert.equal(claimInPlace('1:sitting:drill:1'), true);
    assert.equal(claimInPlace('1:sitting:drill:1'), false, 'an end card would sound twice for one sitting');
  });

  test('a saved phrase shows one toast, once, and none while a microphone is open', async () => {
    const h = harness();
    h.queue.receive([saved('p-1')]);
    const toast = h.queue.snapshot().toast;
    assert.equal(toast?.event.data.phraseKey, 'p-1', 'a durable save showed no toast');
    assert.equal(h.showing(), null, 'a saved phrase became a takeover');
    h.queue.toastDone(toast!.id);
    h.queue.receive([saved('p-1')]);
    assert.equal(h.queue.snapshot().toast, null, 'one phrase toasted twice');
    assert.deepEqual(h.marked, [], 'a saved phrase left the device in the seen list');

    const release = holdMic();
    h.queue.receive([saved('p-2')]);
    assert.equal(h.queue.snapshot().toast, null, 'a toast moved while the microphone was open');
    release();
  });

  test('signing out clears the queue and writes nothing to the account that left', async () => {
    const h = harness();
    h.queue.receive([streak(), chest()]);
    await h.advance(BURST_WINDOW_MS);
    const card = h.showing();
    assert.equal(card?.type, 'streak-extended');
    const writes = h.marked.length + h.dropped.length;
    h.signOut();
    // The card lands just after the account changed, before the reset reaches the queue.
    h.queue.reachedFinal(card!.id);
    await h.flush();
    assert.equal(h.marked.length + h.dropped.length, writes, 'a moment that played for one account was written to the next');
    h.queue.reset();
    assert.equal(h.showing(), null, 'one account\'s moment played on after sign-out');
    assert.deepEqual(h.queue.waitingKeys(), []);
    await h.flush();
    assert.equal(h.marked.length + h.dropped.length, writes, 'the queue wrote to a store after the account changed');

    h.queue.receive([badge('streak-7')]);
    await h.advance(BURST_WINDOW_MS);
    assert.equal(h.showing()?.type, 'badge-earned', 'the next account\'s moments never played');
  });

  test('a moment that cannot be shown whole is dropped rather than drawn with a gap', () => {
    assert.equal(isShowable(badge('streak-7')), true);
    assert.equal(isShowable(badge('no-such-badge')), false, 'a badge with no name would draw an empty card');
    assert.equal(isShowable(level(4, 4)), false, 'a level that did not rise would say Level 4 again');
    assert.equal(isShowable(streak('not-a-day')), false);
    const fractional: CelebrationEvent = { type: 'quest-chest', key: celebrationKey.chest(DAY), origin: 'account', at: AT, data: { day: DAY, xp: 1.5 } };
    assert.equal(isShowable(fractional), false, 'a chest with a fractional reward would show a made-up number');
    assert.equal(isShowable(purchase('')), false, 'a purchase with no confirmed grant behind it played');
    assert.equal(isShowable(saved('p-1')), true);
  });

  test('a safety stop during a seen read drops that moment\'s crash-replay copy too', async () => {
    // F766. A catch-up brings a moment back with its copy already on this
    // phone; the stop arrives while the queue is still asking the synced list
    // about it. The answer that lands after the stop is ignored, so unless the
    // stop drops the copy, the moment replays on the next launch.
    const timers = new Set<() => void>();
    const answers: ((seen: boolean) => void)[] = [];
    const pending = new Set<string>([celebrationKey.level(3), celebrationKey.badge('streak-7')]);
    const queue = createCelebrationQueue({
      now: () => AT,
      setTimer: (run) => {
        timers.add(run);
        return run;
      },
      clearTimer: (handle) => {
        timers.delete(handle as () => void);
      },
      generation: () => 1,
      hasSeen: () => new Promise<boolean>((resolve) => answers.push(resolve)),
      markSeen: async () => 'durable',
      enqueuePending: async (items) => {
        for (const item of items) pending.add(item.key);
        return 'durable';
      },
      dropPending: async (keys) => {
        for (const key of keys) pending.delete(key);
        return 'durable';
      },
      stopEffects: () => {},
    });
    running.push(queue.start());
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

    queue.receive([level(2, 3), badge('streak-7')]);
    assert.equal(answers.length, 2, 'the queue did not ask the synced list about the moments');
    const release = suppressCelebrations();
    await flush();
    assert.deepEqual([...pending], [], 'a moment whose seen read was in flight kept its crash-replay copy through the safety stop');
    // The reads answer after the stop: nothing comes back, and nothing is written back either.
    for (const answer of answers) answer(false);
    await flush();
    await flush();
    assert.deepEqual(queue.waitingKeys(), [], 'a moment read after the stop came back');
    assert.equal(queue.snapshot().current, null);
    assert.deepEqual([...pending], [], 'a moment read after the stop was queued for replay again');
    release();
  });
});
