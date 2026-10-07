/**
 * Every number on a finished sitting's end card is one the settle pipeline
 * read back from disk (F760; README Part 6, "numbers only from the GameDelta").
 *
 * The pipeline runs for real here, against an in-memory disk, the way
 * `game/practiceSettle.test.ts` runs it, and the end card's model
 * (`celebrate/endCardModel.ts`) is fed what the page's watch picked out. The
 * cap is the sharp case: the drill priced its sitting at 20 XP, the day had
 * room for 5, and the card says 5, because 5 is what landed. Then the five
 * pages are read as text, because there is no renderer in this workspace
 * (docs/TESTING.md), to hold them to drawing only that delta.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  answerCurrent,
  buildPracticeSession,
  newCard,
  phraseKeyOf,
  type DrillExercise,
  type DrillSessionState,
  type PracticeTarget,
  type ReviewCard,
} from '@luvani/core';

import { endCardView } from '../celebrate/endCardModel.ts';
import { GAME_COPY } from '../game/copy.ts';
import type { GameDelta } from '../game/delta.ts';
import { configureGameEnvironment, onSettleChain, onSettled, settleSitting } from '../game/settle.ts';
import { NO_OUTSIDE_FACTS } from '../game/view.ts';
import { loadActivity, recordActivity } from '../progress/activity.ts';
import { activeUserId, setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { completePracticeSitting } from './completion.ts';
import { SETTLE_WAIT_MS, createDeltaWatch, matchesSitting, sittingEnd, sittingKey, type DeltaWatch } from './sittingDelta.ts';

interface Disk {
  map: Map<string, string>;
  /** Key suffixes whose setItem rejects, as a full phone does. */
  full: Set<string>;
}

function installDisk(): Disk {
  const disk: Disk = { map: new Map(), full: new Set() };
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => disk.map.get(key) ?? null;
  shared.setItem = async (key: string, value: string): Promise<void> => {
    if ([...disk.full].some((suffix) => key.endsWith(`.${suffix}`))) throw new Error('QuotaExceededError');
    disk.map.set(key, value);
  };
  shared.removeItem = async (key: string): Promise<void> => {
    disk.map.delete(key);
  };
  shared.multiRemove = async (keys: string[]): Promise<void> => {
    for (const key of keys) disk.map.delete(key);
  };
  return disk;
}

const MINUTE = 60_000;
const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const flat = (relative: string): string =>
  read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');

let uids = 0;
let disk: Disk;
let clock = 0;
let restore: () => void = () => {};
let stop: () => void = () => {};
let watch: DeltaWatch;
let heard: GameDelta[] = [];

/** Every settle already asked for has run. */
const settled = (): Promise<void> => onSettleChain(async () => {});

/** A finished drill set settled the way DrillScreen settles it: its activity entry is its write. */
function settleDrill(at: number, xp: number, activeMs: number) {
  return settleSitting({
    source: 'drill',
    at,
    xpEarned: xp,
    activeMs,
    write: () => recordActivity('drill', xp, at, { durationMs: activeMs, activeMs, finished: true }),
  });
}

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  setActiveUser(`88888888-8888-4888-8888-${String(++uids).padStart(12, '0')}`);
  clock = new Date(2026, 9, 6, 15, 0, 0).getTime();
  restore = configureGameEnvironment({
    now: () => clock,
    billing: () => Promise.resolve(null),
    canRecord: () => Promise.resolve(true),
    outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: 10 }),
  });
  watch = createDeltaWatch();
  heard = [];
  // The page's subscription, taken before any sitting finishes.
  stop = onSettled((delta) => {
    heard.push(delta);
    watch.push(delta);
  });
});

afterEach(() => {
  stop();
  restore();
});

describe('an end card is the settle pipeline\'s read-back — F760', () => {
  test('an end card shows only numbers the settle pipeline read back', async () => {
    // A finished drill set: 12 XP, four minutes of work.
    const at = clock;
    const returned = await settleDrill(at, 12, 4 * MINUTE);
    await settled();
    const match = { source: 'drill', at } as const;
    const delta = watch.find(match);
    assert.ok(delta !== null, 'the page never heard its own sitting settle');
    assert.deepEqual(delta, returned, 'the page drew a delta other than the one the settle returned');
    assert.equal(delta.key, sittingKey(match), 'the page found its sitting by something other than the key the settle gave it');
    const card = endCardView(delta, { count: 3 });
    const tile = (id: string) => card.tiles.find((t) => t.id === id)?.value ?? null;
    // XP: what the activity log on disk now holds for this sitting.
    const stored = (await loadActivity({ strict: true })).filter((entry) => entry.at === at);
    assert.equal(stored.length, 1);
    assert.equal(tile('xp'), stored[0]!.xp);
    assert.equal(tile('xp'), delta.xp.counted + delta.xp.bonus);
    assert.equal(tile('time'), 4 * 60, 'the time tile is not the sitting\'s measured time');
    assert.equal(tile('count'), 3);
    // The goal ring is the delta's minutes against the learner's goal.
    assert.deepEqual(card.goal, { from: 0, to: 0.4, line: GAME_COPY.goal.progress(4, 10) });
    assert.equal(sittingEnd(match, delta, false).state, 'settled');

    // At the daily cap: the drill priced its sitting at 20, the day had room
    // for 5, and the card says 5, because 5 is what the read-back credited.
    clock += 10 * MINUTE;
    await recordActivity('drill', 83, clock - MINUTE, { finished: true });
    const capAt = clock;
    await settleDrill(capAt, 20, 2 * MINUTE);
    await settled();
    const capped = watch.find({ source: 'drill', at: capAt });
    assert.ok(capped !== null);
    assert.equal(capped.xp.earned, 20);
    assert.equal(capped.xp.counted, 5, 'the settle credited more than the day had room for');
    const capCard = endCardView(capped);
    assert.equal(capCard.tiles.find((t) => t.id === 'xp')?.value, 5, 'the card shows the XP the page priced, not the XP that landed');
    assert.equal(capCard.capLine, GAME_COPY.endCard.capLine);

    // A write the phone refused settles nothing: the page waits, then shows
    // the finish in words, with no number it cannot vouch for.
    disk.full.add('activity');
    clock += MINUTE;
    const refusedAt = clock;
    assert.equal(await settleDrill(refusedAt, 12, MINUTE), null);
    await settled();
    const refused = { source: 'drill', at: refusedAt } as const;
    assert.equal(watch.find(refused), null, 'a refused write published a delta');
    assert.deepEqual(sittingEnd(refused, null, false), { state: 'waiting' });
    assert.deepEqual(sittingEnd(refused, null, true), { state: 'unsettled' });
    assert.ok(SETTLE_WAIT_MS > 0 && SETTLE_WAIT_MS <= 5000, 'the page waits too long, or not at all, for its numbers');

    // A delta for another sitting is never drawn on this one.
    assert.equal(matchesSitting(delta, { source: 'review', at }), false);
    assert.equal(matchesSitting(delta, { source: 'drill', at: at + 1 }), false);
    assert.deepEqual(sittingEnd({ source: 'review', at }, delta, false), { state: 'waiting' });
    assert.deepEqual(sittingEnd(null, delta, false), { state: 'none' });

    // The five pages draw only that delta. Each page waits for exactly the
    // sitting it settles, and hands the end card the delta and nothing priced.
    const drill = flat('../DrillScreen.tsx');
    assert.match(drill, /if \(state\.finished\) expect\(\{ source: 'drill', at: endedAt \}\); if \(state\.finished\) void settleSitting\(\{ source: 'drill', at: endedAt,/, 'the drill set waits for a sitting other than the one it settles');
    assert.match(drill, /if \(done\.settlesAt !== null\) expect\(\{ source: 'drill', at: done\.settlesAt \}\);/, 'the practice set waits for a sitting other than the one its plan settled');
    const review = flat('../ReviewScreen.tsx');
    assert.match(review, /if \(finished\) expect\(\{ source: 'review', at: endedAt \}\); if \(finished\) void settleSitting\(\{ source: 'review', at: endedAt,/);
    const daily = flat('../daily/DailyPracticeScreen.tsx');
    assert.match(daily, /if \(ack === 'durable'\) expect\(\{ source: 'phrase', at \}\); if \(ack === 'durable'\) void finishSettle\(settling, \{ source: 'phrase', at,/);
    const nav = flat('../nav/RootNavigator.tsx');
    assert.match(
      nav,
      /\}\)\.then\(\(settled\) => \{ if \(mine !== finishes\.current\) return; if \(settled !== null && ownsLesson\(\)\) setDelta\(settled\); else endHold\.release\(\); \}\);/,
      'the lesson\'s end card is fed something other than the delta its own settle returned',
    );
    assert.match(nav, /delta=\{delta\}/);
    const cards = [
      ...[...drill.matchAll(/<EndCard\b[^>]*\/>/g)].map((m) => m[0]),
      ...[...review.matchAll(/<EndCard\b[^>]*\/>/g)].map((m) => m[0]),
      ...[...daily.matchAll(/<EndCard\b[^>]*\/>/g)].map((m) => m[0]),
      ...[...flat('../SummaryScreen.tsx').matchAll(/<EndCard\b[^>]*\/>/g)].map((m) => m[0]),
    ];
    assert.deepEqual(cards, [
      '<EndCard delta={end.delta} release={release} />',
      '<EndCard delta={end.delta} count={s.resolved} release={release} />',
      '<EndCard delta={end.delta} count={recalled.current} release={release} />',
      '<EndCard delta={end.delta} count={end.delta.streak.after.lifetimeDays} release={release} />',
      '<EndCard delta={delta} release={release} />',
    ], 'an end card is drawn from something other than the settled delta');
    for (const page of [drill, review, daily]) {
      assert.match(page, /const \{ end,[^}]*\bexpect\b[^}]*\} = useSittingEnd\(\);/, 'a page waits for its numbers some other way');
      assert.match(page, /end\.state === 'settled'/, 'a page draws its end card before the settle answered');
    }
  });

  test('a practice plan names the sitting it settled, and the page finds that delta', async () => {
    const PHRASES = ['Un café, s’il vous plaît', 'Bonjour', 'Merci beaucoup'];
    const BANK: DrillExercise[] = PHRASES.map(
      (fr, index) => ({ id: `pack:p:en-fr:${index}`, kind: 'translate', direction: 'en-fr', phraseKey: phraseKeyOf(fr), difficulty: 'production', fr, en: `english ${index}`, accepted: [fr] }) as DrillExercise,
    );
    const targets: PracticeTarget[] = PHRASES.map((fr, i) => ({ phraseKey: phraseKeyOf(fr), source: { kind: 'pack', packId: 'p' }, exerciseId: BANK[i]!.id, scheduled: true }));
    const deck: ReviewCard[] = PHRASES.map((fr) => ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, clock - 86_400_000), due: clock - 1000 }));
    // The deck the plan grades, written where the review store reads it.
    disk.map.set(`luvani.u.${activeUserId()}.review`, JSON.stringify(deck));
    const built = buildPracticeSession(targets, BANK, deck, clock);
    let state: DrillSessionState = built.state;
    for (let guard = 0; guard < 20 && !state.finished; guard += 1) state = answerCurrent(state, (state.queue[0] as { fr: string }).fr).state;
    assert.ok(state.finished);

    const done = await completePracticeSitting({ sittingId: 's-end', state, targets: built.targets, exercises: BANK, exposed: false, durationMs: 3 * MINUTE, activeMs: 3 * MINUTE, now: clock });
    assert.equal(done.status, 'completed');
    assert.ok(done.settlesAt !== null, 'a completed plan does not say which sitting it settled');
    await settled();
    const delta = watch.find({ source: 'drill', at: done.settlesAt });
    assert.ok(delta !== null, 'the page cannot find the delta of the plan it completed');
    assert.equal(delta.xp.earned, done.xp);
    assert.equal(endCardView(delta).tiles.find((t) => t.id === 'xp')?.value, delta.xp.counted, 'the practice card shows XP other than the read-back');

    // A replay settles nothing and names nothing.
    const again = await completePracticeSitting({ sittingId: 's-end', state, targets: built.targets, exercises: BANK, exposed: false, now: clock });
    assert.equal(again.status, 'already-completed');
    assert.equal(again.settlesAt, null);
  });
});
