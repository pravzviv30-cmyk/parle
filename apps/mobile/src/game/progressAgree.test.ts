/**
 * Stream D, LR-16 (F918, F858): Today, Journey and Practice say the same
 * numbers about the same learner. One XP wording, one saved-phrase count, and
 * a streak tile that never draws a nought on a running streak.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newCard, phraseKeyOf, xpLevelFor, type ReviewCard } from '@luvani/core';

import { firstDraw, heroCounts, nextDraw } from '../home/homeDraw.ts';
import { levelHeader } from '../journey/journeyView.ts';
import { savedPhrasesLine } from '../practice/practiceTabView.ts';
import { savedPhraseCount } from '../practice/savedPhrases.ts';
import { statTiles, todayHeroView, type TodayHeroView } from './todayHeroView.ts';

const NOW = new Date(2026, 9, 5, 12).getTime();
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

function heroAt(total: number, run = 3): TodayHeroView {
  const level = xpLevelFor(total);
  return todayHeroView({
    streak: { current: run, longest: run, today: 'practised' } as never,
    goal: { activeMs: 6 * 60_000, minutes: 6, target: 10, met: false, untimed: false },
    level,
    xp: { total, activity: total, quests: 0, bonus: 0, today: 0, todayCapped: false } as never,
  })!;
}

test('Today and Journey read the same XP total', () => {
  for (const total of [0, 5, 130, 390, 2_400]) {
    const today = statTiles(heroAt(total), total).level;
    const journey = levelHeader(xpLevelFor(total), total)!;
    assert.equal(today.value, journey.title, `level at ${total}`);
    assert.equal(today.label, `${total} XP`);
    assert.ok(journey.xp.startsWith(`${total} XP`), `Journey reads "${journey.xp}" at ${total}`);
    assert.match(journey.xp, new RegExp(`^${total} XP, ${xpLevelFor(total).toNext} to the next$`));
    assert.doesNotMatch(`${today.value} ${today.label} ${journey.title} ${journey.xp}`, /·|—| of \d+ XP/);
  }
});

test("Today's level tile names the XP level, never a French level", () => {
  for (const total of [0, 130, 900]) {
    const hero = heroAt(total);
    const tile = statTiles(hero, total).level;
    assert.match(tile.value, /^XP level \d+$/);
    assert.match(hero.level.words, /^XP level \d+$/);
    assert.match(hero.level.label, /^XP level \d+, /);
    assert.doesNotMatch(`${tile.value} ${tile.label}`, /\b(A0|A1|A2|B1|B2|C1|Starter|Basics|stage)\b/);
  }
});

const card = (fr: string, extra: Partial<ReviewCard> = {}): ReviewCard =>
  ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW), ...extra });

test('saved phrases count the same on Practice and Journey', () => {
  const deck: ReviewCard[] = [
    card('Bonjour'),
    card('bonjour', { id: 'convo:bonjour' }),
    card('Merci'),
    card('ʁ', { id: 'phoneme:ʁ', kind: 'phoneme' }),
    card('   ', { id: 'vocab:blank' }),
  ];
  assert.equal(savedPhraseCount(deck), 2);
  assert.match(savedPhrasesLine(deck), /^2 saved, /);
  const tab = read('../tabs/MyFrenchTab.tsx');
  assert.match(tab, /phrases: savedPhraseCount\(deck\)/, 'Journey counts with the shared rule');
  // Journey re-reads the deck once the packs refresh has banked phrases.
  assert.match(tab, /refreshConversationPacks\(user, adapter\)\.then\(\(result\) => \{[\s\S]{0,200}setPacks\(result\.packs\);[\s\S]{0,200}loadDeck\(\)/);
});

test('the streak tile never reads 0 days on a running streak', () => {
  const D1 = '2026-10-05';
  const noRun = { ...heroAt(0), flame: { lit: false, count: null, words: '', label: '' } };
  // A phone that last drew no run, then a run starts: the counter never starts at nought.
  let drawn = firstDraw({ version: 1, day: D1, values: { streak: 0 } } as never, heroCounts(heroAt(0, 1)), D1);
  assert.ok(drawn.counters.streak!.from >= 1, `first draw from ${drawn.counters.streak!.from}`);
  drawn = firstDraw(null, heroCounts(noRun), D1);
  drawn = nextDraw(drawn, heroCounts(heroAt(0, 1)), D1);
  assert.ok(drawn.counters.streak!.from >= 1, `next draw from ${drawn.counters.streak!.from}`);
  drawn = nextDraw(drawn, heroCounts(heroAt(0, 2)), '2026-10-06');
  assert.ok(drawn.counters.streak!.from >= 1);
  assert.equal(drawn.counters.streak!.to, 2);
});
