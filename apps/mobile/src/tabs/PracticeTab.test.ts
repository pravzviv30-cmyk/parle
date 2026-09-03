/**
 * What the Practice tab is allowed to decide about its own next step — F346.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. The rule it guards is the one F345 pulled into `practice/nextStep.ts`:
 * the tab draws the step, it does not work out what the step is. So the positive
 * half here is small — an import, a call in the effect, one headline — and every
 * assertion with weight in it is about what the screen must not have kept: a
 * `dueCards` import that would let it count due itself, a second primary pill
 * next to the heavy-ruled row, or the review copy that now lives in the module.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./PracticeTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/**
 * The text between two markers, with both proven present.
 *
 * The same guard `MyFrenchTab.test.ts`'s `between` writes: `indexOf` answers -1
 * for something that is not there, and a slice from -1 is a slice of the wrong
 * part of the file.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

describe('Practice opens on its next step — F346', () => {
  test('practice draws its next step from nextStep and decides nothing about it on the screen', () => {
    // The step comes from the module, whole. The screen imports the copy, the
    // type and the decision from one place and re-derives none of it.
    const imported = FLAT.match(/import \{([^}]*)\} from '\.\.\/practice\/nextStep\.ts'/);
    assert.ok(imported, 'Practice never imports practice/nextStep.ts, so it has no step to draw');
    for (const name of ['NEXT_STEP', 'nextStep', 'reviewLine']) {
      assert.ok(imported[1]!.includes(name), `Practice imports the step module without ${name}`);
    }

    // Wired into the focus effect and put in state, never computed at render.
    assert.match(FLAT, /setStep\(\s*nextStep\(/, 'the step is not built by nextStep and held in state');

    // The tab must not count due itself: dueCards is the module's to call now.
    assert.ok(!SCREEN.includes('dueCards'), 'Practice still reaches for dueCards; counting due is nextStep.ts\'s job');

    // Exactly one headline over exactly one step.
    const headlines = SCREEN.match(/<Label>\{NEXT_STEP\.label\}<\/Label>/g) ?? [];
    assert.equal(headlines.length, 1, `Practice draws ${headlines.length} next-step headlines; it should draw one`);
  });

  test('the practice headline is a door to the same handler as the ruled row, never a second primary', () => {
    // The headline block sits between its own label and the mix offer below it.
    const headline = between(RENDER, 'NEXT_STEP.label', 'mixOffered', 'the next-step headline is drawn under the header');

    // A node step opens through the frozen F154 `open`, the very handler the
    // path's heavy-ruled `isNext` row calls; a review step opens the deck. Both
    // doors are in the one headline, so it is never a rule of its own.
    assert.match(headline, /open\(\s*step\.node\s*\)/, 'the node step does not reuse the path row\'s open handler');
    assert.match(headline, /nav\.navigate\('Review'\)/, 'the review step does not open the Review deck');
    assert.match(headline, /<OutlineButton\b/, 'the headline is not drawn as an OutlineButton');
    assert.doesNotMatch(headline, /<PillButton\b/, 'the headline is a second solid pill, not a door to the ruled row');

    // Not a second primary anywhere on the tab: the ruled row stays the one.
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 0, 'Practice grew a primary pill (F342 keeps it at zero)');

    // The review word and its line moved into the module. Neither is typed here.
    assert.ok(!SCREEN.includes('label="Review"'), 'Practice still spells the review label itself; it is NEXT_STEP.review now');
    assert.ok(!SCREEN.includes('cards are ready'), 'Practice still spells the review line itself; it is reviewLine now');
  });

  test('the mix offer sits under the next step, not above it', () => {
    const head = RENDER.indexOf('NEXT_STEP.label');
    const mix = RENDER.indexOf('mixOffered');
    const path = RENDER.indexOf('units');
    assert.notEqual(head, -1, 'the next-step headline is not drawn');
    assert.notEqual(mix, -1, 'the mix offer is not drawn');
    assert.notEqual(path, -1, 'the path is not drawn');
    assert.ok(head < mix, 'the mix offer sits above the next step instead of under it');
    assert.ok(mix < path, 'the mix offer sits below the path instead of above it');
  });
});
