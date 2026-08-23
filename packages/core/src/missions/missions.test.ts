import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSIONS,
  FIRST_MISSION,
  getMission,
  missionPhraseKeys,
  missionStates,
  independenceFrom,
  suggestedMission,
  type MissionCompletion,
} from './missions.ts';
import { AUTHORED_PATH, authoredPhraseKeys } from '../path/path.ts';
import { DRILL_FIXTURES } from '../drill/fixtures.ts';
import { phraseKeyOf } from '../topics/topics.ts';
import type { ReviewCard } from '../review/scheduler.ts';

const NOW = new Date(2026, 0, 15, 12).getTime();
const DAY = 86_400_000;

function card(id: string, due: number): ReviewCard {
  return {
    id,
    kind: 'turn',
    front: id,
    back: id,
    context: '',
    ipa: '',
    addedAt: NOW - 30 * DAY,
    due,
    reps: 2,
    ease: 2.5,
    intervalDays: 3,
    lapses: 0,
  };
}

function finished(id: MissionCompletion['id'], rung: MissionCompletion['rung'], at = NOW - DAY): MissionCompletion {
  return { id, at, rung };
}

describe('the catalogue — six front doors, each with somewhere to practise', () => {
  test('six missions exist and each names the path unit that practises it', () => {
    assert.equal(MISSIONS.length, 6, 'the product promises six practical situations; anything fewer is a shorter promise');

    const unitIds = new Set(AUTHORED_PATH.map((unit) => unit.id));
    for (const mission of MISSIONS) {
      assert.ok(
        unitIds.has(mission.pathUnitId),
        `${mission.id} points at the unit "${mission.pathUnitId}", which is not on the path, so its phrases have nowhere to be practised`,
      );
    }
  });

  test('every authored path phrase can be drilled the day it appears', () => {
    // Both halves, because either one alone lets a learner tap a card and find
    // nothing behind it. path.ts:183 records the session where that happened.
    const drillable = new Set(DRILL_FIXTURES.map((exercise) => exercise.phraseKey));

    for (const key of authoredPhraseKeys()) {
      assert.ok(drillable.has(key), `${key} sits on the path and nothing in the bank can drill it`);
    }
    for (const key of missionPhraseKeys()) {
      assert.ok(drillable.has(key), `${key} is a mission phrase and nothing in the bank can drill it`);
    }
  });

  test('a mission only claims phrases its own unit carries', () => {
    for (const mission of MISSIONS) {
      const unit = AUTHORED_PATH.find((u) => u.id === mission.pathUnitId);
      assert.ok(unit, `${mission.id} has no unit`);
      const unitKeys = new Set(unit.nodes.flatMap((node) => node.phraseKeys));
      for (const key of mission.phraseKeys) {
        assert.ok(unitKeys.has(key), `${mission.id} drills ${key}, which its unit ${mission.pathUnitId} does not carry`);
      }
    }
  });

  test('no two missions hand back the same place', () => {
    // The postcard metaphor only works if a place means one situation.
    const places = MISSIONS.map((mission) => mission.place);
    assert.equal(new Set(places).size, places.length, `two missions share a place: ${places.join(', ')}`);
  });

  test('mission ids are unique, and the first mission is one of them', () => {
    const ids = MISSIONS.map((mission) => mission.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(getMission(FIRST_MISSION), 'the mission a brand-new learner opens on must exist');
    assert.equal(getMission('mission:nope'), undefined);
  });

  test('every reference phrase is a phrase the mission actually practises', () => {
    // A pronunciation score may only ever be measured against a known line.
    // A reference the mission does not teach is a reference nobody rehearsed.
    for (const mission of MISSIONS) {
      const keys = new Set(mission.phraseKeys);
      for (const reference of mission.referencePhrases) {
        assert.ok(
          keys.has(phraseKeyOf(reference)),
          `${mission.id} would score "${reference}", which is not one of the phrases it practises`,
        );
      }
    }
  });

  test('a reference phrase is long enough for a scorer to say anything about it', () => {
    // buildReport needs MIN_SAMPLES_TO_FLAG observations of a sound before it
    // will name it, so a two-syllable line cannot support a focus point however
    // clearly it was said. Offering it as a reference would be promising feedback
    // the scorer is structurally unable to give.
    const syllables = (fr: string): number => (fr.match(/[aeiouyàâäéèêëîïôöùûü]+/gi) ?? []).length;

    for (const mission of MISSIONS) {
      for (const reference of mission.referencePhrases) {
        assert.ok(
          syllables(reference) >= 4,
          `${mission.id} offers "${reference}" for a sound check, and at ${syllables(reference)} syllables there is ` +
            `not enough of it to measure. Practise it, do not score it.`,
        );
      }
    }
  });

  test('a mission has between two and five beats', () => {
    for (const mission of MISSIONS) {
      assert.ok(
        mission.beatIds.length >= 2 && mission.beatIds.length <= 5,
        `${mission.id} has ${mission.beatIds.length} beats; a scene shorter than two is not a situation and longer than five is a lesson`,
      );
      assert.equal(new Set(mission.beatIds).size, mission.beatIds.length, `${mission.id} repeats a beat id`);
    }
  });
});

describe('what the learner has actually done — projected, never stored twice', () => {
  test('a completed mission whose phrases fall due reads needs-review, never complete', () => {
    const mission = MISSIONS.find((m) => m.id === 'mission:cafe')!;
    const overdue = mission.phraseKeys.map((key, i) => card(key, i === 0 ? NOW - DAY : NOW + 10 * DAY));

    const first = missionStates([finished(mission.id, 4)], overdue, NOW).find((p) => p.mission.id === mission.id);

    assert.equal(
      first?.state,
      'needs-review',
      'a phrase slipping away matters more than a scene that was finished last week, so the deck wins',
    );

    const settled = mission.phraseKeys.map((key) => card(key, NOW + 10 * DAY));
    const rested = missionStates([finished(mission.id, 4)], settled, NOW).find((p) => p.mission.id === mission.id);
    assert.equal(rested?.state, 'complete', 'with nothing due and every phrase known, the mission is genuinely done');
  });

  test('a mission nobody has opened is new, and one with phrases banked is in progress', () => {
    const mission = MISSIONS.find((m) => m.id === 'mission:cafe')!;

    const untouched = missionStates([], [], NOW).find((p) => p.mission.id === mission.id);
    assert.equal(untouched?.state, 'new');
    assert.equal(untouched?.timesFinished, 0);
    assert.equal(untouched?.lastFinishedAt, null);

    const started = missionStates([], [card(mission.phraseKeys[0]!, NOW + DAY)], NOW).find((p) => p.mission.id === mission.id);
    assert.equal(started?.state, 'in-progress', 'phrases in the deck mean the learner has been here, finished or not');
  });

  test('independence comes from the rung the win was earned at, not from the model', () => {
    assert.equal(independenceFrom([]), 'new');
    assert.equal(independenceFrom([finished('mission:cafe', 1)]), 'with-help');
    assert.equal(independenceFrom([finished('mission:cafe', 2)]), 'getting-there');
    assert.equal(independenceFrom([finished('mission:cafe', 3)]), 'mostly-yours');
    assert.equal(independenceFrom([finished('mission:cafe', 4)]), 'on-your-own');
  });

  test('a harder replay never walks the learner backwards', () => {
    // Coming back to a scene on a tired evening with more help is a good thing
    // to do. A scale that punished it would make practice a risk.
    const climbed = [finished('mission:cafe', 4, NOW - 5 * DAY), finished('mission:cafe', 1, NOW - DAY)];

    assert.equal(independenceFrom(climbed), 'on-your-own', 'independence is the best they have managed, not the last');

    const progress = missionStates(climbed, [], NOW).find((p) => p.mission.id === 'mission:cafe');
    assert.equal(progress?.timesFinished, 2);
    assert.equal(progress?.lastRung, 1, 'the most recent rung is still reported, because Round 2 wants to say "less help than last time"');
  });

  test('one mission is offered first, and anything due comes before new ground', () => {
    const cafe = MISSIONS.find((m) => m.id === 'mission:cafe')!;
    const deck = cafe.phraseKeys.map((key) => card(key, NOW - DAY));

    const due = suggestedMission(missionStates([finished(cafe.id, 3)], deck, NOW));
    assert.equal(due?.mission.id, cafe.id, 'a phrase the scheduler wants back outranks a situation never tried');

    const fresh = suggestedMission(missionStates([], [], NOW));
    assert.equal(fresh?.mission.id, FIRST_MISSION, 'a learner with no history is pointed at the first mission');
  });

  test("another learner's completions never leak into this mission", () => {
    // Looked up by id rather than by position, because catalogue order is a
    // product decision that has already changed once this round.
    const all = missionStates([finished('mission:amis', 4)], [], NOW);
    const cafe = all.find((p) => p.mission.id === 'mission:cafe');
    const amis = all.find((p) => p.mission.id === 'mission:amis');

    assert.equal(cafe?.independence, 'new', 'finishing one scene says nothing about another');
    assert.equal(amis?.independence, 'on-your-own');
  });
});
