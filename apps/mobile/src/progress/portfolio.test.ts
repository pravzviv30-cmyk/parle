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

  test('home draws the next situation from portfolio.ts rather than spelling it', () => {
    // F351. Home used to spell "Next situation" and "Start this one" itself
    // while this module mirrored the words and a test kept them in step. Now
    // one card draws the situation for both tabs and reads its words from
    // here, so neither tab spells them and the two cannot part company.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    const myFrench = stripComments(read('../tabs/MyFrenchTab.tsx'));
    const card = stripComments(read('../home/NextSituationCard.tsx'));
    for (const [name, source] of [['Home', home], ['My French', myFrench]] as const) {
      assert.ok(source.includes('<NextSituationCard'), `${name} does not draw the shared next-situation card`);
      assert.ok(!source.includes(`'${NEXT_SITUATION.label}'`) && !source.includes(`>${NEXT_SITUATION.label}<`), `${name} still spells "${NEXT_SITUATION.label}" itself`);
      assert.ok(!source.includes(`"${NEXT_SITUATION.action}"`) && !source.includes(`'${NEXT_SITUATION.action}'`), `${name} still spells "${NEXT_SITUATION.action}" itself`);
      assert.match(source, /label=\{NEXT_SITUATION\.action\}/, `${name}'s pill does not read its word from portfolio.ts`);
    }
    assert.match(card, /NEXT_SITUATION\.label/, 'the card does not read its label from portfolio.ts');
    assert.match(card, /from '\.\.\/progress\/portfolio\.ts'/, 'the card does not import portfolio.ts');

    // F233 keeps a single reader of the weekly story. This module is not it.
    const portfolio = read('./portfolio.ts');
    assert.doesNotMatch(portfolio, /progress\/story\.ts/, 'portfolio.ts must not read the weekly story');
  });

  test('home and my french draw one next-situation card, with the place, the goal and the status — F363', () => {
    // One card, one shape: the situation's drawing on its tint, the French and
    // English titles, the mission's own goal line, and the status line that
    // chooserView.ts decides. The actions come in as children so each tab
    // keeps its own pill.
    const card = stripComments(read('../home/NextSituationCard.tsx'));
    assert.match(card, /<MissionDisc place=\{next\.mission\.place\}/, 'the card does not show the place on its tint');
    assert.match(card, /next\.mission\.title\}/, 'the card lost the French title');
    assert.match(card, /next\.mission\.titleEn\}/, 'the card lost the English title');
    assert.match(card, /next\.mission\.goalEn\}/, 'the card does not say what the learner will be able to do');
    assert.match(card, /missionStatus\(next\.state, next\.independence\)/, 'the card decides the status itself instead of asking chooserView.ts');
    assert.match(card, /\{children\}/, 'the card draws its own actions instead of taking each tab\'s');
    assert.doesNotMatch(card, /<PillButton|<OutlineButton|<GhostButton/, 'the card carries a button of its own, so a tab could end up with two');

    // Home's pill is now in the card, and its way to the Tutor tab is an
    // outline; My French's pill is in the card as before. One pill each.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    assert.match(home, /<NextSituationCard[\s\S]*?<PillButton[\s\S]*?<\/NextSituationCard>/, 'Home\'s pill is not inside the card');
    assert.match(home, /<OutlineButton label=\{`Talk to \$\{tutorNameOf\(profile\)\}`\}/, 'Home\'s way to the tutor is not an outline');

    // Every goal line in the catalogue obeys the card's copy rules.
    for (const item of missionStates([], [], NOW)) {
      assert.doesNotMatch(item.mission.goalEn, /—/, `${item.mission.id}'s goal carries an em dash`);
      assert.doesNotMatch(item.mission.goalEn, /\d/, `${item.mission.id}'s goal carries a digit`);
    }
  });
});
