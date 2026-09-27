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

    const at = body.indexOf('const leaveTo');
    assert.ok(at >= 0, 'the conversation screen has no shared leave path, so this test is stale');
    const end = body.indexOf('const leaveNow', at);
    assert.ok(end > at, 'leaveNow no longer delegates to the shared leave path, so this test is stale');
    // Bound the assertion to the whole shared leave function. A fixed character
    // window broke as soon as a comment or a second completion path grew above
    // the write; ending at the delegate keeps every refusal below under test
    // without allowing another function's conditions to satisfy them.
    const leave = body.slice(at, end);

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

describe('a sitting says how much of it was active learning — Phase 1B', () => {
  const CLOCKED: readonly { readonly file: string; readonly kind: string }[] = [
    { file: '../ConvoScreen.tsx', kind: 'convo' },
    { file: '../ReviewScreen.tsx', kind: 'review' },
    { file: '../DrillScreen.tsx', kind: 'drill' },
  ];

  test('every screen that records a sitting holds an active clock and writes its total', () => {
    for (const { file, kind } of CLOCKED) {
      const body = flat(file);
      assert.match(body, new RegExp(`useActiveClock\\('${kind}'\\)`), `${file} holds no active clock for ${kind}`);
      const at = body.indexOf(`recordActivity('${kind}'`) >= 0 ? body.indexOf(`recordActivity('${kind}'`) : body.indexOf(`recordActivity( '${kind}'`);
      assert.ok(at >= 0, `${file} no longer records a ${kind} sitting, so this test is stale`);
      assert.match(body.slice(at, at + 400), /activeMs:/, `${file} records a ${kind} sitting without its active time`);
      assert.match(body, /\.touch\(\)/, `${file} never tells its clock a learner did anything`);
    }
  });

  test('no screen credits wall-clock time as active time', () => {
    for (const { file } of CLOCKED) {
      assert.doesNotMatch(flat(file), /activeMs: [^,}]*(openedAt|dealtAt|startedAt|endedAt -)/, `${file} derives activeMs from wall time`);
    }
  });

  test('review: typing, the attempt, the flip, hearing and a grade are all learner evidence', () => {
    const body = flat('../ReviewScreen.tsx');
    for (const handler of ['onChangeText', 'attempt = ', 'flipped: !t.flipped', 'tutorVoice.speak(hear)', 'handleGrade = ']) {
      const at = body.indexOf(handler);
      assert.ok(at >= 0, `the review screen has no ${handler}, so this test is stale`);
      assert.match(body.slice(Math.max(0, at - 200), at + 250), /clock\.touch\(\)/, `${handler} does not touch the active clock`);
    }
  });

  test('drill: both completion paths carry active time, and the resume record saves and restores it', () => {
    const body = flat('../DrillScreen.tsx');
    const complete = body.indexOf('completePracticeSitting(');
    assert.ok(complete >= 0, 'the drill no longer completes practice sittings, so this test is stale');
    assert.match(body.slice(complete, complete + 600), /activeMs:/, 'a practice sitting completes without its active time');
    const saves = body.split('savePracticeSession(').slice(1);
    assert.ok(saves.length > 0, 'the drill no longer saves a resume record, so this test is stale');
    for (const save of saves) assert.match(save.slice(0, 600), /activeMs:/, 'a resume save drops the active total');
    assert.match(body, /clock\.restore\(/, 'a resumed sitting restarts its active time from zero');
    assert.match(body, /onChangeText=\{[^}]*clock\.touch\(\)/, 'typing in the drill is not active learning');
  });

  test('conversation: learner turns and tutor turn boundaries are evidence; opening the room is not', () => {
    const body = flat('../ConvoScreen.tsx');
    assert.match(body, /clock\.touch\(\)/);
    assert.doesNotMatch(body, /activeMs: [^,}]*openedAt/, 'the room being open is counted as practice');
  });

  test('lesson: the session screen reports active time through its finish callback', () => {
    const body = flat('../SessionScreen.tsx');
    assert.match(body, /useActiveClock\('lesson'\)/, 'the lesson holds no active clock');
    assert.match(body, /onFinish\(summarise\(state\), \{ activeMs: clock\.read\(\) \}\)/, 'the lesson does not report its active time');
    assert.match(body, /onFinish: \(s: SessionSummary, timing\?: \{ activeMs: number \}\) => void/, 'the finish callback shape moved; tell the navigator owner');
  });

  test('lesson: the navigator writes the reported active time, and only when it was reported', () => {
    const body = flat('../nav/RootNavigator.tsx');
    const at = body.indexOf("recordActivity( 'lesson'") >= 0 ? body.indexOf("recordActivity( 'lesson'") : body.indexOf("recordActivity('lesson'");
    assert.ok(at >= 0, 'the navigator no longer records a lesson sitting, so this test is stale');
    const call = body.slice(at, at + 400);
    assert.match(call, /activeMs: timing\.activeMs/, 'the lesson writer drops the active time the screen measured');
    assert.match(call, /timing === undefined \? \{ durationMs:[^}]*\} :/, 'a lesson with no measured time would get an invented one');
    assert.match(body, /const finish = useCallback\(\(s: SessionSummary, timing\?: \{ activeMs: number \}\)/, 'the finish callback no longer takes timing');
  });
});
