/**
 * The portfolio — one row's verb, and the words the next situation is named in.
 *
 * Three things are held here, and only the first is about the module in
 * isolation. The second is the same promise every surface under `progress/`
 * makes: no score, no number, no word that scolds. The third is a claim about
 * two screens agreeing — that My French and Home call the next situation by the
 * one name, read straight off HomeTab.tsx so a change there that is not mirrored
 * fails rather than drifts.
 *
 * The fixtures go through `missionStates` rather than hand-rolling a
 * `MissionProgress`, the same choice `passport.test.ts` makes and for the same
 * reason: a built object could carry a `timesFinished` no real history could,
 * and then the test would be checking a shape instead of the rule.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { missionStates, type MissionProgress } from '@luvani/core';

import { NEXT_SITUATION, SITUATION_ACTION, situationAction, startLabel } from './portfolio.ts';

/** A fixed clock, because the rule under test never reads one. */
const NOW = Date.parse('2026-08-22T10:00:00Z');

/** The café is `missionStates`' first row: never attempted, so `timesFinished` is 0. */
const unfinished: MissionProgress = missionStates([], [], NOW)[0]!;
/** The same situation, having been walked into once. */
const finished: MissionProgress = { ...unfinished, timesFinished: 1 };

/** Comments blanked, newlines kept. `story.test.ts`'s helper, for its reason. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const read = (rel: string) => stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

describe('the portfolio — a situation row and the next-situation words, decided once', () => {
  test('a finished situation offers to refine pronunciation, an unfinished one offers to start', () => {
    const start = situationAction(unfinished);
    assert.equal(start.kind, 'start');
    assert.equal(start.label, SITUATION_ACTION.start);
    assert.equal(start.label, 'Start');
    assert.equal(start.accessibilityLabel, startLabel(unfinished.mission.titleEn));
    assert.equal(start.accessibilityLabel, 'Start Order at a café');

    const refine = situationAction(finished);
    assert.equal(refine.kind, 'refine');
    assert.equal(refine.label, SITUATION_ACTION.refine);
    assert.equal(refine.label, 'Refine pronunciation');
    assert.equal(refine.accessibilityLabel, `Refine pronunciation for ${finished.mission.titleEn}`);
    assert.equal(refine.accessibilityLabel, 'Refine pronunciation for Order at a café');
  });

  test("the portfolio's words carry no score, no number and no word that scolds", () => {
    const DIGIT = /\d/;
    const SCORE = /score|percent|%|\bmark\b/i;
    const SCOLD = /wrong|incorrect|bad|fail|behind|streak/i;

    const constants = [NEXT_SITUATION.label, NEXT_SITUATION.action, SITUATION_ACTION.start, SITUATION_ACTION.refine];

    // Every screen-reader sentence the module can produce, across every
    // situation and both verbs, not only the café fixture above.
    const a11y = missionStates([], [], NOW).flatMap((item) => [
      situationAction(item).accessibilityLabel,
      situationAction({ ...item, timesFinished: 1 }).accessibilityLabel,
    ]);

    for (const line of [...constants, ...a11y]) {
      assert.ok(line.length > 0, 'a screen reader still needs something to read');
      assert.doesNotMatch(line, DIGIT, `a digit reached the copy: ${line}`);
      assert.doesNotMatch(line, SCORE, `a score word reached the copy: ${line}`);
      assert.doesNotMatch(line, SCOLD, `a word that scolds reached the copy: ${line}`);
    }
  });

  test('my french and home name the next situation in the same words', () => {
    // HomeTab.tsx is the source of truth for this card's copy. If it stopped
    // saying either literal, this module would be paraphrasing one screen at the
    // other, and the words below would have to change with it.
    const home = read('../tabs/HomeTab.tsx');
    assert.ok(home.includes(NEXT_SITUATION.label), `Home no longer says "${NEXT_SITUATION.label}"`);
    assert.ok(home.includes(NEXT_SITUATION.action), `Home no longer says "${NEXT_SITUATION.action}"`);

    // F233 keeps a single reader of the weekly story. This module is not it.
    const portfolio = read('./portfolio.ts');
    assert.doesNotMatch(portfolio, /progress\/story\.ts/, 'portfolio.ts must not read the weekly story');
  });
});
