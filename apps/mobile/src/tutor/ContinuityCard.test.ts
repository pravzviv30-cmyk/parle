/**
 * The remembers row, as it is drawn — F573.
 *
 * `dashboard.test.ts` holds what the row says and where it goes, which is the
 * part with four arms in it. This holds the one claim left in the `.tsx`: that
 * it draws the shared row and decides nothing, so the branch cannot creep back
 * into a component no test in this workspace can reach (docs/TESTING.md).
 *
 * The card it replaced had a heading, a line, an outline button and, for a
 * learner whose plan does not carry a conversation across sessions, a paragraph
 * as well. It is one tinted row now, on the same peach as the everyday mission
 * under it, because it is the same everyday thread picked back up.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';


const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CARD = stripComments(read('./ContinuityCard.tsx'));

describe('what the tutor remembers is drawn as one row, and decides nothing — F573', () => {
  test('the memory is the shared row, wearing the tutor and the paper the everyday thread wears', () => {
    assert.match(CARD, /<LedgerRow/, 'the memory must draw the shared notebook row');
    assert.doesNotMatch(CARD, /Tint|\btint\b/, 'the memory must not retain a tint');
    assert.match(CARD, /glyph=\{<TutorMark \/>\}/, 'the row lost the tutor mark, so nothing on it says whose memory it is');
    assert.match(CARD, /title=\{headline\}/, 'the row stops naming the tutor whose memory it is');
    assert.match(CARD, /gloss=\{row\.gloss\}/, 'the row says a line of its own instead of the one that was decided');
    assert.match(CARD, /accessibilityLabel=\{row\.label\}/, 'a learner who hears the screen is never told what pressing the row does');
    assert.match(CARD, /disabled=\{disabled\}/, 'the row stays pressable while a connection check runs');

    // The tutor's mark, never the learner's initial. Two marks for one person
    // on one screen would say the tutor is the learner (F337).
    assert.ok(!CARD.includes('<Monogram'), "the row draws the learner's initial where the tutor's mark belongs");

    assert.equal((CARD.match(/<LedgerRow\b/g) ?? []).length, 1, 'memory is exactly one shared row');
  });

  test('the row holds no rule of its own, so the four things it can do stay where a test can reach them', () => {
    assert.match(CARD, /const row = continuityRow\(\{ headline, line, thread, continueAllowed \}\);/, 'the row works out its own line and destination');
    assert.match(CARD, /onPress=\{\(\) => onPress\(row\.route\)\}/, 'the row picks a destination instead of handing on the one that was decided');

    // No branch, no button, no second block of words. Every one of those was in
    // here before, and each was a decision the suite could not ask about.
    assert.ok(!CARD.includes('thread.kind'), 'the row inspects the thread again, which is the branch that moved to dashboard.ts');
    assert.ok(!CARD.includes('continueAllowed &&'), 'the row decides for itself whether the plan opens this door');
    assert.ok(!CARD.includes('<OutlineButton'), 'the row grew a button; a row that opens a screen says so with a chevron');
    assert.ok(!CARD.includes('<GhostButton'), 'the row grew a second control, so one row asks two questions');
    assert.ok(!CARD.includes('PICK_IT_UP'), 'the row spells the promise itself instead of reading it from dashboard.ts');
    assert.ok(!CARD.includes('StyleSheet'), 'the row hand-rolls a layout beside the shared one');
  });
});
