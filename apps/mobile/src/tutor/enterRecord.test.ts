/**
 * The record of the enter fix, held to what was actually established.
 *
 * The first report of this bug said Enter was dead on react-native-web and that
 * it had been reproduced live. It had not: the browser automation was sending
 * Return as an empty key event (`key: ""`, `keyCode: 0`), so nothing was under
 * test, and a later keydown probe showed a real `Enter` producing a real event.
 * The fix is still right, because it never rested on that report. It rests on
 * react-native-web 0.21.2's own source.
 *
 * That distinction is worth a test because the record is what the next session
 * trusts. A disproven diagnosis left standing as fact costs somebody a day.
 *
 * So this walks the two places the fix is written down, the way labels.test.ts
 * and copy.test.ts walk the source, and asks for positive evidence: the grounds
 * are named, and the retracted phrasing, if it appears at all, appears in order
 * to be withdrawn rather than as a claim. Written positively on purpose. A
 * future edit cannot satisfy it by deleting the explanation, which would be the
 * other way to end up with a record that says nothing true.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

const RULE_TEST = join(HERE, 'enterSubmit.test.ts');
const LEDGER = join(REPO, 'docs', 'KNOWN_ISSUES.md');

/**
 * The ledger entry is found by the test it says verifies it, not by its number.
 * Entries get renumbered; a verified-by line naming a real test does not drift
 * without somebody noticing, because the gate already refuses a tick whose
 * named test did not pass.
 */
const ANCHOR = 'pressing enter in a typed input is a send, not a no-op';

/**
 * What react-native-web 0.21.2's source shows, which is the whole ground the
 * fix stands on: `submitBehavior` dropped by the strict prop whitelist before
 * the DOM sees it, and the choosing ScrollView being the one input screen in
 * the app without `keyboardShouldPersistTaps`.
 */
const GROUNDS = ['react-native-web', 'submitBehavior', 'keyboardShouldPersistTaps'];

/** The claim nobody demonstrated, in the shapes it has been written in. */
const RETRACTED = /reproduced live|a live reproduction|enter (?:is|was) dead/gi;

/** A retraction has to name what it withdraws, so the phrase alone is not the offence. */
const WITHDRAWAL = /retract|artifact|withdraw|never reproduc|not reproduc|disproven/i;

/** The one ledger entry that records the enter fix, heading and all. */
function entryFor(ledger: string): string {
  const sections = ledger.split(/^### /m).slice(1);
  const found = sections.filter((section) => section.includes(`verified-by: \`${ANCHOR}\``));
  assert.equal(
    found.length,
    1,
    `Expected exactly one ledger entry verified by "${ANCHOR}", found ${found.length}. ` +
      'The record of the enter fix cannot be checked if it cannot be found.',
  );
  return `### ${found[0] ?? ''}`;
}

describe('the enter fix — what its record is allowed to claim', () => {
  test("the record of the enter fix claims the platform's source, not a reproduction nobody made", () => {
    const ledger = readFileSync(LEDGER, 'utf8');
    const ruleTest = readFileSync(RULE_TEST, 'utf8');

    assert.ok(
      ruleTest.includes(ANCHOR),
      `enterSubmit.test.ts no longer holds the test the ledger names: "${ANCHOR}"`,
    );

    const places: [string, string][] = [
      ['the ledger entry in docs/KNOWN_ISSUES.md', entryFor(ledger)],
      ['apps/mobile/src/tutor/enterSubmit.test.ts', ruleTest],
    ];

    for (const [where, source] of places) {
      for (const ground of GROUNDS) {
        assert.ok(
          source.includes(ground),
          `${where} no longer names ${ground}. The grounds for this fix are what react-native-web's ` +
            'source shows, and a record with the explanation deleted is no better than a wrong one.',
        );
      }

      assert.ok(
        WITHDRAWAL.test(source),
        `${where} does not say anywhere that the live reproduction was withdrawn. It was a harness ` +
          'artifact, and the retraction is the part a future session needs.',
      );

      for (const hit of source.matchAll(RETRACTED)) {
        const at = hit.index ?? 0;
        const around = source.slice(Math.max(0, at - 300), at + 300);
        assert.ok(
          WITHDRAWAL.test(around),
          `${where} states "${hit[0]}" as fact. Nobody ever reproduced a dead Enter key: the ` +
            'automation sent Return as an empty key event. Say it only to retract it.',
        );
      }
    }
  });
});
