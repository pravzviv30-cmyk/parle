/**
 * What the four screens write when a sitting ends, read from their source.
 *
 * `progress/activity.ts` learned to carry a duration and `missions/progressStore.ts`
 * learned to hold a half finished scene, and both are useless until the screens that
 * end a sitting actually fill them. There is no renderer in this workspace
 * (docs/TESTING.md), so the only way to hold four screens to that is to read them, the
 * way `surfaceContract.test.ts` and the tab suites do.
 *
 * A grep is a blunt instrument and it is used here for one narrow class of thing: a
 * screen that records a sitting and forgets to say how long it took. That failure is
 * silent by construction. The minutes simply never appear on Home, no test fails, and
 * the goal card stays absent exactly as it would for a learner who had not practised.
 * The same is true of the scene record: a conversation that forgets to write one leaves
 * the resume card with no minutes line, which looks identical to a learner who never
 * left a scene half done.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what runs is under test. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const flat = (relative: string): string => stripComments(read(relative)).replace(/\s+/g, ' ');

/** Every screen that ends a sitting, and the kind it records. */
const WRITERS: readonly { readonly file: string; readonly kind: string }[] = [
  { file: '../ConvoScreen.tsx', kind: 'convo' },
  { file: '../ReviewScreen.tsx', kind: 'review' },
  { file: '../DrillScreen.tsx', kind: 'drill' },
  { file: '../nav/RootNavigator.tsx', kind: 'lesson' },
];

describe('a sitting says how long it took, and a scene says where it was left — F395, F402', () => {
  test('every screen that records activity records how long the sitting took — F395', () => {
    for (const { file, kind } of WRITERS) {
      const body = flat(file);
      const at = body.indexOf(`recordActivity( '${kind}'`) >= 0 ? body.indexOf(`recordActivity( '${kind}'`) : body.indexOf(`recordActivity('${kind}'`);
      assert.ok(at >= 0, `${file} no longer records a ${kind} sitting, so this test is stale`);

      // The call that records this kind carries a duration. Sliced rather than
      // searched whole, because a file may record more than one kind and a
      // duration on the wrong one would read as a pass.
      const call = body.slice(at, at + 400);
      assert.match(
        call,
        /durationMs:/,
        `${file} records a ${kind} sitting without saying how long it took, so Home's speaking goal cannot count it`,
      );
    }

    // The list itself is the thing that goes stale: a fifth screen that records
    // activity and is not named here would never be checked.
    const kinds = new Set(WRITERS.map((w) => w.kind));
    for (const kind of ['convo', 'review', 'drill', 'lesson']) {
      assert.ok(kinds.has(kind), `${kind} sittings are recorded somewhere this test does not read`);
    }
  });

  test('the conversation screen writes the partial scene on leave from the beat on the wire, and never for a free talk, a win or a stop — F402', () => {
    const body = flat('../ConvoScreen.tsx');

    assert.match(
      body,
      /import \{ recordScenarioProgress \} from '\.\/missions\/progressStore\.ts';/,
      'the conversation screen no longer reaches the store that remembers where a scene was left',
    );

    const at = body.indexOf('const leaveNow');
    assert.ok(at >= 0, 'the conversation screen has no leaveNow, so this test is stale');
    const leave = body.slice(at, at + 900);

    assert.match(leave, /recordScenarioProgress\(/, 'leaving a scene part way through writes nothing down');

    // The four refusals, each one a thing that must not leave a record behind.
    assert.match(
      leave,
      /missionId !== undefined/,
      'a free conversation would write a scene record, and there is no scene to come back to',
    );
    assert.match(
      leave,
      /!live\.convo\.missionDone/,
      'a finished mission would write a record the completion is about to clear',
    );
    assert.match(leave, /!stopped/, 'a session the tutor stopped would leave a record behind, which it must not');
    assert.match(
      leave,
      /openedAt !== null/,
      'a room that never opened would report an elapsed time measured from nothing',
    );

    // The beat comes off the wire, and the count done is one behind the position.
    assert.match(
      leave,
      /live\.convo\.beat\.position - 1/,
      'the beats done are not read from the beat on the wire, so the screen is counting them itself',
    );
    assert.doesNotMatch(
      leave,
      /beatsTotal/,
      'the screen writes a total into the record; the total belongs to the catalogue, not the store',
    );
  });
});
