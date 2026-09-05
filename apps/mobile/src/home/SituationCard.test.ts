/**
 * What the situation card badges, and what it answers — F421.
 *
 * The founder circled two things on the shipped Home. One was the greeting.
 * The other was `DEMO MODE`, sitting in the eyebrow of today's situation, on
 * the first screen of the app, reporting a server state to a learner who had
 * not asked about a server and could do nothing at all with the answer.
 *
 * Deleting a label is a one-line change and the reason it needs a test is the
 * half that must NOT change with it. The card's honest offline signal is not
 * the badge, it is the answer to the tap: the learner presses Start oral
 * session, the probe runs where they can see it, and either the conversation
 * opens or the module's own sentence explains why it could not, with the same
 * start offered again. F392 pinned that path and it is pinned here again from
 * the card's own side, because "get rid of the demo label" and "get rid of the
 * offline handling" are one careless edit apart.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the card is read as
 * source. That ceiling is honest: this proves the label is not in the file and
 * the held-back branch still is, never that a learner saw either one.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TUTOR_OFFLINE } from '../tutor/gate.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The slice between two markers, each proven present so the slice is real. */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

const CARD = stripComments(read('./SituationCard.tsx'));
/** One line, so a regex about an expression reads code and not the wrapping. */
const FLAT = CARD.replace(/\s+/g, ' ');

describe('the situation card says what it is, and answers what it was asked — F421', () => {
  test('the situation card carries no demo label; a start that cannot happen is answered on the tap — F421', () => {
    // 1. The badge is gone, both as the module's word and as a spelled copy of
    //    it, because the second is how a removed label comes back.
    assert.ok(
      !CARD.includes('TUTOR_OFFLINE.label'),
      'the card still badges itself with the offline label the founder took off this page',
    );
    assert.ok(!/demo/i.test(CARD), 'the card spells a demo label of its own, which is the badge back under another name');

    // 2. And it no longer asks whether the tutor is live at all. A card that
    //    still read the flag would be one JSX line from wearing it again.
    assert.doesNotMatch(CARD, /\blive\b/, 'the card still reads the live flag, so it still knows a state it has no use for');
    assert.match(
      FLAT,
      /const \{ recheck \} = useLive\(\);/,
      'the card takes something other than the recheck out of the live context',
    );

    // 3. The eyebrow draws exactly one thing: what this card is.
    const eyebrow = between(CARD, '<View style={st.eyebrow}>', '<Text style={st.title}>', 'the card has an eyebrow above its title');
    assert.deepEqual(
      eyebrow.match(/<Label\b/g),
      ['<Label'],
      'the eyebrow draws a second label beside the name of the card, which is where the demo badge lived',
    );
    assert.match(eyebrow, /<Label>\{"Today's situation"\}<\/Label>/, 'the eyebrow no longer names what the card is');

    // 4. The removal did not take the app's word with it. `TUTOR_OFFLINE.label`
    //    is still the module's to give, because the Tutor tab and the Convo
    //    guard still draw it where a learner has asked about a session.
    assert.ok(TUTOR_OFFLINE.label.length > 0, 'the offline label is empty, so the surfaces that do draw it have nothing to say');

    // 5. The tap still runs the whole gate, in the same order, with the same
    //    words on the way back. This is the honest signal now.
    assert.match(
      FLAT,
      /import \{ TUTOR_OFFLINE, tutorGate \} from '\.\.\/tutor\/gate\.ts'/,
      'the card decides for itself whether a start starts anything',
    );
    assert.match(FLAT, /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');
    assert.match(FLAT, /setChecking\(true\);/, 'nothing marks the probe as running, so nothing can say so on screen');
    assert.match(FLAT, /recheck\(\)\.then\(\(answered\) => \{/, 'the card never re-probes the connection before opening a room');
    assert.match(FLAT, /tutorGate\(answered, false\)/, 'the card does not ask the gate, or asks it in text mode');
    assert.match(FLAT, /setHeldBack\(decision\.heldBack\)/, 'a start the gate refused is dropped rather than kept for the retry');

    // 6. The learner can see the probe running, and hears about it once.
    assert.match(
      FLAT,
      /\{checking && \( <Text accessibilityLiveRegion="polite" style=\{st\.checking\}> \{TUTOR_OFFLINE\.checking\}/,
      'nothing on the card says a probe is running, so a tap that takes a moment looks like a tap that did nothing',
    );

    // 7. And a start that could not happen is answered where it was asked, with
    //    the module's sentence and the same start offered again. Never a
    //    smaller one, and never a learner left in front of a dead control.
    const heldBack = between(CARD, 'heldBack !== null &&', '</View>', 'the card answers a start it could not honour');
    assert.match(heldBack, /\{TUTOR_OFFLINE\.body\}/, 'a held-back start says nothing about why');
    assert.match(
      heldBack.replace(/\s+/g, ' '),
      /label=\{checking \? TUTOR_OFFLINE\.checking : TUTOR_OFFLINE\.retry\}/,
      'there is no way to check again',
    );
    assert.match(heldBack, /onPress=\{open\}/, 'the way to check again is not the same start the learner asked for');
    assert.match(heldBack, /<OutlineButton/, 'the way to check again is drawn as a second primary');
  });
});
