/**
 * The roadmap is not allowed to know where `main` is.
 *
 * ## Why this is its own file
 *
 * `deliveryRoadmap.test.ts` next door already polices this document, and it polices it
 * well: it reads the status table cell by cell, and it checks a *landing* claim against
 * git — a cell that says something merged has to name a hash that exists, and a branch it
 * calls unlanded must not already be an ancestor of `main`.
 *
 * That rule reads table cells only, and that was a decision rather than an oversight.
 * Whole-document scanning for landing claims was measured while F243 was being built and
 * rejected: in running prose, "refused rather than merged" and "the merged manifests" both
 * match a landing-claim pattern and neither is a landing claim. A rule that cries wolf in
 * the narrative is a rule people learn to read past.
 *
 * So F256 slipped through the gap. Line 37 of the roadmap said, in the present tense,
 * "`main` points at `2eac2f2`" — true on the day it was written, four landings stale by the
 * time anyone read it again, and invisible to a rule that only looks at the table. That was
 * the fourth sentence in one document to outlive its truth in a single day, after F211,
 * F212 and F243.
 *
 * ## What this holds, and why it is narrow on purpose
 *
 * Not "find every landing claim in the prose". One shape only: **the document may not say
 * where `main` points today.** A claim of that kind needs three things adjacent — the word
 * `main`, a present-tense locating verb, and a commit-shaped token — and that conjunction
 * has no innocent reading. It is narrow enough that the false positives which sank the wider
 * rule cannot reach it, which the refutation set below demonstrates rather than asserts.
 *
 * The repair for a sentence this catches is never to delete the fact. It is to re-anchor it:
 * name the commit as the landing it was, which is permanently true, instead of as the tip,
 * which is true for about a day. So the second half of the first test refuses the cheap fix
 * and requires `2eac2f2` to still be in the document somewhere.
 *
 * ## What this cannot do
 *
 * It reads one markdown file and compares it against nothing. It has no idea where `main`
 * actually points, and it does not want to: a rule that had to know would be a rule that
 * goes quiet in a shallow clone, which is the failure F255 was about. A sentence that is
 * wrong in some way other than this shape — a wrong hash for a real landing, a phase called
 * built that is not — is the neighbouring rule's job and not this one's.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ROADMAP_PATH = path.join(ROOT, 'docs', 'DELIVERY_ROADMAP.md');

/**
 * `main`, a present-tense verb of location, an explicit preposition of place, and a commit.
 * All four, adjacent, in that order.
 *
 * The order carries most of the meaning. "`main` points at `2eac2f2`" is a claim about now.
 * "`2eac2f2` is where Phase 4 left `main`" is the same two facts in the other order and is
 * a claim about a landing, which stays true forever. Nothing here should reject the second
 * to catch the first, so the pattern is anchored on `main` and reads forward. `was`, `had`
 * and `left` are absent for the same reason: the past tense is the fix, not the bug.
 *
 * The preposition is the part that was learnt the hard way. A first draft allowed a bare
 * `is`, and it immediately flagged a real and permanently true sentence in this document:
 * "its merge base with `main` is `2a86092`". There `main` is the object of "with" and the
 * subject is the merge base, so the sentence says nothing at all about the tip. Requiring an
 * explicit `at`, `on` or `to` after the verb separates the two without any list of words
 * that may precede `main`, which would have been a guess that leaks.
 *
 * The price is a named blind spot: "`main` is `<hash>`", with no preposition, is not caught.
 * It has never been written in this repository and it is not idiomatic, and a blind spot
 * that can be stated in one line is a better trade than a false positive in the narrative —
 * a rule that cries wolf in prose is a rule people learn to read past, which is exactly why
 * F243's rule was confined to table cells in the first place. The boundary is fixtured
 * below so that widening it is a deliberate act.
 */
const TIP_CLAIM =
  /`?\bmain\b`?\s+(?:now\s+|currently\s+|still\s+|today\s+)?(?:points?|sits?|stands?|rests?|remains?|is)\s+(?:now\s+|currently\s+|still\s+|today\s+)?(?:at|on|to)\s+`?([0-9a-f]{7,40})`?/gi;

/**
 * The document as paragraphs, each flattened to one line, each remembering where it began.
 *
 * Flattening is the point. The sentence F256 is about wrapped across two source lines —
 * "`main` points at" ended line 37 and "`2eac2f2`." began line 38 — so a scanner that reads
 * line by line would have missed it, and re-wrapping the paragraph would silently switch
 * this rule off. Paragraphs are split on blank lines, so nothing is ever joined across the
 * gap between two thoughts.
 */
function paragraphs(document: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let line = 1;
  let start = 1;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0) out.push({ line: start, text: buffer.join(' ').replace(/\s+/g, ' ').trim() });
    buffer = [];
  };
  for (const raw of document.split('\n')) {
    if (raw.trim() === '') flush();
    else {
      if (buffer.length === 0) start = line;
      buffer.push(raw);
    }
    line += 1;
  }
  flush();
  return out;
}

/** Every present-tense claim about the tip in a document, with enough context to find it. */
export function tipClaims(document: string): { line: number; quote: string }[] {
  const found: { line: number; quote: string }[] = [];
  for (const paragraph of paragraphs(document)) {
    for (const match of paragraph.text.matchAll(TIP_CLAIM)) {
      const at = match.index ?? 0;
      found.push({
        line: paragraph.line,
        quote: paragraph.text.slice(Math.max(0, at - 60), at + match[0].length + 20).trim(),
      });
    }
  }
  return found;
}

const roadmap = readFileSync(ROADMAP_PATH, 'utf8');

describe('the roadmap and the tip of main', () => {
  test('the roadmap never claims to know where main points today', () => {
    const claims = tipClaims(roadmap);
    assert.deepEqual(
      claims.map((c) => `docs/DELIVERY_ROADMAP.md:${c.line}  ...${c.quote}...`),
      [],
      'the roadmap states where `main` points. It was true when it was written and it is ' +
        'stale by the next landing, which has now happened four times in this one document ' +
        '(F211, F212, F243, F256). Do not update the hash — that only resets the clock. ' +
        'Re-anchor the sentence on the landing it is really about, which never changes: ' +
        '"`<hash>` is where Phase N left `main`" rather than "`main` points at `<hash>`".',
    );

    // And the cheap way to pass the assertion above is to delete the sentence, which would
    // throw away a fact worth keeping: `2eac2f2` is the commit the Phase 4 gate closed on.
    // The fix is a change of tense, not a deletion.
    assert.ok(
      roadmap.includes('2eac2f2'),
      'the roadmap no longer names `2eac2f2` at all. That is the commit `main` stood at when ' +
        'Phase 4 closed at 1,865 tests, and it is the hash that finds that work now the ' +
        'branch is deleted. Re-anchoring the sentence should have kept it, not dropped it.',
    );
  });

  test('the tip-claim rule fires on the sentence that made it necessary and not on an honest landing', () => {
    // The sentence as it actually stood in the document on 2026-08-30, wrapped exactly as
    // the file wrapped it. If a future edit to the pattern stops catching this, the pattern
    // has stopped being the thing this file is for.
    const asItWas =
      'Two commits followed on `main`: `d24913f`\n' +
      'corrected `docs/PEDAGOGY.md`, and `2eac2f2` regenerated the code graph. `main` points at\n' +
      '`2eac2f2`. The gate that closed Phase 4 is the one in step 5 below.';
    assert.equal(tipClaims(asItWas).length, 1, 'the rule no longer catches the sentence it was written for');

    const mustCatch = [
      '`main` points at `eee755c`',
      'main points to 2eac2f2',
      '`main` now points at `eee755c`',
      '`main` currently points at `eee755c`',
      '`main` is at `eee755c`',
      '`main` is now at `eee755c`',
      '`main` sits at `eee755c`',
      '`main` still points at `eee755c`',
      '`main` stands at `eee755c`',
      '`main` remains at `eee755c`',
      '`main` is at `deadbeef`',
    ];
    for (const sentence of mustCatch) {
      assert.equal(tipClaims(sentence).length, 1, `not caught, and it is the same claim: ${sentence}`);
    }

    // The other half, and the reason this rule is shaped the way it is. These are the
    // sentences a wider rule got wrong, plus the past-tense forms that are the whole point
    // of the repair. Every one of them is honest prose that must stay writable.
    const mustNotCatch = [
      '`phase-4-practice` was merged into `main` as `f943bbe`',
      'Built on `phase-6-retention` and merged into `main` as `eee755c`',
      '`2eac2f2` is where Phase 4 left `main`',
      '`main` was at `2eac2f2` when Phase 4 closed',
      'Phase 4 left `main` at `2eac2f2`',
      'the branch was refused rather than merged',
      'the merged manifests are read once',
      'Two commits followed on `main`: `d24913f` corrected the docs',
      '`main` points the way for every later phase',
      'the domain is `2eac2f2`-shaped nonsense',
      // The one that taught this rule its shape. Permanently true, about a merge base and
      // not about the tip, and a bare-`is` pattern flagged it on the first run.
      '`phase-4-practice` was branched from that exact merge commit, so its merge base with `main` is `2a86092`',
    ];
    for (const sentence of mustNotCatch) {
      assert.deepEqual(tipClaims(sentence), [], `a false positive, and honest prose has to stay writable: ${sentence}`);
    }

    // The edge of the rule, written down. These *are* claims about the tip and they are not
    // caught, because catching them means allowing a bare `is` and a bare `is` reaches the
    // merge-base sentence above. Nobody has ever written one of these here. If one appears,
    // widen the rule then and delete the line from this list — which is a decision someone
    // makes on purpose, rather than a gap they never knew about.
    const knownBlindSpots = ['`main` is `eee755c`', '`main` is now `eee755c`'];
    for (const sentence of knownBlindSpots) {
      assert.deepEqual(tipClaims(sentence), [], `this blind spot has closed, which is good — update the list: ${sentence}`);
    }
  });
});
