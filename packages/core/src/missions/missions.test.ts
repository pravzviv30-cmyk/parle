import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSIONS,
  FIRST_MISSION,
  getMission,
  missionPhraseKeys,
  missionStates,
  independenceFrom,
  replayRung,
  suggestedMission,
  type MissionCompletion,
} from './missions.ts';
import { AUTHORED_PATH, authoredPhraseKeys } from '../path/path.ts';
import { DRILL_FIXTURES } from '../drill/fixtures.ts';
import { phraseKeyOf } from '../topics/topics.ts';
import type { ReviewCard } from '../review/scheduler.ts';
import { openingRung, RUNGS } from '../ladder/ladder.ts';
import { SCENES_CAFE_AND_FOOD } from '../daily/scenes/cafeAndFood.ts';
import { DAILY_SCENARIOS } from '../daily/scenarios.ts';

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

describe('the catalogue — thirty-one front doors, each with somewhere to practise', () => {
  test('thirty-one missions exist and each names the path unit that practises it', () => {
    // 2026-09-27: six became seven when the three-line first scene,
    // mission:premier-cafe, joined the catalogue ahead of the full café.
    // 2026-10-22: seven became twelve with the five A1 errands (restaurant,
    // pharmacy, station, parcel pickup, neighbour), docs/changes/mission-spine-a2.md.
    // 2026-10-22: twelve became nineteen with the seven A2 scenes (weekend,
    // first day at work, phone booking, doctor, shop return, flat viewing,
    // dinner with a partner's parents), same change doc.
    // 2026-10-22: nineteen became twenty-five with six more A2 scenes (a class,
    // a bank account, cinema plans, a Montréal coat, a colleague's help, a
    // partner's sister's birthday), docs/changes/mission-spine-b1.md.
    // 2026-10-23: twenty-five became thirty-one with the six B1 scenes (a leak,
    // a weekend story, a film opinion, a job interview, a home-working
    // request, a partner's grandmother), same change doc.
    assert.equal(MISSIONS.length, 31, 'the product promises thirty-one practical situations; anything fewer is a shorter promise');

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

  test('every mission happens in one of the six places the daily pool draws, and the opener shares the café', () => {
    // 2026-10-22: missions may now share a place. A place is one of the six
    // drawn discs the daily scenarios already use; what tells two missions in
    // the same place apart is that each has its own drawing, which
    // apps/mobile's scenes.test.ts holds. A seventh place would be a seventh
    // disc nobody drew.
    const drawn = new Set(DAILY_SCENARIOS.map((scenario) => scenario.place));
    assert.equal(drawn.size, 6, `the daily pool should draw exactly six places: ${[...drawn].join(', ')}`);
    for (const mission of MISSIONS) {
      assert.ok(drawn.has(mission.place), `${mission.id} happens at "${mission.place}", which no daily scene draws`);
    }

    assert.equal(FIRST_MISSION, 'mission:premier-cafe', 'a brand-new learner opens on the three-line first scene');
    assert.equal(
      getMission(FIRST_MISSION)?.place,
      getMission('mission:cafe')?.place,
      'the opener is the same café as the full scene, so it must share its place',
    );
  });

  test('the first scene is three lines at the counter, practised by the café unit', () => {
    const opener = getMission('mission:premier-cafe');
    assert.ok(opener, 'the first scene is missing from the catalogue');
    assert.equal(opener.cefr, 'A0');
    assert.deepEqual([...opener.beatIds], ['greet-and-order', 'say-where', 'pay']);
    assert.equal(opener.pathUnitId, 'cafe');
    assert.deepEqual(
      [...opener.phraseKeys],
      [
        'phrase:bonjour, je vais prendre un café',
        "phrase:sur place, au comptoir, s'il vous plaît",
        'phrase:je vous dois combien ?',
      ],
      'the opener drills the three lines it asks the learner to say, not neighbouring café lines',
    );

    // The approved first-coffee lines, read from the daily scene itself so the
    // two cannot drift. A sentence-final full stop is the only thing dropped:
    // phrase keys never carry one, and a scorer hears no difference.
    const firstCoffee = SCENES_CAFE_AND_FOOD.find((scene) => scene.id === 'situation:cafe-first-coffee');
    assert.ok(firstCoffee, 'the approved first-coffee scene is gone');
    assert.deepEqual(
      [...opener.referencePhrases],
      firstCoffee.lines.map((line) => line.fr.replace(/\.$/, '')),
      'the lines you will say are the approved first-coffee lines',
    );
  });

  test('every mission says what the learner will be able to do, and what they can do once earned', () => {
    for (const mission of MISSIONS) {
      assert.ok(mission.canDoEn.trim().length > 0, `${mission.id} has no can-do line`);
      assert.ok(mission.earnedEn.trim().length > 0, `${mission.id} has no earned line`);
      assert.ok(mission.earnedEn.startsWith('You can '), `${mission.id} earned line must start "You can ": "${mission.earnedEn}"`);
      for (const line of [mission.canDoEn, mission.earnedEn]) {
        assert.doesNotMatch(line, /\d/, `${mission.id} puts a number in a can-do line: "${line}"`);
        assert.doesNotMatch(line, /—/, `${mission.id} puts an em dash in a can-do line: "${line}"`);
      }
    }
  });

  test('the can-do lines are exactly the approved ones', () => {
    // Pinned verbatim: a promise about what a learner will be able to do is a
    // product decision, and this is where changing it becomes deliberate.
    const approved: Record<string, [string, string]> = {
      'mission:premier-cafe': ['Order a coffee at the counter', 'You can order a coffee'],
      'mission:cafe': ['Order food and drink, then pay', 'You can order at a café and pay'],
      'mission:hotel': ['Check in and ask one question', 'You can check into a hotel'],
      'mission:marche': ['Ask the price and choose', 'You can buy food at a market'],
      'mission:chemin': ['Ask the way and follow the answer', 'You can ask for directions'],
      'mission:journee': ['Say how your day went, ask about theirs', 'You can talk about your day'],
      'mission:amis': ['Make a plan with friends', 'You can make plans with friends'],
      'mission:restaurant': ['Book a table for tonight', 'You can book a table'],
      'mission:pharmacie': ['Ask a pharmacist for help', 'You can get help at a pharmacy'],
      'mission:gare': ['Buy a ticket and find your train', 'You can buy a train ticket'],
      'mission:colis': ['Collect a parcel at the counter', 'You can pick up a parcel'],
      'mission:voisin': ['Introduce yourself to a neighbour', 'You can chat with a neighbour'],
      'mission:week-end': ['Say what you did at the weekend', 'You can talk about your weekend'],
      'mission:collegues': ['Introduce yourself at work', 'You can introduce yourself at work'],
      'mission:telephone': ['Book an appointment by phone', 'You can book an appointment by phone'],
      // The table's canDoEn was "Explain what is wrong to a doctor"; wrong is a
      // scold word under copyViolations, so it reads as the earned line does.
      'mission:medecin': ['Explain your symptoms to a doctor', 'You can explain your symptoms to a doctor'],
      'mission:retour': ['Return something that does not work', 'You can return something to a shop'],
      'mission:appartement': ['Ask the right questions about a flat', 'You can ask about a flat to rent'],
      'mission:belle-famille': ["Have dinner with your partner's family", "You can have dinner with your partner's family"],
      'mission:club': ['Sign up for a class', 'You can sign up for a class'],
      'mission:banque': ['Ask to open a bank account', 'You can ask to open a bank account'],
      'mission:sortie': ['Make plans with a friend on the phone', 'You can arrange a night out with a friend'],
      'mission:montreal': ['Shop for a winter coat', 'You can shop for winter clothes'],
      'mission:coup-de-main': ['Ask a colleague to show you how, and check you followed', 'You can ask a colleague for help and check you followed'],
      'mission:anniversaire': ["Celebrate a birthday with your partner's family", "You can celebrate with your partner's family"],
      'mission:fuite': ['Report a problem in your home', 'You can report a problem to your landlord'],
      'mission:galere': ['Tell a friend a story from start to finish', 'You can tell a story about something that happened'],
      'mission:avis': ['Say what you thought of a film, and why', 'You can give your opinion and explain it'],
      'mission:entretien': ['Talk about yourself in a job interview', 'You can talk about yourself in a short job interview'],
      'mission:teletravail': ['Ask your manager for something politely', 'You can make a polite request at work'],
      'mission:souvenirs': ["Share memories with your partner's grandmother", 'You can talk about the past and how things have changed'],
    };
    assert.deepEqual(MISSIONS.map((m) => m.id).sort(), Object.keys(approved).sort());
    for (const mission of MISSIONS) {
      assert.deepEqual([mission.canDoEn, mission.earnedEn], approved[mission.id], `${mission.id} drifted from its approved lines`);
    }
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

  test('a deliberate replay opens one rung up and never past the top', () => {
    // Choosing to walk back into a scene you have already finished is a request
    // for less help than last time, so the offer goes up rather than down.
    assert.equal(replayRung(1), 2, 'a replay after the Echo rung is offered the Cued rung, not Echo again');
    assert.equal(replayRung(2), 3);
    assert.equal(replayRung(3), 4, 'one below the top is offered the top');

    assert.equal(
      replayRung(4),
      4,
      'rung 4 is already no support at all, so there is nothing left to withdraw and the ladder has no rung 5',
    );

    assert.equal(replayRung(null), null, 'a scene nobody has finished has no replay to open, so there is no rung to name');
  });

  test('the replay rung and the cold-open rung answer different questions in opposite directions', () => {
    // The whole reason this is a second function. openingRung deliberately opens
    // one BELOW where the learner finished, because arriving rusty at the edge of
    // your ability is how a session dies in its first thirty seconds. A replay is
    // not a cold open, and collapsing the two would silently pick one answer for
    // both questions.
    const lastRung = 3 as const;

    assert.equal(openingRung({ cefrBase: RUNGS.FREE, lastRung }), 2, 'a cold session comes back a little rusty');
    assert.equal(replayRung(lastRung), 4, 'a deliberate replay asks for less help than last time');
  });

  test('a replay is offered off the most recent rung while independence stays on the best ever', () => {
    // The asymmetry that makes raising the rung safe. A tired evening at rung 1
    // lowers what the next replay offers and costs the learner nothing they have
    // already earned, so there is no reason to avoid the tired evening.
    const climbed = [finished('mission:cafe', 4, NOW - 5 * DAY), finished('mission:cafe', 1, NOW - DAY)];
    const progress = missionStates(climbed, [], NOW).find((p) => p.mission.id === 'mission:cafe');

    assert.equal(replayRung(progress?.lastRung ?? null), 2, 'the replay is pitched off what happened last, because that is this attempt');
    assert.equal(progress?.independence, 'on-your-own', 'independence still reads the best they ever managed, so nothing was lost');
  });

  test('one mission is offered first, and anything due comes before new ground', () => {
    const cafe = MISSIONS.find((m) => m.id === 'mission:cafe')!;
    const deck = cafe.phraseKeys.map((key) => card(key, NOW - DAY));

    const due = suggestedMission(missionStates([finished(cafe.id, 3)], deck, NOW));
    assert.equal(due?.mission.id, cafe.id, 'a phrase the scheduler wants back outranks a situation never tried');

    const fresh = suggestedMission(missionStates([], [], NOW));
    assert.equal(fresh?.mission.id, FIRST_MISSION, 'a learner with no history is pointed at the first mission');
  });

  test('a brand-new learner is offered the three-line opener first', () => {
    // 2026-09-27: the opener leads the catalogue, so it is what nobody-yet sees.
    assert.equal(suggestedMission(missionStates([], [], NOW))?.mission.id, 'mission:premier-cafe');
  });

  test('a learner who earned the full café is never sent back to the opener', () => {
    // The opener's can-do sits inside the café's, so earning the café earns it.
    // Without this the shared café phrases make the opener read in-progress (or
    // needs-review) forever, and it would outrank everything behind it.
    const cafe = MISSIONS.find((m) => m.id === 'mission:cafe')!;
    const settled = cafe.phraseKeys.map((key) => card(key, NOW + 10 * DAY));
    const due = cafe.phraseKeys.map((key) => card(key, NOW - DAY));

    for (const deck of [[], settled, due]) {
      const offered = suggestedMission(missionStates([finished('mission:cafe', 4)], deck, NOW));
      assert.notEqual(offered?.mission.id, 'mission:premier-cafe', 'an earned café sent the learner back to three lines');
    }
    assert.equal(
      suggestedMission(missionStates([finished('mission:cafe', 4)], due, NOW))?.mission.id,
      'mission:cafe',
      'with café phrases due, the café itself is what comes back',
    );
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
