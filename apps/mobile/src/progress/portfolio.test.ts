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
    // M2/M3 keeps one authored situation catalogue, reached through Explore.
    // The tab no longer copies the old next-situation card or its judgement.
    const home = read('../tabs/HomeTab.tsx');
    const progress = read('../tabs/MyFrenchTab.tsx');
    const explore = read('../tabs/ExploreTab.tsx');
    const chooser = read('../missions/MissionsScreen.tsx');
    assert.match(home, /<MainFeature/);
    assert.match(home, /conversation.start\(suggestions.freeSeed \? \{ seedTopic: suggestions.freeSeed \} : \{\}\)/);
    assert.match(explore, /exploreMissions\(query, topic\)/);
    assert.match(explore, /navigate\('Missions', \{ focus: m.id \}\)/);
    assert.match(chooser, /chooserView\(\{ progress:/);
    assert.match(chooser, /nav.navigate\(card.route.screen, \{ \.\.\.card.route.params, textMode \}\)/);
    for (const surface of [home, progress, explore]) assert.doesNotMatch(surface, /<NextSituationCard|<SituationsCard/);
    assert.doesNotMatch(read('./portfolio.ts'), /NEXT_STEP\b|progress\/story\.ts/);
  });

  test('my french draws one next-situation card, with the place, the goal and the status — F363', () => {
    // The live chooser renders every state with the same MainRow and reads
    // place/title/status from its core-derived card, rather than hand-building it.
    const chooser = read('../missions/MissionsScreen.tsx');
    assert.match(chooser, /view.cards.filter\(\(card\) => card.mission.cefr === level\).map/);
    assert.match(chooser, /title=\{card.mission.titleEn\}/);
    assert.match(chooser, /card.mission.title, card.status, minutesLine\(missionMinutes\(card.mission\)\)/);
    assert.match(chooser, /nav.setParams\(\{ focus: card.mission.id, textMode: typed \}\)/);
    const shared = read('../main/MainUI.tsx');
    assert.match(shared, /accessibilityRole="button"/);
    assert.match(shared, /row: \{ minHeight: 76/);
    const home = read('../tabs/HomeTab.tsx');
    assert.doesNotMatch(home, /<SituationsCard|situationAction\(|chipFor\(/);
    assert.match(home, /Speak with \$\{tutorNameOf\(profile\)\}/);

    // Every line the catalogue puts on one of these rows obeys the copy rules.
    for (const item of missionStates([], [], NOW)) {
      for (const line of [item.mission.titleEn, item.mission.goalEn]) {
        assert.doesNotMatch(line, /—/, `${item.mission.id} carries an em dash: ${line}`);
        assert.doesNotMatch(line, /\d/, `${item.mission.id} carries a digit: ${line}`);
      }
    }
  });
});


test('week and postcards use the selected base for empty states and retain their populated editorial grounds', () => {
  const week = read('./WeekWrappedScreen.tsx');
  const places = read('./PostcardsScreen.tsx');
  assert.match(week, /ground=\{populated \? palette\.blue : colors\.background\}/);
  assert.match(week, /type\.body,\{color:colors\.text\}\]\}>Your week will take shape/);
  assert.match(week, /type\.body,\{color:colors\.muted\}\]\}>Finding your week/);
  assert.match(places, /ground=\{populated \? colour\.mint : colors\.background\}/);
  assert.match(places, /ink=\{populated \? paper\.ink : colors\.text\}/);
  assert.match(places, /type\.body,\{color:colors\.text\}\]\}>A place postcard/);
  assert.match(places, /type\.heading,\{color:paper\.ink\}\]\}>\{card\.mission\.titleEn\}/);
});
