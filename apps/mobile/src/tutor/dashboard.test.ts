/**
 * The words at the top of the Tutor tab — F404.
 *
 * The tab used to open on a greeting that changed with the hour, so the header
 * said something different at breakfast and at bedtime and was never a landmark.
 * The founder's screenshot opens on the tutor instead. That is the change these
 * assertions hold: a header that names one person and does not move, a purpose
 * line under it, and one line under the circle that promises nothing about how
 * well anybody is going to do.
 *
 * `firstNameOf` outlived the greeting that needed it, because `home/greeting.ts`
 * imports it. One name rule for the whole app, so no two screens can disagree
 * about what a learner is called.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import * as dashboard from './dashboard.ts';
import {
  KEEP_GOING,
  MAX_ONLY_ARC,
  PICK_IT_UP,
  SEE_MEMORY,
  TUTOR_ORB_SUBLINE,
  TUTOR_PURPOSE,
  continuityRow,
  firstNameOf,
  tutorHeading,
} from './dashboard.ts';
import type { Thread } from './threads.ts';

describe('the tutor tab opens on the tutor, not on the hour — F404', () => {
  test("the tutor heading names the tutor and the subline is the screenshot's — F404", () => {
    // The name is the tutor's. `tutorNameOf` has already resolved whichever
    // voice the learner chose, so this only sets it.
    assert.equal(tutorHeading('Margot'), 'Your Tutor, Margot', 'the header does not name the tutor the learner chose');
    assert.equal(tutorHeading('Céline'), 'Your Tutor, Céline', 'a name written with an accent is not set as it is written');

    // Same header at every hour. The clock is gone from this module, and with
    // it the reason a learner could not use the top of the page as a landmark.
    assert.ok(!('tutorGreeting' in dashboard), 'the hourly greeting is back, so the header changes by the time of day again');
    assert.ok(!('tutorGreetingSubline' in dashboard), 'the greeting subline is back beside the one the screenshot asked for');
    // The words at the top of the tab are exactly three: the header, the line
    // under it and the line under the circle. A fourth up here would be a
    // fourth thing to read before speaking. The rest of this module belongs to
    // the remembers row, which is one row lower and has its own block below.
    assert.deepEqual(
      Object.keys(dashboard).sort(),
      [
        'KEEP_GOING',
        'MAX_ONLY_ARC',
        'PICK_IT_UP',
        'SEE_MEMORY',
        'TUTOR_ORB_SUBLINE',
        'TUTOR_PURPOSE',
        'continuityRow',
        'firstNameOf',
        'tutorHeading',
      ],
      'the tutor page module grew or lost an export, and every line it holds is a line a learner reads before speaking',
    );

    // The two lines the screenshot puts under the header and under the circle.
    // British spelling on purpose: the rest of the app says "judgement", and a
    // second convention inside one app costs more than either spelling is worth.
    assert.equal(TUTOR_PURPOSE, 'Speak naturally. Zero judgement.');
    assert.equal(TUTOR_ORB_SUBLINE, 'Gentle guidance, no pressure.');

    // Nothing up here is a count, a dash, a scold or a hurry. The circle's line
    // says what the conversation is like, and it names no pressure at all.
    for (const line of [tutorHeading('Margot'), TUTOR_PURPOSE, TUTOR_ORB_SUBLINE]) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number, and the header is not a place a count belongs`);
      assert.ok(!/[—%]/.test(line), `"${line}" carries an em dash or a percentage`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
      assert.ok(!/\b(hurry|quick|only|score|wrong)\b/i.test(line), `"${line}" puts something on the learner before they have spoken`);
    }
  });

  test('a learner who gave a full name is called by the first of it, and one who skipped is not named at all', () => {
    assert.equal(firstNameOf('  Amina Rahman  '), 'Amina', 'a padded full name is not split down to the name a learner uses');
    assert.equal(firstNameOf('Amina'), 'Amina', 'a single name is left alone');
    assert.equal(firstNameOf('  '), null, 'a blank name is read as a name');
    assert.equal(firstNameOf(null), null, 'a learner who skipped the name page is named anyway');
    assert.equal(firstNameOf(undefined), null, 'a profile with no name yet is named anyway');
  });
});

/**
 * The remembers row, which is where a learner picks a thread back up — F573.
 *
 * It was a card with an outline button under it, and the button had three
 * states: pick a scene back up, keep a conversation going, or a paragraph
 * saying that keeping one going is the Max plan's. Revamp A makes it one tinted
 * row, and a row has no button, so the promise moved into what the row says and
 * what it says to a screen reader.
 *
 * The arm worth reading twice is the plan-gated one. A row that says "Keep
 * talking about your weekend" and opens a plans page is a trapdoor, so the
 * sentence about the plan stays on glass: the learner is told where the row
 * goes before they press it, and nothing is refused mid-tap.
 */
describe('what the tutor remembers, as the row a learner presses — F573', () => {
  const SCENE = { kind: 'scene' as const, missionId: 'mission:market', line: 'Au marche is waiting where you left it.' };
  const PACK = {
    kind: 'pack' as const,
    packId: 'pack-1',
    seedTopic: { fr: 'Ton week-end', en: 'Your weekend' },
    line: 'Keep talking about your weekend.',
  };
  const MEMORY = 'Last time you talked about your neighbour.';
  const row = (thread: Thread | null, continueAllowed = true) =>
    continuityRow({ headline: 'Margot remembers', line: MEMORY, thread, continueAllowed });

  test('a scene the learner walked out of is picked back up from the row, in the scene they left', () => {
    const scene = row(SCENE);
    assert.equal(scene.gloss, SCENE.line, 'the row says something other than the scene that is waiting');
    assert.equal(scene.hint, PICK_IT_UP, 'the row never says what pressing it does');
    assert.deepEqual(
      scene.route,
      { screen: 'Convo', params: { missionId: 'mission:market' }, markPack: null },
      'the row opens a conversation that is not the one the learner left',
    );
    // The mark belongs to a pack that was carried on, and this is not one. A
    // mark written here would retire a thread nobody picked up.
    assert.equal(scene.route.markPack, null, 'picking a scene back up marks a conversation as continued');
  });

  test('a conversation the learner finished is carried on, and the pack is marked so it is not offered twice', () => {
    const pack = row(PACK);
    assert.equal(pack.gloss, PACK.line);
    assert.equal(pack.hint, KEEP_GOING);
    assert.deepEqual(pack.route, {
      screen: 'Convo',
      params: { seedTopic: { fr: 'Ton week-end', en: 'Your weekend' } },
      markPack: 'pack-1',
    });
  });

  test('a learner whose plan does not carry a conversation across sessions is told so before they press, not after', () => {
    const gated = row(PACK, false);
    assert.ok(gated.gloss.includes(PACK.line), 'the gated row stops saying what the thread is about');
    assert.ok(
      gated.gloss.includes(MAX_ONLY_ARC),
      'the row opens the plans page without ever saying it will, which is a trapdoor rather than a door',
    );
    assert.equal(gated.hint, MAX_ONLY_ARC);
    assert.deepEqual(
      gated.route,
      { screen: 'Wall', params: { entry: 'settings' }, markPack: null },
      'a plan that does not open this door still sends the learner into the room and refuses them there',
    );
    // Said once. The sentence is already on the row, so repeating it after the
    // row would read it twice to somebody listening.
    assert.equal(gated.label, `Margot remembers. ${gated.gloss}`, 'the plan line is read out twice in a row');
  });

  test('a learner with nothing to carry on is offered what the tutor remembers, and never an invented conversation', () => {
    const none = row(null);
    assert.equal(none.gloss, MEMORY, 'the row with no thread says something the learner never did');
    assert.equal(none.hint, SEE_MEMORY);
    assert.deepEqual(
      none.route,
      { screen: 'TutorMemory', params: undefined, markPack: null },
      'a row with no thread behind it opens a conversation anyway, which is the app inventing a history',
    );
  });

  test('every word the row can say is plain, unhurried and free of a count', () => {
    const rows = [row(SCENE), row(PACK), row(PACK, false), row(null)];
    for (const one of rows) {
      for (const line of [one.gloss, one.hint, one.label]) {
        assert.ok(!/\d/.test(line), `"${line}" carries a number`);
        assert.ok(!/[—%]/.test(line), `"${line}" carries an em dash or a percentage`);
        assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
        assert.ok(!/\b(wrong|bad|failed|error|behind|streak)\b/i.test(line), `"${line}" scolds`);
      }
      // The whole row is said once, with the tutor's name first, so a learner
      // who hears the screen is told what the row is before what it does.
      assert.ok(one.label.startsWith('Margot remembers. '), 'the spoken row does not open on whose memory it is');
      assert.ok(one.label.includes(one.gloss), 'the spoken row leaves out the line that is drawn on it');
    }
  });
});
