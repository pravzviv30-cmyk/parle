/**
 * The line that explains a silence.
 *
 * livekit-client puts a dropped connection back together on its own, and the
 * hook has tracked that for a while. Nothing rendered it. So the room went
 * quiet, the tutor stopped answering, and the screen carried on looking live:
 * from the learner's side that is identical to a tutor who has decided not to
 * reply, and the honest reading of it is that they said something wrong.
 *
 * The trap this closes is the obvious fix. The screens already have a slot for
 * a passing hiccup, and putting the reconnect through it would have been two
 * lines. That slot clears itself after eight seconds, and a blip on a train
 * outlives eight seconds easily, so the one sentence explaining a dead room
 * would have vanished while the room stayed dead.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { RECONNECTING, connectionLine } from './connectionLine.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const HICCUP = 'The tutor lost its voice for a moment. It should be back shortly.';

describe('the quiet slot — what a live screen says about its own connection', () => {
  test('a connection being rebuilt is said out loud and never put on the notice timer', () => {
    // The ordinary case, which is almost every render: the slot is empty and
    // the screen is quiet.
    assert.deepEqual(connectionLine({ reconnecting: false, notice: null }), { text: null, kind: 'none' });
    assert.deepEqual(
      connectionLine({ reconnecting: false, notice: '' }),
      { text: null, kind: 'none' },
      'an empty notice draws an empty line, which is a gap that appears for no reason',
    );

    // A vendor hiccup still reaches the screen exactly as it did.
    assert.deepEqual(connectionLine({ reconnecting: false, notice: HICCUP }), { text: HICCUP, kind: 'notice' });

    // And the reconnect, which is the whole point.
    assert.deepEqual(connectionLine({ reconnecting: true, notice: null }), { text: RECONNECTING, kind: 'reconnecting' });

    // Precedence, and the reasoning is the timer rather than importance. A
    // notice hidden under a reconnect has not been lost, it expires on its own
    // either way. A reconnect hidden under a notice would be the only
    // explanation for a dead room, taken off the screen by something smaller.
    assert.deepEqual(
      connectionLine({ reconnecting: true, notice: HICCUP }),
      { text: RECONNECTING, kind: 'reconnecting' },
      'a passing hiccup covers up the one line explaining why nothing is answering',
    );

    // The copy. Mid-session, so no number and nothing that reads as the
    // learner's doing, and it says which side went away.
    assert.ok(!/[—–]/.test(RECONNECTING), 'the line carries an em dash');
    assert.ok(!/\d/.test(RECONNECTING), 'a mid-session line counts');
    assert.ok(
      !/\b(wrong|failed|error|sorry|problem|unfortunately)\b/i.test(RECONNECTING),
      'the line apologises or reads as a fault',
    );
    assert.match(RECONNECTING, /connection/i, 'the line never says what actually went away');
    assert.ok(RECONNECTING.length <= 90, 'a line read at a glance mid-sentence has grown into a paragraph');

    // The wiring. Both live surfaces ask the same question, and neither hands
    // the reconnect to the slot that clears itself.
    // Counted rather than merely found, because the conversation has two
    // places it can fall silent: the choosing moment and the scene. One of them
    // wired and the other still reading `live.notice` is a learner who can see
    // why the room went quiet before they answer and cannot see it after.
    for (const [name, source, slots] of [
      ['the conversation', stripComments(read('../ConvoScreen.tsx')), 2],
      ['the lesson', stripComments(read('../LiveSessionScreen.tsx')), 1],
    ] as const) {
      assert.equal(
        (source.match(/connectionLine\(\{ reconnecting: live\.reconnecting, notice: live\.notice \}\)/g) ?? []).length,
        slots,
        `${name} has a quiet slot that never says the connection went away`,
      );
      // And nothing else on the screen touches the notice. The hiccup reaches
      // the learner through the same one line or not at all.
      for (const use of source.match(/(?:notice:\s*)?live\.notice/g) ?? []) {
        assert.equal(use, 'notice: live.notice', `${name} reads the raw notice outside the quiet slot: ${use}`);
      }
      assert.match(
        source,
        /accessibilityLiveRegion="polite"/,
        `${name} explains a silence in a line nothing reads out`,
      );
    }

    // And the timer stays where it belongs: on the notice, in the hook, and
    // nowhere near this line.
    const hook = read('./useLiveSession.ts');
    assert.match(hook, /noticeTimer\.current = setTimeout\(\(\) => setNotice\(null\), 8000\)/, 'the notice lost its timer');
    assert.ok(!hook.includes(RECONNECTING), 'the reconnect line is published as a notice, so it expires while the room is still down');
    assert.match(hook, /setReconnecting\(true\)/, 'nothing in the hook ever says the connection is being rebuilt');
    assert.match(hook, /setReconnecting\(false\)/, 'the reconnect line has no way to come off the screen');
  });
});
