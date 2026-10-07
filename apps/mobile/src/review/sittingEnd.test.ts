/**
 * A review the learner just finished is not a deck with nothing in it (F761).
 *
 * Both used to reach "no card on screen" and draw "Nothing waiting.", so the
 * end of a sitting looked like having had nothing to do. The page is decided
 * by `reviewPage`, which runs here; the sitting's settle runs for real against
 * an in-memory disk; and the screen is read as text, because this workspace
 * has no renderer (docs/TESTING.md).
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reviewXp } from '@luvani/core';

import { endCardView } from '../celebrate/endCardModel.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { DRILL_END } from '../drill/endCopy.ts';
import { OWN_WORDS_NOT_KEPT } from '../drill/ownWordsCopy.ts';
import type { GameDelta } from '../game/delta.ts';
import { configureGameEnvironment, onSettleChain, onSettled, settleSitting } from '../game/settle.ts';
import { NO_OUTSIDE_FACTS } from '../game/view.ts';
import { recordActivity } from '../progress/activity.ts';
import { setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { REVIEW_END, reviewPage } from './sittingEnd.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let uids = 0;
let clock = 0;
let restore: () => void = () => {};
let stop: () => void = () => {};
let heard: GameDelta[] = [];

beforeEach(() => {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => map.get(key) ?? null;
  shared.setItem = async (key: string, value: string): Promise<void> => {
    map.set(key, value);
  };
  shared.removeItem = async (key: string): Promise<void> => {
    map.delete(key);
  };
  resetSyncRegistry();
  setActiveUser(`99999999-9999-4999-8999-${String(++uids).padStart(12, '0')}`);
  clock = new Date(2026, 9, 6, 9, 0, 0).getTime();
  restore = configureGameEnvironment({
    now: () => clock,
    billing: () => Promise.resolve(null),
    canRecord: () => Promise.resolve(false),
    outside: () => Promise.resolve(NO_OUTSIDE_FACTS),
  });
  heard = [];
  stop = onSettled((delta) => heard.push(delta));
});

afterEach(() => {
  stop();
  restore();
});

describe('a finished review and an empty deck — F761', () => {
  test('a finished review is told apart from a review with nothing waiting', async () => {
    // The page, by what happened: nothing dealt, a card on screen, every dealt card graded.
    assert.equal(reviewPage(null, 0), 'loading');
    assert.equal(reviewPage(0, 0), 'nothing-waiting');
    assert.equal(reviewPage(3, 1), 'card');
    assert.equal(reviewPage(3, 3), 'finished');
    // "Again" puts the card back at the end: the sitting is not over until it is graded again.
    assert.equal(reviewPage(4, 3), 'card');
    assert.equal(reviewPage(4, 4), 'finished');
    assert.equal(REVIEW_END.finished, 'Review complete.');
    // Every line a finished sitting says beside its card is warm plain English.
    for (const line of [...Object.values(REVIEW_END), ...Object.values(DRILL_END), OWN_WORDS_NOT_KEPT]) {
      assert.equal(streakGuiltIn(line), undefined, `"${line}" scolds or threatens`);
      assert.doesNotMatch(line, /\d|[—–·]/, `"${line}" carries a digit, a dash or a middot`);
    }

    // A sitting with grades and nothing recalled still finishes, settles once
    // and is shown its +5 for practising, read back from the game store.
    const at = clock;
    const xp = reviewXp({ recalled: 0 });
    assert.equal(xp, 0);
    const delta = await settleSitting({ source: 'review', at, xpEarned: xp, activeMs: 90_000, write: () => recordActivity('review', xp, at, { durationMs: 90_000, activeMs: 90_000, finished: true }) });
    await onSettleChain(async () => {});
    assert.ok(delta !== null);
    assert.equal(heard.length, 1, 'a finished review did not settle exactly once');
    assert.equal(delta.streak.extendedNow, true, 'a finished review did not count as today\'s practice');
    const card = endCardView(delta, { count: 0 });
    assert.equal(card.tiles.find((t) => t.id === 'xp')?.value, 5, 'a review with nothing recalled lost its +5 for practising');
    assert.equal(card.tiles.some((t) => t.id === 'count'), false, 'a count of nothing remembered was drawn');

    // The screen: the finished page says "Review complete." with its end card,
    // and the empty deck keeps its calm card, plays nothing and settles nothing.
    const screen = stripComments(read('../ReviewScreen.tsx')).replace(/\s+/g, ' ');
    const terminal = screen.slice(screen.indexOf('if (!card || !view) {'), screen.indexOf('const hear = view.hear;'));
    assert.ok(terminal.length > 0, 'the terminal branch moved; this test is reading the wrong thing');
    const finishedAt = terminal.indexOf("if (reviewPage(queue.length, index) === 'finished') {");
    assert.ok(finishedAt >= 0, 'the finished sitting is not told apart from the empty deck');
    // The finished page returns first; everything after its return is the empty deck's.
    const finishedEnd = terminal.indexOf('); }', finishedAt);
    assert.ok(finishedEnd > finishedAt, 'the finished page moved; this test is reading the wrong thing');
    const finished = terminal.slice(finishedAt, finishedEnd);
    const empty = terminal.slice(finishedEnd);
    assert.match(finished, /\{REVIEW_END\.finished\}/);
    assert.match(
      finished,
      /<EndCard delta=\{end\.delta\} count=\{recalled\.current\} release=\{release\} \/>/,
      'the end card is drawn from something other than this sitting\'s delta, or never lets the settle hold go',
    );
    assert.match(finished, /end\.state === 'settled'/, 'the end card can draw before the settle answered');
    assert.doesNotMatch(finished, /Nothing waiting/, 'a finished review says nothing was waiting');
    assert.match(empty, /Nothing waiting\./, 'the empty deck lost its calm card');
    assert.match(empty, /Your next session adds more\./);
    assert.doesNotMatch(empty, /EndCard|REVIEW_END|expect\(|settleSitting|bankSitting|celebrate|play\(/, 'an empty deck celebrates or settles something');
    // Banked before it settles, once, and only a sitting with grades settles.
    const bank = screen.slice(screen.indexOf('const bankSitting = useRef('), screen.indexOf('}).current;'));
    assert.ok(bank.indexOf('banked.current = true;') < bank.indexOf('recordActivity('), 'the sitting is written before it is marked banked');
    assert.ok(bank.indexOf('banked.current = true;') < bank.indexOf('expect('), 'the end card waits before the sitting is marked banked');
    assert.match(bank, /if \(banked\.current \|\| \(finished \? graded\.current === 0 : recalled\.current === 0\)\) return;/, 'a sitting with no grades can settle');
    assert.match(screen, /useEffect\(\(\) => \{ if \(finished\) bankSitting\(true\); \}, \[finished, bankSitting\]\);/, 'emptying the queue no longer settles the sitting');
    // Still no score, no streak and no progress surface on the review screen.
    assert.doesNotMatch(screen, /ProgressBar|percent|streak/i);
    assert.doesNotMatch(screen, /score/);
  });
});
