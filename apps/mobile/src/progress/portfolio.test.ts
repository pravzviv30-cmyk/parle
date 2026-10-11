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
 * That third claim has moved twice. F399 took the next-situation card off Home,
 * whose mockup gives that place to today's situation, and what was left of the
 * next step became the mission hero (F543). Revamp A folded the card away on My
 * French too: the next situation is the first row under "Next places", which is
 * `splitByStamp` putting core's suggestion at the head of the second group. So
 * what is held here is what survived the fold, which is the row's verb and the
 * sentence a screen reader hears, and the claim is read off the rows rather
 * than off a card that is not there.
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

/**
 * `missionStates`' first row: never attempted, so `timesFinished` is 0.
 * 2026-09-27: that row is now the three-line opener, "Your first coffee",
 * which leads the catalogue; it was the full café before.
 */
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
    assert.equal(start.accessibilityLabel, 'Start Your first coffee');

    const refine = situationAction(finished);
    assert.equal(refine.kind, 'refine');
    assert.equal(refine.label, SITUATION_ACTION.refine);
    assert.equal(refine.label, 'Refine pronunciation');
    assert.equal(refine.accessibilityLabel, `Refine pronunciation for ${finished.mission.titleEn}`);
    assert.equal(refine.accessibilityLabel, 'Refine pronunciation for Your first coffee');
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
    // step. F399 left one tab drawing the shared card. Revamp A folded the card
    // away entirely: the next situation is the first row under "Next places",
    // which is `splitByStamp` putting core's own suggestion at the head of the
    // second group, so there is no card left to spell anything.
    //
    // What did not move is the row's verb. `situationAction` still decides
    // whether a place is one to start or one to refine, and still writes the
    // sentence a screen reader hears; the model reads both and the card spells
    // neither. That is the half of F351 with a surface left, and it is what is
    // held here.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    const myFrench = stripComments(read('../tabs/MyFrenchTab.tsx'));
    const card = stripComments(read('../myfrench/SituationsCard.tsx'));
    const model = stripComments(read('../myfrench/model.ts'));

    // The card is gone from both tabs and from the file that replaced it, so a
    // reader arriving at this module is not sent looking for it.
    for (const [name, source] of [['Home', home], ['My French', myFrench], ['the situations card', card]] as const) {
      assert.ok(!source.includes('<NextSituationCard'), `${name} draws a next-situation card, and the card was folded into the rows`);
    }
    assert.match(home, /<NextTaskCard/, 'Home draws neither a card nor the hero, so there is no next step at all');

    // The two headings are the group module's words, read rather than spelled,
    // and which place comes first is `splitByStamp`'s answer rather than the
    // card's.
    assert.match(card, /<Label>\{YOU_CAN_NOW\.label\}<\/Label>/, 'the card spells the first heading instead of reading it from situations.ts');
    assert.match(card, /<Label>\{NEXT_PLACES\.label\}<\/Label>/, 'the card spells the second heading instead of reading it from situations.ts');
    assert.match(
      card,
      /splitByStamp\(model\.situations, model\.suggestedId\)/,
      'the card decides which place a learner meets first instead of asking situations.ts, which is where the suggestion is folded in',
    );

    // The verb, and the sentence that travels with it, still come from here.
    assert.match(model, /situationAction\(progress\)/, 'the model no longer reads the row action from portfolio.ts');
    assert.match(model, /startLabel\(scenario\.titleEn\)/, "a saved row's spoken sentence is written in the model instead of read from portfolio.ts");

    // And nothing on the way to the screen spells any of portfolio's four words
    // itself, which is the guarantee F351 was filed for.
    for (const [name, source] of [['My French', myFrench], ['the situations card', card], ['the model', model]] as const) {
      for (const words of [SITUATION_ACTION.start, SITUATION_ACTION.refine, NEXT_SITUATION.label, NEXT_SITUATION.action]) {
        assert.ok(
          !source.includes(`'${words}'`) && !source.includes(`>${words}<`),
          `${name} spells "${words}" itself instead of reading it from portfolio.ts`,
        );
      }
    }

    assert.doesNotMatch(read('./portfolio.ts'), /NEXT_STEP\b/, 'portfolio.ts still spells the words of a row nothing draws');

    // F233 keeps a single reader of the weekly story. This module is not it.
    const portfolio = read('./portfolio.ts');
    assert.doesNotMatch(portfolio, /progress\/story\.ts/, 'portfolio.ts must not read the weekly story');
  });

  test('my french draws one next-situation card, with the place, the goal and the status — F363', () => {
    // One shape, and now literally one: both groups go through the same `Row`,
    // so the place a learner has handled and the place they have not cannot
    // drift apart. The row carries what the card used to: the place as its
    // paper and its mark, the French title, the English under it, and the state
    // reached as a chip before the chevron.
    const card = stripComments(read('../myfrench/SituationsCard.tsx'));
    assert.equal(
      (card.match(/<LedgerRow\b/g) ?? []).length,
      1,
      'the two groups are drawn by two different rows, so one of them can be restyled without the other',
    );
    assert.doesNotMatch(card, /\btint\b|TintRow|TintPanel/, 'the situation row must not retain retired tint presentation');
    assert.match(card, /<PlaceGlyph place=\{row\.place\}/, 'the row does not show the place on its disc');
    assert.match(card, /title=\{row\.title\}/, 'the row lost the French title');
    assert.match(card, /gloss=\{row\.gloss\}/, 'the row lost the English title');
    assert.match(card, /trailing=\{<StateChip chip=\{row\.chip\} \/>\}/, 'the state the learner reached is no longer the row trailing');
    assert.match(card, /accessibilityLabel=\{row\.accessibilityLabel\}/, 'the row names itself twice to a screen reader instead of once, in the model words');
    assert.doesNotMatch(card, /<PillButton|<OutlineButton|<GhostButton/, 'a row carries a button of its own, so the tab could end up with two primaries');

    // And it decides none of it. The tint, the chip and the verb are all the
    // model's, which is what stops a screen growing a second opinion about
    // whether a place has been handled.
    const model = stripComments(read('../myfrench/model.ts'));
    for (const decision of ['chipFor(', 'situationAction(']) {
      assert.ok(model.includes(decision), `the model no longer folds ${decision}, so the card would have to decide it`);
    }

    // F399. Home carries neither the rows nor the outline that used to sit
    // under the card: tonight's situation is its headline and the tutor is a
    // tab away, so a second door to the same place would be a second primary in
    // disguise.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    assert.ok(!home.includes('<SituationsCard'), 'the situation rows are back on Home beside tonight\'s card');
    assert.ok(!home.includes('Talk to '), 'the outline to the tutor is back on Home');
    assert.match(home, /<HomeArrival tutorName=\{tutorNameOf\(profile\)\}/, 'the reminder must name the selected tutor through the catalogue');

    // Every line the catalogue puts on one of these rows obeys the copy rules.
    for (const item of missionStates([], [], NOW)) {
      for (const line of [item.mission.titleEn, item.mission.goalEn]) {
        assert.doesNotMatch(line, /—/, `${item.mission.id} carries an em dash: ${line}`);
        assert.doesNotMatch(line, /\d/, `${item.mission.id} carries a digit: ${line}`);
      }
    }
  });
});
