import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TUTOR_INTRO_LINK, TUTOR_OFFLINE, tutorDoors, tutorGate } from './gate.ts';

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

  test('the tutor tab opens its doors without the intro standing in the way', () => {
    // Four explainer pages used to sit between a new account and the first
    // French sentence, which is the one place in this product nothing is
    // allowed to sit. The doors do not know the intro exists.
    const doors = tutorDoors(null);
    assert.deepEqual(doors.map((d) => d.key), ['missions', 'free'], 'the doors changed shape');
    assert.equal(doors.filter((d) => d.primary).length, 1, 'one primary action per screen');

    const withRecent = tutorDoors({ title: 'Au café du coin' });
    assert.deepEqual(withRecent.map((d) => d.key), ['resume', 'missions', 'free']);
    assert.equal(withRecent[0]?.gloss, 'Au café du coin', 'continuing does not say which mission');
    assert.equal(withRecent.filter((d) => d.primary).length, 1, 'two solid actions is no primary action');

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
    assert.equal(TUTOR_INTRO_LINK, 'How the circle works');
    for (const [name, source] of [['the tutor tab', tab], ['profile', profileTab]] as const) {
      assert.ok(source.includes('TUTOR_INTRO_LINK'), `${name} lost its way back to the intro`);
      assert.ok(source.includes('<TutorIntro'), `${name} links to an intro it never renders`);
    }
    assert.ok(intro.includes('OrbWalkthrough'), 'the intro lost the page that teaches the circle');
    assert.ok(intro.includes('Amber, it is thinking'), 'the intro stopped naming the thinking colour');
    assert.ok(intro.includes('Green, your turn'), 'the intro stopped saying green means you speak');
  });
});
