import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  ENTRY_MODES_LABEL,
  entryStart,
  isEntryMode,
  lessonStart,
  minutesRemainingLine,
  scenarioCountLine,
  TUTOR_INTRO_LINK,
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

/**
 * Every source file under `src/`, stripped.
 *
 * The explainer link is asserted against the whole tree rather than against a
 * named screen, because it has moved twice: off the front of the Tutor tab,
 * then off the tab altogether. Naming the file that holds it today would be a
 * test that has to be edited every time somebody moves a link, which is a test
 * that gets edited rather than believed. What matters is that it is reachable.
 */
function sourceFiles(dir = fileURLToPath(new URL('..', import.meta.url))): { path: string; body: string }[] {
  const out: { path: string; body: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    if (entry.name === 'gate.ts') continue;
    out.push({ path: entry.name, body: stripComments(readFileSync(full, 'utf8')) });
  }
  return out;
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

/**
 * The three ways in, and what each of them opens — F547, F573.
 *
 * There were six doors here and the tab read as a contents page: a scene to
 * pick back up, three entry modes, a fold onto every situation, and the
 * scripted lesson. A learner who came to speak French met a menu.
 *
 * Revamp A takes it back to three rows, and none of what left was deleted. The
 * scene to pick back up is Home's hero and the remembers row; every situation
 * is on the chooser the everyday row opens; the scripted lesson is a door at
 * the foot of that chooser, which `missions/chooserView.test.ts` holds from the
 * other side; the explainer is a Settings row. Each of those is checked
 * somewhere, because a door nobody can reach is a feature deleted without a
 * line of it being deleted.
 */
describe('the three ways into a conversation — what a learner meets instead of a manual — F573', () => {
  const tab = stripComments(read('../tabs/TutorTab.tsx'));

  test('a learner meets a real situation, an open chat and rehearsing something, in that order and nothing else', () => {
    const doors = tutorDoors();
    assert.deepEqual(
      doors.map((d) => d.key),
      ['everyday', 'free', 'rehearse'],
      'the tab opens onto something other than the three ways the founder asked for',
    );
    // The everyday mission is first, and the open chat is never first: a
    // beginner staring at "say anything" is a beginner who says nothing. It is
    // still a door, because somebody who knows exactly what they want to talk
    // about must not have to walk through a mission to say it.
    assert.equal(doors[0]!.key, 'everyday', 'a beginner meets "say anything" before a situation');
    assert.ok(doors.some((d) => d.key === 'free'), 'the open conversation is gone from the tab entirely');

    // Six fields left this model with the cards they were written for: a French
    // title, a drawing, a count, an estimate, a word for a button and a flag
    // saying which door took the pill. A row is a mark, a line and a chevron.
    assert.deepEqual(
      doors.map((d) => Object.keys(d).sort()),
      [['gloss', 'key', 'label'], ['gloss', 'key', 'label'], ['gloss', 'key', 'label']],
      'a row carries a field nothing on the row draws, which is how the old model grew a slot that outlived its pill',
    );
    assert.equal(ENTRY_MODES_LABEL, 'Practice together', 'the three rows lost the one heading they sit under');
    for (const key of ['everyday', 'free', 'rehearse']) {
      assert.equal(isEntryMode(key), true, `${key} is a row on the tab and the guard does not know it`);
    }
    assert.equal(isEntryMode('lesson'), false, 'the scripted lesson reads as one of the three ways in');
  });

  test('each row says what it is and what is behind it, in a line short enough to read while walking', () => {
    const say = Object.fromEntries(tutorDoors().map((d) => [d.key, d]));
    assert.equal(say.everyday!.label, 'Explore everyday missions');
    assert.equal(say.everyday!.gloss, 'Practise French for everyday situations.');
    assert.equal(say.free!.label, 'Open conversation');
    assert.equal(say.free!.gloss, 'Bring a topic, or choose one together.');
    assert.equal(say.rehearse!.label, 'Prepare for a real moment');
    // British spelling, and a verb: the rest of the app says "practise" when it
    // is something a learner does, and a second convention inside one app costs
    // more than either spelling is worth.
    assert.equal(say.rehearse!.gloss, 'Rehearse something coming up in your life.');

    // Every word on every row: no count, no dash, nothing that scolds, and
    // nothing off the one shared list of words this app promised not to say.
    for (const door of tutorDoors()) {
      for (const line of [door.label, door.gloss]) {
        assert.ok(!/\d/.test(line), `"${line}" carries a number`);
        assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
        assert.ok(!/\b(wrong|bad|failed|error|streak)\b/i.test(line), `"${line}" scolds`);
        assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
        assert.ok(line.length <= 44, `"${line}" is too long to read on a row while walking`);
      }
      assert.match(door.label, /^[A-Z][a-z]+(?: [a-z]+)*$/, `"${door.label}" is not sentence case`);
    }
  });

  test('the open chat runs the same connection check the circle runs, and the other two need no server at all', () => {
    // The difference is not a detail. The open chat opens the same metered room
    // the circle opens, so it is probed; the chooser and the real moment cost
    // nothing and must not be refused because a health endpoint is asleep.
    assert.deepEqual(entryStart('free'), { probe: true }, 'the open chat walks into a live room without checking there is one');
    assert.deepEqual(
      entryStart('everyday'),
      { probe: false, screen: 'Missions' },
      'the everyday mission does not open the chooser, where a choice is made before a session spends anything',
    );
    assert.deepEqual(
      entryStart('rehearse'),
      { probe: false, screen: 'RealMoment' },
      'rehearsing something does not open the screen that asks what the real moment is',
    );
    // And Speak reads the answer rather than keeping a second copy of it.
    // 2026-09-27 (notebook Phase 3): the rows are "More ways to practise",
    // built in speakView.ts from this door model; the open conversation probes
    // spoken, like the one Start, and the other rows push their screen.
    const view = readFileSync(fileURLToPath(new URL('./speakView.ts', import.meta.url)), 'utf8');
    assert.match(view, /entryStart\(key\)/, 'Speak decides where a row goes instead of reading it from gate.ts');
    assert.match(tab, /if \(way\.screen === null\) \{ open\(modes\.textMode\); return; \}/, 'the open conversation does not probe in the preferred mode');
    assert.match(tab, /nav\.navigate\(way\.screen\)/, 'a secondary way in does not open its own screen');
  });

  test('the tab opens its rows with nothing standing in front of them', () => {
    // Four explainer pages used to sit between a new account and the first
    // French sentence, which is the one place in this product nothing is
    // allowed to sit. The rows do not know the intro exists.
    assert.ok(!tab.includes('hasSeenTutorIntro'), 'the tab still reads the intro flag to decide what to show');
    assert.doesNotMatch(tab, /if\s*\(\s*!seenIntro\s*\)/, 'the intro is still the first thing on the tab');
    assert.ok(!tab.includes('<TutorIntro'), 'the explainer is back in front of the tab');
    const view = readFileSync(fileURLToPath(new URL('./speakView.ts', import.meta.url)), 'utf8');
    assert.ok(view.includes('tutorDoors()') && tab.includes('MORE_WAYS.map('), 'the tab decides its own rows again');
  });

  test('the explainer is still reachable, and still teaches the circle', () => {
    // Demoted, not deleted, twice over: off the front of the tab with F404 and
    // off the tab altogether with F573, because a page with one circle on it
    // does not also need a link about circles. It is the only place in the app
    // that says what the circle's states mean, so it is asserted to be somewhere
    // rather than in a named file: whichever screen holds it, it is reachable.
    assert.equal(TUTOR_INTRO_LINK, 'How the voice circle works');
    const holders = sourceFiles().filter((file) => file.body.includes('label={CONNECTION_HELP_ROW}'));
    assert.ok(holders.length > 0, 'nothing in the app links to the explainer any more, so the circle is never explained');
    for (const holder of holders) {
      assert.ok(
        holder.body.includes('<TutorIntro') || /navigate\('TutorIntro'\)/.test(holder.body),
        `${holder.path} names the link and opens nothing`,
      );
    }
    const intro = stripComments(read('./TutorIntro.tsx'));
    assert.ok(intro.includes('OrbWalkthrough'), 'the intro lost the page that teaches the circle');
    // Revamp B (F595): the states are named in words, not colours, because the
    // orb now carries a glyph and a caption for each one.
    assert.ok(intro.includes("'It is thinking'"), 'the intro stopped saying what the thinking state means');
    assert.ok(intro.includes("'Your turn'"), 'the intro stopped saying the listening state means you speak');
  });

  test('the two formatters are still the only place a numeral becomes words', () => {
    // Neither row carries a count now, and both formatters stayed. A numeral
    // inside prose is a numeral nothing can round, pluralise or withhold, and a
    // screen that spells one is a screen that will get the singular wrong the
    // first time there is exactly one of something.
    assert.equal(scenarioCountLine(6), '6 scenarios');
    assert.equal(scenarioCountLine(1), '1 scenario', 'one situation reads as "1 scenarios"');
    assert.equal(scenarioCountLine(0), '0 scenarios', 'an empty catalogue reads as "0 scenario"');
    assert.equal(minutesRemainingLine(4), 'About 4 min remaining');
    assert.equal(minutesRemainingLine(1), 'About 1 min remaining', 'one minute reads as "1 mins"');
    // "About" is load-bearing rather than polite: the number behind it is
    // extrapolated from a learner's own pace, and a bare "3 min remaining" is a
    // claim about the future that nothing in this app can support.
    assert.match(minutesRemainingLine(3), /^About /, 'an estimate is stated as a fact');
  });
});

/**
 * The scripted lesson opens on a dead server, and that is deliberate.
 *
 * `tutorGate` refuses a conversation when the token server is away because
 * there is no conversation without one. The lesson has a second half: the
 * navigator mounts the mock session, which runs the whole ladder locally, so
 * refusing it would take away the exact thing the offline card promises.
 *
 * The door itself moved to the chooser with F573 and is asserted there. What
 * stays here is where it opens and what the route carries, because that is
 * `gate.ts`'s answer and two files deciding it would be two answers.
 */
describe('the scripted lesson opens whichever way the learner can take it', () => {
  test('a learner with no servers still reaches the lesson, and a learner who cannot speak still reaches it typed', () => {
    assert.deepEqual(lessonStart(false), { screen: 'Lesson', params: undefined }, 'the spoken lesson asks for text mode');
    assert.deepEqual(lessonStart(true), { screen: 'Lesson', params: { textMode: true } }, 'the quiet lesson opens spoken');

    // This is the whole reason the lesson is not held back the way the
    // conversation is. With no token server the navigator mounts the mock
    // session, which runs the entire ladder locally, so holding the learner
    // back would refuse them the one thing the offline card already promises:
    // "Practice still works." If either half of that goes, this fails and the
    // decision gets taken again rather than inherited.
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(
      navigator,
      /<LocalPracticeCard/,
      'the offline lesson is gone, so opening the lesson on a dead server is a dead end now',
    );
    assert.match(TUTOR_OFFLINE.body, /bundled line offline/, 'the offline card points to practice that still works');
    assert.match(navigator, /textMode=\{textMode\}/, 'the Lesson route stopped honouring textMode, so the quiet door leads nowhere');
  });
});
