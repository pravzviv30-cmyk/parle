/**
 * A tripwire, not a proof.
 *
 * apps/mobile has no renderer and no component test (docs/TESTING.md), which is
 * exactly why two buttons on the end card could carry different labels and the
 * same behaviour for as long as they did: "Go again" and "Review" both called
 * goBack(), which matched neither of them, and nothing anywhere could notice.
 *
 * The behaviour itself is verified in a browser. What this holds is the shape:
 * if either handler retreats to goBack() again, or the Start pill on the end
 * card goes back to an empty arrow function, this fails and says so. That is a
 * weaker guarantee than a test that drives the UI, and it is the strongest one
 * available here, so it is written down as such rather than dressed up.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** The props block passed to SummaryScreen inside the lesson route. */
function summaryScreenProps(source: string): string {
  const open = source.indexOf('<SummaryScreen');
  assert.ok(open >= 0, 'the lesson route still renders the end card');
  const close = source.indexOf('/>', open);
  assert.ok(close > open, 'the end card element is still self-closing');
  return source.slice(open, close);
}

describe('the end card is wired to what its labels say', () => {
  test("the end card's buttons do what their labels say", () => {
    const props = summaryScreenProps(read('./RootNavigator.tsx'));

    const again = props.match(/onAgain=\{([^}]*)\}/)?.[1] ?? '';
    const review = props.match(/onReview=\{([^}]*)\}/)?.[1] ?? '';

    assert.ok(again !== '', 'the card still gets an onAgain');
    assert.ok(review !== '', 'and an onReview');

    assert.ok(
      !/goBack\s*\(\s*\)/.test(again),
      '"Go again" must start another sitting, not retreat to whichever tab launched this one',
    );
    assert.ok(
      !/goBack\s*\(\s*\)/.test(review),
      '"Review" must open the review deck, which is already a route in this same stack',
    );
    assert.match(review, /Review/, 'and it opens it by name');

    assert.notEqual(again.trim(), review.trim(), 'two labels that mean different things cannot share one handler');
  });

  test("the end card's one solid action is not an empty handler", () => {
    const summary = read('../SummaryScreen.tsx');
    const start = summary.indexOf('label="Start"');
    assert.ok(start >= 0, 'the drill card still offers to start');
    const nearby = summary.slice(start, start + 400);
    assert.ok(
      !/onPress=\{\(\)\s*=>\s*\{\s*\}\}/.test(nearby),
      'the pill under the focus drill fronts the whole product promise; an empty handler breaks it silently',
    );
    assert.match(nearby, /onPress=\{/, 'it still has a handler at all');
  });

  test('the focus drill never claims to have heard anything', () => {
    // PEDAGOGY.md: a pronunciation score is never invented, and no path may
    // require speaking aloud. There is no scorer behind this screen, so any
    // recording or grading in it would be one or the other.
    const player = read('../drill/FocusDrillPlayer.tsx');
    for (const forbidden of ['Recording', 'startRecording', 'getUserMedia', 'scoreUtterance', 'correct', 'Wrong']) {
      assert.ok(!player.includes(forbidden), `the focus drill player must not reference ${forbidden}`);
    }
  });
});
