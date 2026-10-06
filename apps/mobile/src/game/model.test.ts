/**
 * The game layer's facts and their merge, held to what `model.ts` claims (F729).
 *
 * The centrepiece is a property test: generated blobs with colliding copies of
 * the same row, spans longer than every age window and lists longer than every
 * bound, merged in both orders, in both groupings and against themselves. The
 * rest pins the individual rules a later reader would otherwise have to take on
 * trust: which of two covers keeps a day, that a badge is never taken back,
 * that a rollup only rises, and that the largest blob the bounds allow still
 * fits one sync envelope.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { QUEST_XP, addDays } from '@luvani/core';

import { MAX_ENVELOPE_BYTES, envelopeBytes, sameData, sealEnvelope, stableStringify } from '../sync/envelope.ts';
import { fullGame } from './capacityFixture.ts';
import {
  CLAIM_KEEP_DAYS,
  GAME_VERSION,
  MAX_COVERS,
  MAX_GAME_TIME,
  MAX_SEEN,
  MAX_SITTING_ACTIVE_MS,
  SEEN_KEEP_DAYS,
  SITTING_KEEP_DAYS,
  emptyGame,
  isDaySeenKey,
  isSeenKey,
  mergeGame,
  readGame,
  seenDay,
  withGameRows,
  type StoredGame,
} from './model.ts';

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 0, 1, 12);
const TODAY = '2026-01-01';

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

type Chooser = ReturnType<typeof chooser>;

/**
 * A blob a device might hold. Narrow id pools and a span past every age window,
 * so two copies of one row and a row on each side of a cutoff are both common.
 * `scale` grows the lists past the bounds for the test that needs them to.
 */
function genGame(pick: Chooser, scale = 1): StoredGame {
  const day = (span: number): string => addDays(TODAY, pick.int(span));
  const at = (span: number): number => BASE + pick.int(span) * DAY + pick.int(3) * 1000;
  const n = (k: number): number => pick.int(k * scale);
  const quests = ['finish-practice', 'phrase-of-day', 'minutes', 'xp', 'goal', 'conversation'] as const;
  return {
    version: 1,
    sittings: Array.from({ length: n(8) }, () => {
      const row = { at: at(120), source: pick.one(['phrase', 'drill', 'review', 'guest'] as const) };
      return pick.bool() ? { ...row, activeMs: pick.int(4) * 1000 } : row;
    }),
    covers: Array.from({ length: n(6) }, () => ({ day: day(40), kind: pick.one(['freeze', 'repair', 'travel'] as const), at: at(3) })),
    goalDays: Array.from({ length: n(6) }, () => day(80)),
    questDays: Array.from({ length: n(6) }, () => ({
      day: day(90),
      ids: pick.bool() ? (['finish-practice', 'phrase-of-day', 'minutes'] as ['finish-practice', 'phrase-of-day', 'minutes']) : (['practise-twice', 'conversation', 'xp'] as ['practise-twice', 'conversation', 'xp']),
      at: at(2),
    })),
    claims: Array.from({ length: n(10) }, () => ({ day: day(130), questId: pick.one(quests), xp: QUEST_XP, at: at(2) })),
    questMonths: Array.from({ length: n(3) }, () => ({ month: pick.one(['2026-01', '2026-02', '2026-03']), count: pick.int(40), xp: pick.int(500) })),
    xpMonths: Array.from({ length: n(3) }, () => ({ month: pick.one(['2026-01', '2026-02']), xp: pick.int(3000) })),
    bonus: Array.from({ length: n(6) }, () => {
      const key = pick.bool() ? `phrase:${day(130)}` : `review:${BASE + pick.int(130) * DAY}`;
      return { key, xp: pick.one([5, 5, 6]), at: at(3) };
    }),
    bonusMonths: Array.from({ length: n(2) }, () => ({ month: pick.one(['2026-01', '2026-03']), xp: pick.int(200) })),
    badges: Array.from({ length: n(4) }, () => ({ id: pick.one(['streak-7', 'goal-7', 'quests-2026-01', 'a-badge-from-a-newer-build']), at: pick.bool() ? null : at(5) })),
    seen: Array.from({ length: n(8) }, () => {
      const key = pick.bool()
        ? `streak:${day(130)}`
        : pick.one(['level:2', 'level:3', 'badge:streak-7', `milestone:100:${day(130)}`, 'purchase:GPA.3372-1234-5678-90123..0']);
      return { key, at: at(4) };
    }),
  };
}

const merge = (a: unknown, b: unknown): StoredGame => mergeGame(a, b);

describe('the game facts merge — F729', () => {
  test('every game merge rule is a set union or a max: commutative, associative and idempotent', () => {
    for (const scale of [1, 60]) {
      for (let seed = 1; seed <= (scale === 1 ? 300 : 12); seed += 1) {
        const pick = chooser(seed * 31 + scale);
        const a = genGame(pick, scale);
        const b = genGame(pick, scale);
        const c = genGame(pick, scale);
        const ab = merge(a, b);
        assert.ok(sameData(ab, merge(b, a)), `seed ${seed}x${scale}: depends on which device asked`);
        assert.ok(sameData(merge(ab, ab), ab), `seed ${seed}x${scale}: not idempotent`);
        assert.ok(sameData(merge(ab, merge(b, a)), ab), `seed ${seed}x${scale}: keeps moving after both sides agree`);
        const left = merge(ab, c);
        const right = merge(a, merge(b, c));
        assert.ok(sameData(left, right), `seed ${seed}x${scale}: grouping changed the answer\n${stableStringify(left)}\n${stableStringify(right)}`);
        // And what the merge produces, the strict reader reads unchanged.
        assert.ok(sameData(readGame(ab), ab), `seed ${seed}x${scale}: the store would refuse or rewrite the merge`);
      }
    }
  });

  test('a game blob at every cap still fits one sync envelope', () => {
    const full = fullGame(Date.UTC(2026, 9, 5, 12));
    const read = readGame(full);
    assert.ok(read !== null && read !== 'newer', 'the capacity fixture is not a blob this build would write');
    // Nothing in the fixture is over a bound, so reading it keeps every row.
    for (const field of Object.keys(full) as (keyof StoredGame)[]) {
      if (field === 'version') continue;
      assert.equal((read[field] as unknown[]).length, (full[field] as unknown[]).length, `${field} lost rows to a bound the fixture claims to sit at`);
    }
    const bytes = envelopeBytes(sealEnvelope(read, 'a-device-id-of-realistic-length', Date.now()));
    assert.ok(bytes !== null && bytes <= MAX_ENVELOPE_BYTES, `a full game blob is ${bytes} bytes, over the ${MAX_ENVELOPE_BYTES}-byte envelope, so it could never be pushed`);
    // The fixture is the ceiling only if nothing wider reads. A duration is the
    // one number JSON could otherwise widen without limit (1e308 is 23
    // characters here and 309 digits in the server's rendering of it).
    const sitting = full.sittings[0]!;
    for (const activeMs of [MAX_SITTING_ACTIVE_MS + 1, 1e308, 1.5, -1]) {
      assert.equal(readGame({ ...full, sittings: [{ ...sitting, activeMs }] }), null, `an active time of ${activeMs} read`);
    }
    assert.equal(readGame({ ...full, sittings: [{ ...sitting, at: MAX_GAME_TIME + 1 }] }), null, 'a moment past the last a date can hold read');
    // Adding one more of anything bounded does not grow it: the bound holds on write.
    const grown = withGameRows(read, { covers: [{ day: addDays(read.covers.at(-1)!.day, 1), kind: 'travel', at: BASE }] });
    assert.equal(grown.covers.length, MAX_COVERS);
    assert.ok((envelopeBytes(sealEnvelope(grown, 'a-device-id-of-realistic-length', Date.now())) ?? Infinity) <= MAX_ENVELOPE_BYTES);
  });

  test('two covers for one day keep the earliest written, then travel before repair before freeze', () => {
    const day = '2026-01-05';
    const one = (kind: 'freeze' | 'repair' | 'travel', at: number) => ({ ...emptyGame(), covers: [{ day, kind, at }] });
    assert.deepEqual(merge(one('freeze', 5), one('travel', 9)).covers, [{ day, kind: 'freeze', at: 5 }]);
    assert.deepEqual(merge(one('freeze', 5), one('repair', 5)).covers, [{ day, kind: 'repair', at: 5 }]);
    assert.deepEqual(merge(one('repair', 5), one('travel', 5)).covers, [{ day, kind: 'travel', at: 5 }]);
  });

  test('a measured sitting wins its pick, and sittings age out sixty days behind the newest', () => {
    const plain = { at: BASE, source: 'phrase' as const };
    const timed = { ...plain, activeMs: 42_000 };
    assert.deepEqual(merge({ ...emptyGame(), sittings: [plain] }, { ...emptyGame(), sittings: [timed] }).sittings, [timed]);
    const old = { at: BASE - (SITTING_KEEP_DAYS + 1) * DAY, source: 'drill' as const };
    assert.deepEqual(merge({ ...emptyGame(), sittings: [old] }, { ...emptyGame(), sittings: [plain] }).sittings, [plain]);
  });

  test('a badge counted from older practice gives way to a dated award, and no merge drops one', () => {
    const counted = { ...emptyGame(), badges: [{ id: 'streak-7', at: null }] };
    const dated = { ...emptyGame(), badges: [{ id: 'streak-7', at: BASE + 9 }] };
    const earlier = { ...emptyGame(), badges: [{ id: 'streak-7', at: BASE + 2 }] };
    assert.deepEqual(merge(counted, dated).badges, [{ id: 'streak-7', at: BASE + 9 }]);
    assert.deepEqual(merge(merge(counted, dated), earlier).badges, [{ id: 'streak-7', at: BASE + 2 }]);
    // An id this build cannot draw is still an award somebody earned.
    const future = { ...emptyGame(), badges: [{ id: 'a-badge-from-a-newer-build', at: BASE }] };
    assert.deepEqual(merge(future, emptyGame()).badges.map((b) => b.id), ['a-badge-from-a-newer-build']);
    // And no window ages one out, however much newer the rest of the blob is.
    const later = { ...emptyGame(), sittings: [{ at: BASE + 900 * DAY, source: 'review' as const }], seen: [{ key: `streak:${addDays(TODAY, 900)}`, at: BASE }] };
    assert.deepEqual(merge(merge(counted, later), dated).badges, [{ id: 'streak-7', at: BASE + 9 }]);
  });

  test('claims and fixed XP roll into their months on a local write, and a month never falls', () => {
    const claim = (day: string, questId: 'finish-practice' | 'minutes' | 'goal') => ({ day, questId, xp: QUEST_XP, at: BASE });
    let game = withGameRows(emptyGame(), { claims: [claim('2026-01-03', 'finish-practice'), claim('2026-01-03', 'minutes'), claim('2026-01-03', 'goal')] });
    assert.deepEqual(game.questMonths, [{ month: '2026-01', count: 3, xp: 3 * QUEST_XP }], 'a claim went uncounted');
    // D22: the third quest of a day is one more quest, never a chest; a chest claim is refused like any row this build would not write.
    assert.equal(withGameRows(game, { claims: [{ day: '2026-01-03', questId: 'chest' as 'goal', xp: 15, at: BASE }] }).claims.length, 3);
    game = withGameRows(game, { bonus: [{ key: 'phrase:2026-01-03', xp: 5, at: BASE }, { key: `review:${BASE}`, xp: 5, at: BASE }] });
    assert.deepEqual(game.bonusMonths, [{ month: '2026-01', xp: 10 }]);
    // A claim far later ages January's claims out; the months keep what they counted.
    const later = addDays('2026-01-03', CLAIM_KEEP_DAYS + 10);
    game = withGameRows(game, { claims: [claim(later, 'finish-practice')], bonus: [{ key: `phrase:${later}`, xp: 5, at: BASE }] });
    assert.ok(game.claims.every((c) => c.day === later), 'a claim older than the window survived');
    assert.ok(game.bonus.every((b) => b.key === `phrase:${later}`), 'a bonus older than the window survived');
    assert.deepEqual(game.questMonths.find((m) => m.month === '2026-01'), { month: '2026-01', count: 3, xp: 3 * QUEST_XP }, 'the month fell when its claims aged out');
    assert.deepEqual(game.bonusMonths.find((m) => m.month === '2026-01'), { month: '2026-01', xp: 10 });
    // A merge takes each month's larger figure, field by field, and never adds.
    const low = { ...emptyGame(), questMonths: [{ month: '2026-01', count: 1, xp: 90 }] };
    assert.deepEqual(merge(game, low).questMonths.find((m) => m.month === '2026-01'), { month: '2026-01', count: 3, xp: 90 });
  });

  test('a fixed-XP key aged out on one device cannot come back from a third', () => {
    const old = { key: 'phrase:2026-01-01', xp: 5, at: BASE };
    const newest = { key: `phrase:${addDays(TODAY, 100)}`, xp: 5, at: BASE + 100 * DAY };
    const a = { ...emptyGame(), bonus: [old] };
    const b = { ...emptyGame(), bonus: [newest] };
    const c = { ...emptyGame(), bonus: [{ ...old, at: BASE + 99 * DAY }] };
    const left = merge(merge(a, b), c);
    assert.ok(sameData(left, merge(a, merge(b, c))));
    assert.deepEqual(left.bonus, [newest]);
  });

  test('celebrations with a day age out sixty days behind the newest; the rest are kept for good', () => {
    const marks = [
      { key: 'streak:2026-01-01', at: BASE },
      { key: `streak:${addDays(TODAY, SEEN_KEEP_DAYS + 5)}`, at: BASE },
      { key: 'level:4', at: BASE },
    ];
    const kept = merge({ ...emptyGame(), seen: marks }, null).seen.map((s) => s.key);
    assert.deepEqual(kept.sort(), ['level:4', `streak:${addDays(TODAY, SEEN_KEEP_DAYS + 5)}`].sort());
    // Over the bound, the day-scoped keys go first, oldest day first, and a durable key is the last to go.
    const days = Array.from({ length: SEEN_KEEP_DAYS }, (_, i) => addDays(TODAY, i));
    const dated = days.map((d) => ({ key: `streak:${d}`, at: BASE }));
    const durable = Array.from({ length: MAX_SEEN - 10 }, (_, i) => ({ key: `level:${i + 2}`, at: BASE }));
    const bounded = merge({ ...emptyGame(), seen: [...dated, ...durable] }, null).seen;
    assert.equal(bounded.length, MAX_SEEN);
    assert.ok(durable.every((d) => bounded.some((s) => s.key === d.key)), 'a durable celebration was dropped to make room for dated ones');
    assert.ok(bounded.some((s) => s.key === `streak:${days.at(-1)}`) && !bounded.some((s) => s.key === `streak:${days[0]}`), 'the bound kept an older day over a newer one');
  });

  test('a milestone mark is kept for good though its key holds a date, and only streak and chest keys are day-scoped', () => {
    // The 100-day milestone is written once and must never play again, so its
    // key is durable whichever order its parts are in. Under a rule that read
    // "a date second means day-scoped", the second spelling aged out the moment
    // it was written and the milestone replayed.
    const runStart = '2026-01-01';
    const milestones = [{ key: `milestone:100:${runStart}`, at: BASE }, { key: `milestone:${runStart}:100`, at: BASE }];
    const later = addDays(TODAY, 400);
    const lateStreak = { key: `streak:${later}`, at: BASE + 400 * DAY };
    const merged = merge({ ...emptyGame(), seen: milestones }, { ...emptyGame(), seen: [lateStreak] });
    assert.deepEqual(merged.seen.map((s) => s.key).sort(), [...milestones.map((m) => m.key), lateStreak.key].sort(), 'a milestone mark aged out, so it would play again');
    assert.deepEqual(withGameRows(merged, { seen: [{ key: `streak:${addDays(later, 1)}`, at: BASE }] }).seen.length, 4);

    // D22: the streak is the only day-scoped kind; the retired chest kind is not day-scoped and is refused.
    assert.equal(isDaySeenKey('streak:2026-10-05'), true);
    assert.equal(isDaySeenKey('chest:2026-10-05'), false);
    for (const key of ['milestone:100:2026-10-05', 'level:5', 'badge:streak-7', 'purchase:2000000123456789', 'quest:2026-10-05:xp']) {
      assert.equal(isDaySeenKey(key), false, `${key} was treated as day-scoped`);
      assert.equal(seenDay(key), null);
    }
    // Every key the Phase 1 table can make for a persisted moment reads, a store
    // transaction id included; nothing with a space in it does, and a day-scoped
    // kind without a real day is not a key.
    for (const key of ['purchase:GPA.3372-1234-5678-90123..0', 'purchase:2000000123456789', `milestone:365:${runStart}`, 'level:12', 'badge:streak-7', 'streak:2026-10-05']) {
      assert.equal(isSeenKey(key), true, `${key} was refused`);
    }
    for (const key of ['saved:Bonjour tout le monde', 'streak:yesterday', 'chest:2026-02-30', 'chest:2026-10-05', 'chest', 'streak', 'Level:2', `level:${'9'.repeat(60)}`]) {
      assert.equal(isSeenKey(key), false, `${key} was accepted`);
    }
  });

  test('the version this build writes is the one the merge writes', () => {
    assert.equal(merge(null, null).version, GAME_VERSION);
    assert.equal(readGame({ ...emptyGame(), version: GAME_VERSION + 1 }), 'newer');
  });
});
