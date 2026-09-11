/**
 * The subscription wall's first page, and the one property it may never lose.
 *
 * Two independent judges picked this shape over two prettier ones for the same
 * reason: it is the only opening page that cannot be near-empty. The designs it
 * beat both answered the thin learner by deleting pages, which hands the weakest
 * version of the wall to exactly the cohort it most needs to convince. So the
 * first test here is the four-rows test, and it is the one to read first if this
 * file ever has to be understood in a hurry.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the row data is
 * called directly and the screen is read as text where a claim is about layout.
 * Everything that decides anything lives in a plain module for that reason.
 *
 * `NOW` is a constant. Nothing here reads a clock.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  MISSIONS,
  missionStates,
  newCard,
  raiseEvidenceTo,
  type MissionCompletion,
  type MissionId,
  type ReviewCard,
  type ReviewCardKind,
  type Rung,
} from '@luvani/core';

import { TUTOR_NAME } from '../tutor/tutorName.ts';
import { litCount, wallMap } from './wallMap.ts';
import { WELCOME_PATH, beyondWelcomePath, onWelcomePath, welcomeMissions } from './welcomePath.ts';

const wallMapSource = (): string =>
  readFileSync(fileURLToPath(new URL('./wallMap.ts', import.meta.url)), 'utf8');

/**
 * The module with its prose removed.
 *
 * Every scan below reads this rather than the file, because the module explains
 * at length which fields it deliberately does NOT read, and a scan that reads
 * comments is satisfied by an explanation of the defect instead of its absence.
 */
const wallMapCode = (): string =>
  wallMapSource().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const NOW = Date.parse('2026-09-10T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const missionOf = (id: MissionId) => {
  const found = MISSIONS.find((mission) => mission.id === id);
  assert.ok(found, `${id} is not in MISSIONS`);
  return found;
};

/** Finished beats, at a rung, some days ago. */
function finished(id: MissionId, rung: Rung = 1, daysAgo = 3): MissionCompletion {
  return { id, at: NOW - daysAgo * DAY_MS, rung };
}

/** A phrase card the learner has used in conversation `uses` times. */
function saidCard(id: string, front: string, uses: number, kind: ReviewCardKind = 'vocab'): ReviewCard {
  const base = newCard({ id, kind, front, back: 'english', context: 'context', ipa: '' }, NOW - 20 * DAY_MS);
  return raiseEvidenceTo({ ...base, reps: 3 }, { convoUses: uses });
}

const viewFor = (
  completions: readonly MissionCompletion[],
  deck: readonly ReviewCard[] = [],
  tutorName: string | null = TUTOR_NAME,
) => wallMap({ progress: missionStates(completions, deck, NOW), deck, tutorName });

/** Just the rows, which is what most of these tests are about. */
const mapFor = (
  completions: readonly MissionCompletion[],
  deck: readonly ReviewCard[] = [],
  tutorName: string | null = TUTOR_NAME,
) => viewFor(completions, deck, tutorName).rows;

const WALKED_ALL = WELCOME_PATH.map((id) => finished(id));

describe('the wall opens on four rows, whatever the learner has done', () => {
  test('a learner who walked nothing still gets four rows naming four things they could do', () => {
    const view = viewFor([]);
    const rows = view.rows;
    assert.equal(rows.length, 4, 'the opening page has a variable number of rows');
    assert.equal(litCount(rows), 0);
    assert.equal(view.problemFirst, false, 'a learner with nothing walked was opened on a gap page');
    for (const row of rows) {
      assert.equal(row.lit, false);
      assert.ok(row.line.length > 0, `${row.id} has nothing to say`);
      assert.equal(row.line, missionOf(row.id).goalEn, 'an unwalked room stopped reading its own goal');
    }
    // The whole argument for this shape in one assertion: the emptiest possible
    // learner still reads four specific capabilities rather than a blank card.
    assert.equal(new Set(rows.map((row) => row.line)).size, 4, 'two rows say the same thing');
  });

  test('a learner who walked all four is opened on what is still closed, with the wins below as the proof', () => {
    // The second video's argument, as far as it honestly goes: lead with the
    // problem, but only once there is one. Here there is, and it is the two
    // situations held back, which are the only rooms left and are authored.
    const view = viewFor(WALKED_ALL);
    assert.equal(view.problemFirst, true, 'a finished path was still opened on what was already done');

    const closed = beyondWelcomePath().map((mission) => mission.id);
    assert.equal(view.rows.length, MISSIONS.length, 'the finished page is not the whole catalogue');
    assert.deepEqual(
      view.rows.slice(0, closed.length).map((row) => row.id),
      closed,
      'the rooms still closed are not the ones the page opens on',
    );
    assert.deepEqual(
      view.rows.slice(closed.length).map((row) => row.id),
      [...WELCOME_PATH],
      'the walked rooms are not below, in path order',
    );

    for (const row of view.rows.slice(0, closed.length)) {
      assert.equal(row.lit, false);
      assert.equal(row.line, missionOf(row.id).goalEn, 'a closed room stopped naming the situation');
      // Never a sentence about the learner. The founder's setting is to name the
      // situation and never the feeling, and `goalEn` is the catalogue's own
      // description of what happens in the room.
      assert.doesNotMatch(row.line, /\byou (still |cannot|can't|have not|haven't)/i, 'the line is about the learner');
    }
    for (const row of view.rows.slice(closed.length)) {
      assert.equal(row.lit, true);
      assert.equal(row.line, missionOf(row.id).winEn, 'a walked room stopped reading its own win');
    }
  });

  test('the closed rooms carry no borrowed French, because they have never been walked', () => {
    const view = viewFor(WALKED_ALL, [saidCard("phrase:je peux payer par carte ?", 'Je peux payer par carte ?', 6)]);
    for (const row of view.rows.filter((entry) => !entry.lit)) {
      assert.equal(row.yours, null, 'a room the learner has never been in is quoting French at them');
      assert.equal(row.next, null, 'a room with no rung yet was given a rung above');
    }
  });

  test('a half walked path is four rows too, two of each kind', () => {
    const view = viewFor([finished('mission:cafe'), finished('mission:hotel')]);
    const rows = view.rows;
    assert.equal(rows.length, 4);
    assert.equal(litCount(rows), 2);
    assert.equal(view.problemFirst, false, 'a half walked path was opened on a gap page');
    assert.deepEqual(
      rows.map((row) => row.lit),
      [true, true, false, false],
      'the rows are not in path order, so the map reshuffles as it fills',
    );
  });
});

describe('a row is lit by having been there', () => {
  test('one finish at the lowest rung lights the room', () => {
    // The trap this avoids: `isStamped` in passport.ts is true only at
    // 'on-your-own', so a learner who finished all four at rung 1 -- the modal
    // free learner, since the ladder opens low -- would have read a completion
    // line over four empty marks.
    const rows = mapFor([finished('mission:cafe', 1)]);
    const cafe = rows.find((row) => row.id === 'mission:cafe');
    assert.ok(cafe);
    assert.equal(cafe.lit, true, 'a finish at rung 1 did not light the room');
    assert.equal(cafe.line, missionOf('mission:cafe').winEn);
  });

  test('the row reads timesFinished and never the review state or the independence', () => {
    const code = wallMapCode();
    assert.match(code, /timesFinished > 0/, 'the lit rule is no longer a fact about what the learner did');
    assert.doesNotMatch(code, /\bisStamped\b/, 'the map is reading the passport, which asks a different question');
    assert.doesNotMatch(code, /state === '|independence/, "a row's light moved onto the review scheduler's calendar");
  });
});

describe("a walked room carries a line of the learner's French", () => {
  const cafe = missionOf('mission:cafe');

  test('their own line wins, and the most used one wins among those', () => {
    const [first, second] = cafe.phraseKeys;
    assert.ok(first && second, 'the cafe mission no longer drills two phrases');
    const deck = [saidCard(first, 'une première', 2), saidCard(second, 'une seconde', 9)];
    const row = mapFor([finished('mission:cafe')], deck).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.yours, 'une seconde', 'the row is not showing the phrase they reached for most');
    assert.equal(row.yoursIsTheirs, true);
  });

  test('a phrase with no conversational use behind it does not count as theirs', () => {
    const [first] = cafe.phraseKeys;
    assert.ok(first);
    // Practised but never said in a room: `isRetained` wants convoUses >= 1, and
    // this is the boundary where a true claim becomes a false one.
    const deck = [saidCard(first, 'une pratiquee', 0)];
    const row = mapFor([finished('mission:cafe')], deck).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.yoursIsTheirs, false);
    assert.equal(row.yours, cafe.referencePhrases[0], 'the honest fallback is a line the mission taught');
  });

  test("another room's phrase is never borrowed to fill a row", () => {
    const hotelPhrase = missionOf('mission:hotel').phraseKeys[0];
    assert.ok(hotelPhrase);
    const deck = [saidCard(hotelPhrase, 'la ligne de hotel', 7)];
    const row = mapFor([finished('mission:cafe')], deck).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.notEqual(row.yours, 'la ligne de hotel', 'a row is quoting French the learner said somewhere else');
    assert.equal(row.yoursIsTheirs, false);
  });

  test('a sound is never quoted as something the learner said, however often it was used', () => {
    const [first] = cafe.phraseKeys;
    assert.ok(first);
    // `isRetained` wants a phrase, and a phoneme card is not one. A row quoting an
    // IPA symbol back at a learner as "your French" would be the wall making a
    // claim out of the one card kind that carries no sentence.
    const deck = [saidCard(first, '/y/', 9, 'phoneme')];
    const row = mapFor([finished('mission:cafe')], deck).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.yoursIsTheirs, false);
    assert.equal(row.yours, cafe.referencePhrases[0]);
  });

  test('an unwalked room quotes nothing at all, because they have not been there', () => {
    const [first] = cafe.phraseKeys;
    assert.ok(first);
    const deck = [saidCard(first, 'une dite', 5)];
    const row = mapFor([], deck).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.yours, null);
    assert.equal(row.yoursIsTheirs, false);
  });
});

describe('the rung above, and the name it needs', () => {
  test("a finish at rung 1 offers rung 2 in the tutor's words", () => {
    const row = mapFor([finished('mission:cafe', 1)], [], TUTOR_NAME).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.next, 'Choose a reply and say it');
  });

  test('rung 1 is the one line that needs the name, and without a profile the row withholds it', () => {
    const named = mapFor([finished('mission:cafe', 2)], [], TUTOR_NAME).find((entry) => entry.id === 'mission:cafe');
    assert.ok(named);
    assert.equal(named.next, 'Say it in your own words');

    // rungLabel renders rung 1 as `Repeat after ${tutorName}`, so a row drawn
    // before the profile loaded would either guess a name or print the word
    // undefined at a learner. It says nothing instead.
    const nameless = mapFor([finished('mission:cafe', 1)], [], null).find((entry) => entry.id === 'mission:cafe');
    assert.ok(nameless);
    assert.equal(nameless.next, null);
    assert.equal(nameless.lit, true, 'a row is incomplete without the name rather than merely quieter');
  });

  test('an unwalked room has no rung above, because it has no rung yet', () => {
    const row = mapFor([]).find((entry) => entry.id === 'mission:cafe');
    assert.ok(row);
    assert.equal(row.next, null);
  });
});

describe('the free path is four of the six, and the split is total', () => {
  test('every situation is either on the path or beyond it, and none is both', () => {
    const beyond = beyondWelcomePath().map((mission) => mission.id);
    assert.equal(WELCOME_PATH.length, 4);
    assert.equal(beyond.length, MISSIONS.length - WELCOME_PATH.length);
    assert.deepEqual(
      [...WELCOME_PATH, ...beyond].sort(),
      MISSIONS.map((mission) => mission.id).sort(),
      'a situation is in neither half or in both',
    );
    for (const id of WELCOME_PATH) assert.equal(onWelcomePath(id), true);
    for (const id of beyond) assert.equal(onWelcomePath(id), false);
  });

  test('the two held back are authored, so the wall can name what it is offering', () => {
    for (const mission of beyondWelcomePath()) {
      assert.ok(mission.goalEn.length > 0, `${mission.id} has no goal to offer`);
      assert.ok(mission.winEn.length > 0, `${mission.id} has no win to end on`);
    }
  });

  test('the path opens on the cafe, for the reason the catalogue gives about itself', () => {
    assert.equal(WELCOME_PATH[0], 'mission:cafe');
    assert.equal(welcomeMissions()[0]?.id, 'mission:cafe');
    assert.deepEqual(welcomeMissions().map((mission) => mission.id), [...WELCOME_PATH], 'path order is not display order');
  });

  test('the path climbs, rather than putting both A1 rooms first', () => {
    assert.deepEqual(welcomeMissions().map((mission) => mission.cefr), ['A0', 'A0', 'A1', 'A1']);
  });
});

describe('the map makes no claim about money', () => {
  test('nothing a row carries mentions a plan, a price or a lock', () => {
    const code = wallMapCode();
    // The picture would be identical if the app were free, which is what lets the
    // wall be shown more than once without curdling. A padlock is an accusation;
    // an unvisited place is an invitation, and path.ts already quotes PRODUCT.md's
    // first principle as the reason every authored node is open in any order.
    for (const word of ['price', 'localizedPrice', 'padlock', 'locked', 'purchase', 'subscri', 'entitlement']) {
      assert.doesNotMatch(
        code,
        new RegExp(word, 'i'),
        `the map is reading ${word}, so a row now reports something about payment`,
      );
    }
  });
});
