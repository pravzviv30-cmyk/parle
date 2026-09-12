/**
 * The portfolio — one row's verb, and the words two blocks are named in.
 *
 * Three things are held here, and only the first is about the module in
 * isolation. The second is the same promise every surface under `progress/`
 * makes: no score, no number, no word that scolds. The third is a claim about
 * the screens agreeing with the module: whichever tab draws the next-situation
 * card reads its two words from here rather than spelling them, read straight
 * off the source so a change that is not mirrored fails rather than drifts.
 *
 * F399 moved one of those claims. Home no longer draws the next-situation card
 * at all: its mockup gives that place to today's situation, and what is left of
 * the next step became the mission hero (F543). So the assertions about Home say
 * that now, and the ones about My French are untouched, because the card and
 * its pill did not move.
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

    const constants = [
      NEXT_SITUATION.label,
      NEXT_SITUATION.action,
      SITUATION_ACTION.start,
      SITUATION_ACTION.refine,
    ];

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

  test('the tab that draws the next situation reads its words from portfolio.ts rather than spelling them', () => {
    // F351. Two tabs used to spell "Next situation" and "Start this one"
    // themselves while this module mirrored the words and a test kept them in
    // step. One card draws the situation now and reads its words from here, so
    // a tab cannot part company with the module.
    //
    // F399 left one tab drawing it. Home's mockup gives that place to today's
    // situation, so the card and its pill are My French's alone, and the pair
    // of assertions that used to run over both now runs over the one and is
    // matched by the pair below saying Home does not draw it.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    const myFrench = stripComments(read('../tabs/MyFrenchTab.tsx'));
    const card = stripComments(read('../home/NextSituationCard.tsx'));
    for (const [name, source] of [['My French', myFrench]] as const) {
      assert.ok(source.includes('<NextSituationCard'), `${name} does not draw the shared next-situation card`);
      assert.ok(!source.includes(`'${NEXT_SITUATION.label}'`) && !source.includes(`>${NEXT_SITUATION.label}<`), `${name} still spells "${NEXT_SITUATION.label}" itself`);
      assert.ok(!source.includes(`"${NEXT_SITUATION.action}"`) && !source.includes(`'${NEXT_SITUATION.action}'`), `${name} still spells "${NEXT_SITUATION.action}" itself`);
      assert.match(source, /label=\{NEXT_SITUATION\.action\}/, `${name}'s pill does not read its word from portfolio.ts`);
    }
    assert.match(card, /NEXT_SITUATION\.label/, 'the card does not read its label from portfolio.ts');
    assert.match(card, /from '\.\.\/progress\/portfolio\.ts'/, 'the card does not import portfolio.ts');

    // Home draws the mission hero instead (F543), and the hero reads its words
    // from `home/homeMission.ts` rather than from here: the next-step row and
    // its two words in this module retired with it, so nothing here spells a
    // heading Home no longer draws.
    assert.ok(!home.includes('<NextSituationCard'), 'Home draws the next-situation card again; that card is My French\'s now');
    assert.match(home, /<MissionHero/, 'Home draws neither the card nor the hero, so there is no next step at all');
    assert.ok(!home.includes('<NextStepRow'), 'Home draws the retired next-step row');
    assert.doesNotMatch(read('./portfolio.ts'), /NEXT_STEP\b/, 'portfolio.ts still spells the words of a row nothing draws');

    // F233 keeps a single reader of the weekly story. This module is not it.
    const portfolio = read('./portfolio.ts');
    assert.doesNotMatch(portfolio, /progress\/story\.ts/, 'portfolio.ts must not read the weekly story');
  });

  test('my french draws one next-situation card, with the place, the goal and the status — F363', () => {
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

    // My French's pill is inside the card, and it is that tab's only one.
    const myFrench = stripComments(read('../tabs/MyFrenchTab.tsx'));
    assert.match(myFrench, /<NextSituationCard[\s\S]*?<PillButton[\s\S]*?<\/NextSituationCard>/, 'My French\'s pill is not inside the card');

    // F399. Home carries neither the card nor the outline that used to sit
    // under it: today's situation is its headline and the tutor is a tab away,
    // so a second door to the same place would be a second primary in disguise.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    assert.ok(!home.includes('<NextSituationCard'), 'the next-situation card is back on Home beside the daily one');
    assert.ok(!home.includes('Talk to '), 'the outline to the tutor is back on Home');
    assert.ok(!home.includes('tutorNameOf'), 'Home names the tutor again, which is the Tutor tab\'s to do');

    // Every goal line in the catalogue obeys the card's copy rules.
    for (const item of missionStates([], [], NOW)) {
      assert.doesNotMatch(item.mission.goalEn, /—/, `${item.mission.id}'s goal carries an em dash`);
      assert.doesNotMatch(item.mission.goalEn, /\d/, `${item.mission.id}'s goal carries a digit`);
    }
  });
});
