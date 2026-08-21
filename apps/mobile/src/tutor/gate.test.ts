import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { TUTOR_OFFLINE, tutorGate } from './gate.ts';

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
