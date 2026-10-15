/**
 * The lesson surface, and the one thing it never said.
 *
 * The agent decides a learner is stuck by counting silence, and a learner who
 * is typing is silent by definition. The conversation solved that a while ago:
 * every keystroke calls `sendTyping`, the hook throttles it to one ping per
 * window, and the draft itself never goes on the wire. The lesson's own box was
 * written before that existed and its `onChangeText` set the draft and stopped
 * there, so a typed lesson was rescued for thinking, every turn, and each
 * rescue lowers where the ladder opens tomorrow.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the wiring is read
 * out of the two files, the way `ConvoScreen.test.ts` and `keyboardTaps.test.ts`
 * read theirs. The throttle itself is a pure function and is simply run.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TYPING_PING_MS, shouldPingTyping } from './tutor/typingPing.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const view = stripComments(read('./SessionView.tsx'));
const screen = stripComments(read('./LiveSessionScreen.tsx'));
const convo = stripComments(read('./ConvoScreen.tsx'));
const liveRoom = stripComments(read('./live/C2LiveRoom.tsx'));

/**
 * Somebody typing a French sentence at a steady pace: one character every
 * 150ms for thirty seconds. Slow, because they are composing in a language
 * they are learning, which is the whole reason the agent must not read the
 * silence as being stuck.
 */
function typingFor(ms: number, gap = 150): number[] {
  const strokes: number[] = [];
  for (let t = 0; t < ms; t += gap) strokes.push(t);
  return strokes;
}

describe('the lesson says the learner is still here — F142', () => {
  test('typing in the lesson pings presence at the throttle', () => {
    // The box tells the screen, and it tells it on every letter rather than on
    // send: the point is to be heard while the sentence is still being written.
    assert.match(view, /onChangeText=\{changeDraft\}/, 'the lesson box still keeps its keystrokes to itself');
    assert.match(
      view,
      /const changeDraft = \(text: string\) => \{[\s\S]{0,160}props\.onTyping\?\.\(\);/,
      'the lesson box changed hands but nothing on the way through says the learner is here',
    );
    assert.match(view, /onTyping\?: \(\) => void;/, 'onTyping is not part of the surface contract');

    // And the screen hands it the hook's throttled ping, which is the same
    // seam the conversation has used since it grew a box. Reaching for a raw
    // typing frame here would be a second throttle to keep in step.
    assert.match(
      screen,
      /onDraft=\{text => \{ setDraft\(text\); live\.sendTyping\(\); \}\}/,
      'the typed lesson does not send presence, so the agent still counts it as silence',
    );
    // `typing` rather than the prop, because a lesson can go quiet mid-session
    // now: the learner takes the typed door, the room stays, and the prop this
    // screen was opened with is still false. Reading the prop alone would leave
    // that learner typing into a session that counts them as silent, which is
    // this test's own defect arriving through the other door.
    assert.match(
      screen,
      /const typing = textMode \|\| live\.voiceless \|\| typingOpen;/,
      'the lesson decides it is typed from the prop alone, so the quiet door leaves it counting silence',
    );
    assert.ok(!screen.includes("{ t: 'typing' }"), 'the lesson publishes a typing frame itself instead of through the hook');
    assert.match(convo, /live\.sendTyping\(\);/, 'this test is reading for the seam the conversation uses and cannot find it');
    assert.match(liveRoom, /onChangeText=\{onDraft\}/, 'the actual live composer must call the supplied presence callback');
    const body = screen.match(/onDraft=\{text => \{([^}]+)\}\}/)?.[1];
    assert.ok(body, 'the production lesson keystroke callback is missing');
    const drafts: string[] = [];
    let calls = 0;
    const onDraft = new Function('text', 'setDraft', 'live', body!);
    for (const text of ['B', 'Bo', 'Bon', 'Bonjour']) onDraft(text, (value: string) => drafts.push(value), { sendTyping: () => { calls++; } });
    assert.deepEqual(drafts, ['B', 'Bo', 'Bon', 'Bonjour']);
    assert.equal(calls, 4, 'presence is sent for every keystroke, including before submission');

    // At the throttle: a learner typing steadily is heard often enough that the
    // agent never sees a gap, and rarely enough that a fast typist is not
    // publishing on every letter.
    let last: number | null = null;
    let pings = 0;
    let longestGap = 0;
    for (const now of typingFor(30_000)) {
      if (!shouldPingTyping(last, now)) continue;
      longestGap = Math.max(longestGap, last === null ? 0 : now - last);
      last = now;
      pings += 1;
    }
    assert.equal(pings, 8, `thirty seconds of steady typing sent ${pings} pings, which is not one per window`);
    assert.ok(
      longestGap <= TYPING_PING_MS + 150,
      `the app went quiet for ${longestGap}ms while the learner was visibly typing`,
    );
  });

  test('the draft itself never leaves the device', () => {
    // Presence, not content. Half a sentence in a language somebody is still
    // learning is not something to put on a wire, and `{ t: 'typing' }` carries
    // no payload at all.
    assert.match(
      view,
      /props\.onTyping\?\.\(\);/,
      'onTyping is being called with something, and the only thing to hand it is the draft',
    );
    assert.ok(
      !/onTyping\?\.\(draft/.test(view) && !/onTyping\?\.\(text/.test(view),
      'the lesson sends what the learner is typing, and only that it is typing was ever agreed',
    );
  });
});
