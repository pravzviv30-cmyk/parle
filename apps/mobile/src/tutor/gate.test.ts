import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  isEntryMode,
  lessonStart,
  minutesRemainingLine,
  scenarioCountLine,
  TUTOR_INTRO_LINK,
  TUTOR_LESSON_QUIET_LINK,
  TUTOR_OFFLINE,
  tutorDoors,
  tutorGate,
} from './gate.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

describe('the door to a conversation — what the health probe decides', () => {
  test('a learner whose tutor servers are down stays on the tutor tab with honest words', () => {
    const decision = tutorGate(false);
    assert.equal(decision.go, false, 'a probe that came back empty must not send anyone to a live screen');
    if (decision.go) return;
    // Honest means it names the situation and offers the way forward, rather
    // than mounting a screen that will fail a second later with a Back button.
    assert.equal(decision.offline.body, TUTOR_OFFLINE.body);
    assert.ok(decision.offline.body.length > 0, 'staying put without saying why is the dead end wearing a different coat');
    assert.equal(decision.offline.retry, 'Check again');
  });

  test('the same button starts the conversation once the servers answer again', () => {
    const decision = tutorGate(true);
    assert.equal(decision.go, true, 'a server that answered is a server the learner may talk to');
    if (!decision.go) return;
    assert.equal(decision.screen, 'Convo');
    assert.equal(decision.params.textMode, false, 'the spoken door opens spoken');
    const typed = tutorGate(true, true);
    assert.deepEqual(typed.go && typed.params, { textMode: true }, 'the quiet door keeps its quiet');
  });

  test('a learner who chose the quiet route is still on it when the servers come back', () => {
    // The sequence that made this a defect: tap "Unable to speak right now?"
    // on a train, get held back, wait, tap Check again. Retrying as spoken
    // hands someone in a quiet carriage the exact thing the typed route exists
    // to spare them, so the held-back start has to remember which start it was.
    const held = tutorGate(false, true);
    assert.equal(held.go, false);
    if (held.go) return;
    assert.equal(held.heldBack.textMode, true, 'a held start that forgets the route cannot retry it');

    const retried = tutorGate(true, held.heldBack.textMode);
    assert.equal(retried.go, true);
    assert.deepEqual(
      retried.go && retried.params,
      { textMode: true },
      'the servers coming back is no reason to start talking out loud',
    );
  });

  test('the spoken route still comes back spoken, so remembering does not simply invert it', () => {
    const held = tutorGate(false, false);
    assert.equal(held.go && false, false);
    if (held.go) return;
    assert.equal(held.heldBack.textMode, false);
    const retried = tutorGate(true, held.heldBack.textMode);
    assert.deepEqual(retried.go && retried.params, { textMode: false }, 'a spoken start retries spoken');
  });

  test('the quiet route is held to the same answer as the spoken one', () => {
    // Typing needs the same token server, so offering it as an escape from a
    // dead one would promise an exit that fails identically.
    assert.equal(tutorGate(false, true).go, false, 'typed mode cannot outrun a server that is not there');
  });

  test('nothing the offline card says carries a number or blames anyone', () => {
    const words = Object.values(TUTOR_OFFLINE);
    for (const line of words) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|error|incorrect)\b/i.test(line), `"${line}" scolds or shrugs`);
    }
  });
});

describe('the doors on the tutor tab — what a learner meets instead of a manual', () => {
  const tab = stripComments(read('../tabs/TutorTab.tsx'));
  const profileTab = stripComments(read('../tabs/ProfileTab.tsx'));
  const intro = stripComments(read('./TutorIntro.tsx'));
  /** A mission worth offering again, as the tab reads it off the catalogue. */
  const RECENT = { title: 'Au café du coin', goalEn: 'Order at a café', place: 'cafe' as const, minutesRemaining: null };
  /** How many situations the catalogue holds, as the tab hands it in. */
  const SITUATIONS = 6;
  /** The scripted lesson's French title, as the tab reads it off the catalogue. */
  const LESSON = 'Commander un café';

  test("the tutor's doors say their counts as numbers, their words without a digit, and pill the resume and the open conversation — F404", () => {
    const all = tutorDoors(RECENT, SITUATIONS, LESSON);
    const resume = all.find((d) => d.key === 'resume');
    const missions = all.find((d) => d.key === 'missions');
    const lesson = all.find((d) => d.key === 'lesson');
    const free = all.find((d) => d.key === 'free');

    // The two counts travel as numbers, because a numeral inside prose is a
    // numeral nothing can round, pluralise or withhold. The count is handed in
    // rather than read off the catalogue here, so gate.ts stays on its own.
    assert.equal(missions!.count, SITUATIONS, 'the missions door does not carry how many situations are behind it');
    assert.equal(tutorDoors(null, 3, LESSON).find((d) => d.key === 'missions')!.count, 3, 'the door counts the catalogue itself instead of being told');
    assert.equal(resume!.count, null, 'the resume door counts something; there is one scene behind it, not a list');
    assert.equal(free!.count, null, 'the open conversation counts something; there is nothing there to count');

    // Minutes remaining is a measurement or it is absent. Null for everybody
    // until missions/resume.ts extrapolates it from the learner's own pace: an
    // authored constant dressed as a measurement is the one thing this field
    // must never carry.
    assert.equal(resume!.minutesRemaining, null, 'the resume door invents an estimate that nothing measured');
    assert.equal(
      tutorDoors({ ...RECENT, minutesRemaining: 3 }, SITUATIONS, LESSON)[0]!.minutesRemaining,
      3,
      'a measurement that exists does not reach the door that would show it',
    );
    assert.equal(missions!.minutesRemaining, null);
    assert.equal(lesson!.minutesRemaining, null, 'the scripted lesson carries an estimate nothing measured');
    assert.equal(free!.minutesRemaining, null);

    // And exactly two functions turn a number into words, singulars included,
    // so no screen ever spells one.
    assert.equal(scenarioCountLine(SITUATIONS), '6 scenarios');
    assert.equal(scenarioCountLine(1), '1 scenario', 'one situation reads as "1 scenarios"');
    assert.equal(scenarioCountLine(0), '0 scenarios', 'an empty catalogue reads as "0 scenario"');
    assert.equal(minutesRemainingLine(4), 'About 4 min remaining');
    assert.equal(minutesRemainingLine(1), 'About 1 min remaining', 'one minute reads as "1 mins"');
    // "About" is load-bearing rather than polite: the number behind it is
    // extrapolated from a learner's own pace, and a bare "3 min remaining" is a
    // claim about the future that nothing in this app can support.
    assert.match(minutesRemainingLine(3), /^About /, 'an estimate is stated as a fact');

    // One pill per door. The founder's screenshot gives the resume card and the
    // open conversation a button each and turns the missions door into a list
    // of rows, so the missions door carries none.
    assert.deepEqual(
      tutorDoors(RECENT, SITUATIONS, LESSON).filter((d) => d.primary).map((d) => d.key),
      ['resume'],
      'the pill sits somewhere other than the scene to pick up; the circle is the way into an open chat (F547)',
    );
    assert.equal(missions!.primary, false, 'the list of rows grew a button of its own');
    assert.equal(resume!.action, 'Resume');
    assert.equal(missions!.action, 'See all situations', 'the missions door keeps its fold word even with no button on it');
    assert.equal(free!.action, 'Open chat');
    assert.equal(free!.title, 'Talk about your day', 'the open conversation stopped saying what there is to talk about');

    // Every word on every door: no count, no dash, nothing that scolds, and
    // nothing off the one shared list of words this app promised not to say.
    for (const door of [...tutorDoors(RECENT, SITUATIONS, LESSON), ...tutorDoors(null, 1, LESSON)]) {
      for (const line of [door.label, door.title ?? '', door.gloss, door.action]) {
        assert.ok(!/\d/.test(line), `"${line}" carries a number`);
        assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
        assert.ok(!/\b(wrong|bad|failed|error|incorrect|streak)\b/i.test(line), `"${line}" scolds`);
        assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
      }
      assert.match(door.action, /^[A-Z][a-z]+(?: [a-z]+)*$/, `"${door.action}" is not sentence case`);
    }
  });

  /**
   * F406 changed this rule and F364 is where it used to live, so both are named.
   *
   * F364's title said "exactly one carries the pill", and that clause has moved,
   * not gone: `surfaceContract.test.ts` now pins the count per tab (Home 1,
   * Tutor 2) rather than asserting it here from the model, which is a stricter
   * check in a place a third pill cannot creep past. What stayed here is what
   * F364 was really about, and it is unchanged: every door is a card that says
   * what is behind it, in the model's words rather than the screen's.
   *
   * The resume door lost two things to the founder's screenshot, both
   * deliberately: the orange status pill, and the `detail` slot that carried its
   * sentence. What is left of a scene is a number now, checked in the F404 test
   * beside the formatter that words it.
   */
  test('each door is a card that says what is behind it — F364', () => {
    const all = tutorDoors(RECENT, SITUATIONS, LESSON);
    const resume = all.find((d) => d.key === 'resume');
    const missions = all.find((d) => d.key === 'missions');
    const lesson = all.find((d) => d.key === 'lesson');
    const free = all.find((d) => d.key === 'free');
    assert.deepEqual(resume!.art, { kind: 'place', place: 'cafe' }, 'the resume door does not show its place');
    assert.equal(resume!.title, 'Au café du coin', 'the resume door does not name the scene in French');
    assert.equal(resume!.gloss, RECENT.goalEn, 'the resume door does not say what the learner came to do');
    assert.equal(resume!.action, 'Resume');
    assert.equal(resume!.primary, true, 'the scene a learner left half done is not the card they can press');

    // The practical-mission door is the list, so it carries no button of its
    // own: every row is its own way in.
    assert.deepEqual(missions!.art, { kind: 'every-place' });
    assert.equal(missions!.action, 'See all situations');
    assert.equal(missions!.primary, false, 'the missions door grew a button, and its rows are the way in');
    assert.equal(missions!.count, SITUATIONS, 'the missions door does not say how many situations there are');
    assert.equal(
      tutorDoors(null, SITUATIONS, LESSON).find((d) => d.key === 'missions')!.primary,
      false,
      'with nothing to continue the missions door took a pill, and its rows are still the way in',
    );

    // The scripted lesson stands between the two, and it is the one door with a
    // fixed script behind it. Its own block below owns the rest of what it says.
    assert.equal(lesson!.key, 'lesson', 'the scripted lesson is not the third door any more');
    assert.equal(lesson!.primary, false, 'the scripted lesson took a pill, and the tab draws exactly one');

    // Open chat shows no place, because it has none, and it is a row now
    // (F547): the circle at the top of the tab is the way into an open chat,
    // and a second pill for the same door was a second answer to one question.
    assert.deepEqual(free!.art, { kind: 'none' });
    assert.equal(free!.action, 'Open chat');
    assert.equal(free!.primary, false);
    assert.equal(
      tutorDoors(null, SITUATIONS, LESSON).at(-1)!.key,
      'lesson',
      'the lesson is no longer the last door, so a beginner meets a fixed script before the situations',
    );
    // The three entry modes sit together, under one heading, and none is a pill.
    assert.deepEqual(all.filter((d) => isEntryMode(d.key)).map((d) => d.key), ['everyday', 'free', 'rehearse']);
    assert.ok(all.filter((d) => isEntryMode(d.key)).every((d) => !d.primary), 'an entry mode grew a pill');
    assert.equal(all.find((d) => d.key === 'everyday')!.action, 'Choose a situation');
    assert.equal(all.find((d) => d.key === 'rehearse')!.action, 'Bring a real moment');

    // Every word on every door: no count, no dash, nothing that scolds.
    for (const door of [...tutorDoors(RECENT, SITUATIONS, LESSON), ...tutorDoors(null, SITUATIONS, LESSON)]) {
      for (const line of [door.label, door.title ?? '', door.gloss, door.action]) {
        assert.ok(!/\d/.test(line), `"${line}" carries a number`);
        assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
        assert.ok(!/\b(wrong|bad|failed|error|incorrect|streak)\b/i.test(line), `"${line}" scolds`);
      }
      assert.match(door.action, /^[A-Z][a-z]+(?: [a-z]+)*$/, `"${door.action}" is not sentence case`);
    }

    // And the tab draws what the model says, from the model.
    for (const marker of ['door.art.kind', 'door.title', 'door.gloss', 'door.action', '<MissionDisc']) {
      assert.ok(tab.includes(marker), `the tab never draws ${marker}`);
    }
  });

  test('the tutor tab opens its doors without the intro standing in the way', () => {
    // Four explainer pages used to sit between a new account and the first
    // French sentence, which is the one place in this product nothing is
    // allowed to sit. The doors do not know the intro exists.
    const doors = tutorDoors(null, SITUATIONS, LESSON);
    assert.deepEqual(doors.map((d) => d.key), ['everyday', 'free', 'rehearse', 'missions', 'lesson'], 'the doors changed shape');
    assert.deepEqual(
      doors.filter((d) => d.primary).map((d) => d.key),
      [],
      'with nothing to pick back up, no door carries a pill: the circle is the way into an open chat',
    );

    const withRecent = tutorDoors(RECENT, SITUATIONS, LESSON);
    assert.deepEqual(withRecent.map((d) => d.key), ['resume', 'everyday', 'free', 'rehearse', 'missions', 'lesson']);
    assert.equal(withRecent[0]?.title, 'Au café du coin', 'continuing does not say which mission');
    // The rule is one pill per door rather than one per screen (F404): the
    // missions door became a list of rows, and a list with a button at the
    // bottom of it is a second answer to the question the rows already ask.
    assert.deepEqual(
      withRecent.filter((d) => d.primary).map((d) => d.key),
      ['resume'],
      'a door that is a list of rows carries a button, or the scene to pick back up does not',
    );

    // And the tab itself no longer holds anybody at the door.
    assert.ok(!tab.includes('hasSeenTutorIntro'), 'the tab still reads the intro flag to decide what to show');
    assert.doesNotMatch(tab, /if\s*\(\s*!seenIntro\s*\)/, 'the intro is still the first thing on the tab');
    assert.ok(tab.includes('tutorDoors('), 'the tab decides its own doors again');
  });

  test('the intro is still reachable, and still teaches the circle', () => {
    // Demoted, not deleted. It is the only place in the app that says what the
    // three colours of the circle mean, so taking it out would take that with
    // it. Two quiet links, worded identically, because one wording is one thing
    // to look for.
    // "The voice circle" rather than "the circle": the tab now draws a circle
    // to speak into and six discs of place, and a link that says "the circle"
    // beside them is a link about whichever one the reader was looking at.
    assert.equal(TUTOR_INTRO_LINK, 'How the voice circle works');
    for (const [name, source] of [['the tutor tab', tab], ['profile', profileTab]] as const) {
      assert.ok(source.includes('TUTOR_INTRO_LINK'), `${name} lost its way back to the intro`);
      assert.ok(source.includes('<TutorIntro'), `${name} links to an intro it never renders`);
    }
    assert.ok(intro.includes('OrbWalkthrough'), 'the intro lost the page that teaches the circle');
    assert.ok(intro.includes('Amber, it is thinking'), 'the intro stopped naming the thinking colour');
    assert.ok(intro.includes('Green, your turn'), 'the intro stopped saying green means you speak');
  });
});

/**
 * The scripted lesson had one way in, and it was on another tab.
 *
 * `tabs/PracticeTab.tsx` held the only `navigate('Lesson')` in the whole app,
 * so a Practice tab rebuilt without that row deletes the scripted lesson from
 * the product without deleting a line of it. That is the kind of removal
 * nothing notices: the screen still builds, the tests still pass, and the
 * feature is simply unreachable.
 *
 * It is not a mission and it is not free conversation. The script is known in
 * advance, which is the only reason pronunciation can be scored at all
 * (docs/ARCHITECTURE.md, "Two paths, one ladder"), so it gets a door of its own
 * here rather than a row inside the mission chooser, where it would read as a
 * seventh situation and lose the one thing that makes it different.
 */
describe('the scripted lesson is a door of its own on the tutor tab', () => {
  /** A mission worth offering again, as the tab reads it off the catalogue. */
  const RECENT = { title: 'Au café du coin', goalEn: 'Order at a café', place: 'cafe' as const, minutesRemaining: null };
  const SITUATIONS = 6;
  const LESSON = 'Commander un café';

  test('the lesson stands between the guided situations and the open conversation, and takes no pill', () => {
    assert.deepEqual(
      tutorDoors(RECENT, SITUATIONS, LESSON).map((d) => d.key),
      ['resume', 'everyday', 'free', 'rehearse', 'missions', 'lesson'],
      'the scripted lesson has no door, or it is not the last one, after the situations',
    );
    assert.deepEqual(
      tutorDoors(null, SITUATIONS, LESSON).map((d) => d.key),
      ['everyday', 'free', 'rehearse', 'missions', 'lesson'],
      'the lesson door comes and goes with the resume card, and it has nothing to do with one',
    );

    const lesson = tutorDoors(RECENT, SITUATIONS, LESSON).find((d) => d.key === 'lesson')!;
    // Not first. The guided situations are what a beginner should meet, which
    // `chooserView.test.ts` pins from the other side, and the open conversation
    // stays last for the reason it has always been last.
    assert.equal(lesson.primary, false, 'the lesson took a pill; the tab draws exactly one and it is the resume card\'s');
    assert.equal(lesson.count, null, 'the lesson door counts something; there is one script behind it, not a list');
    assert.equal(lesson.minutesRemaining, null, 'the lesson door carries an estimate nothing measured');
    assert.deepEqual(lesson.art, { kind: 'place', place: 'cafe' }, 'the lesson door lost the drawing of where it is set');
  });

  test('the lesson door reads its title off the catalogue rather than spelling it', () => {
    // The resume door's title arrives as data for the same reason: a title
    // spelled twice is a door that lies the day core renames the scene behind
    // it. `missionCount` set this precedent, and this follows it exactly.
    assert.equal(tutorDoors(null, SITUATIONS, LESSON).find((d) => d.key === 'lesson')!.title, LESSON);
    assert.equal(
      tutorDoors(null, SITUATIONS, 'Autre chose').find((d) => d.key === 'lesson')!.title,
      'Autre chose',
      'the title is written into gate.ts, so a lesson renamed in core leaves this door saying the old name',
    );
  });

  test('the lesson door says what is different about it, in words nothing else has to round', () => {
    const lesson = tutorDoors(RECENT, SITUATIONS, LESSON).find((d) => d.key === 'lesson')!;
    // The one honest reason to send someone here rather than into a mission:
    // the words are given, so the tutor can listen to how they are said.
    assert.match(lesson.gloss, /listens/, 'the lesson door never says what it is for');
    assert.notEqual(lesson.label, 'Guided practice missions', 'the lesson door wears the missions heading');
    assert.match(lesson.action, /^[A-Z][a-z]+(?: [a-z]+)*$/, `"${lesson.action}" is not sentence case`);
    for (const line of [lesson.label, lesson.title ?? '', lesson.gloss, lesson.action, TUTOR_LESSON_QUIET_LINK]) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
    }
    // Two controls on one card, so they cannot ask the same question. The
    // footer's "Unable to speak right now?" belongs to the conversation and is
    // worded as a question; this one names its own door.
    assert.notEqual(
      TUTOR_LESSON_QUIET_LINK,
      'Unable to speak right now?',
      'the lesson borrows the conversation\'s words, so one screen asks the same question twice and means two places',
    );
  });

  test('the lesson opens whether or not the probe came back, because there is an offline lesson to open', () => {
    assert.deepEqual(lessonStart(false), { screen: 'Lesson', params: undefined }, 'the spoken lesson asks for text mode');
    assert.deepEqual(lessonStart(true), { screen: 'Lesson', params: { textMode: true } }, 'the quiet lesson opens spoken');

    // This is the whole reason the lesson is not held back the way the
    // conversation is. `tutorGate` refuses a dead server because there is no
    // conversation without one; with no token server the navigator mounts the
    // mock session instead, which runs the entire ladder locally, so holding
    // the learner back here would refuse them the one thing the offline card
    // already promises: "Practice still works." If either half of that goes,
    // this fails and the decision gets taken again rather than inherited.
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(
      navigator,
      /<SessionScreen key="mock"/,
      'the offline lesson is gone, so opening the lesson on a dead server is a dead end now',
    );
    assert.match(TUTOR_OFFLINE.headline, /Practice still works/, 'the offline card stopped promising the practice that still works');
    assert.match(navigator, /textMode=\{textMode\}/, 'the Lesson route stopped honouring textMode, so the quiet door leads nowhere');
  });
});
