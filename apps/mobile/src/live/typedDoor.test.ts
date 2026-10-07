/**
 * The quiet door, mid-scene — F201.
 *
 * The defect is not that the door was missing. It was on the screen, worded
 * exactly right, in both places a learner would look for it. What it did was
 * set the screen's own `textMode`, which the connect effect read as a new
 * session, so the app asked the token server for a second grant while this
 * learner's own thirty-minute lease was still standing. The door the product
 * offers for "I cannot speak out loud right now" answered with a refusal, and
 * it did so mid-question, which is the exact moment it exists for.
 *
 * `switchToText` in the hook is the way through and is already green: it takes
 * the microphone down, tells the agent to stop speaking, and keeps the room.
 * What this file holds is the wiring, in the three parts that can each be wrong
 * on their own:
 *
 *   the rule       what taking the door does, and the one case where the old
 *                  rebuild is still right.
 *   the offer      whether the failure screen draws the button at all, which is
 *                  what decides whether a sentence promising typing is true.
 *   the wiring     that both screens go through both of those rather than
 *                  round them.
 *
 * The third is read out of the source. There is no renderer in this suite
 * (docs/TESTING.md), so a component's wiring is what a file can be asked about,
 * and this is the same tool `ConvoScreen.test.ts` and `nav/wiring.test.ts` use
 * for the same reason. The hook itself cannot be imported at all — it reaches
 * expo-modules-core through globals.ts, which type stripping refuses to load —
 * so the one claim in the title that no unit test can make, that no second
 * session is ever asked for, is made by reading the function that would have to
 * ask for it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { failureCopy, type LiveFailure } from './failure.ts';
import { takeTypedDoor, typedDoorFor } from './typedDoor.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything. Only what compiles is wiring. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const convo = stripComments(read('../ConvoScreen.tsx'));
const lesson = stripComments(read('../LiveSessionScreen.tsx'));
const errorView = stripComments(read('./LiveErrorView.tsx'));
const hook = read('./useLiveSession.ts');

/**
 * Every failure mode, listed once, the way `failure.test.ts` lists it. The
 * `satisfies` is what makes a seventeenth failure fail to compile here rather
 * than quietly inherit an answer about whether typing helps.
 */
const EVERY_FAILURE = Object.keys({
  'voice-unavailable': true,
  'mic-denied': true,
  'mic-missing': true,
  'mic-in-use': true,
  'mic-unavailable': true,
  'server-unreachable': true,
  'server-refused': true,
  // Added on main by the connect-and-refusal work while this branch was open.
  // The exhaustive map is the point: a new failure has to be answered here.
  'rate-limited': true,
  'session-elsewhere': true,
  'sign-in-required': true,
  signal: true,
  media: true,
  'agent-absent': true,
  'agent-silent': true,
  dropped: true,
  'tutor-deaf': true,
  'tutor-mute': true,
  'tutor-stalled': true,
  'tutor-talks-over': true,
  unknown: true,
} satisfies Record<LiveFailure, true>) as LiveFailure[];

/** A session that can go quiet where it stands, counting how often it is asked. */
function roomOpen(): { switchToText: () => boolean; asked: () => number } {
  let asked = 0;
  return {
    switchToText: () => {
      asked += 1;
      return true;
    },
    asked: () => asked,
  };
}

/** A session that failed before it ever had a room, which is the only false. */
function noRoom(): { switchToText: () => boolean; asked: () => number } {
  let asked = 0;
  return {
    switchToText: () => {
      asked += 1;
      return false;
    },
    asked: () => asked,
  };
}

describe('the quiet door, taken where the learner is standing — F201', () => {
  test('the quiet door mid-scene keeps the scene and is never refused by the lease', () => {
    // 1. The rule. A room that can go quiet does, and the caller is told so in
    //    a word rather than a boolean it could read either way round.
    const open = roomOpen();
    assert.equal(takeTypedDoor(open), 'kept-the-room');
    assert.equal(open.asked(), 1, 'the door was taken without the room being asked, or by asking it twice');

    // 2. The one case the old path is still right for. `switchToText` returns
    //    false only when there is no room at all, which is a session that
    //    failed before it connected. Nothing can be kept, so a cold start is
    //    not a fallback there, it is the only honest move.
    const cold = noRoom();
    assert.equal(takeTypedDoor(cold), 'needs-a-new-session');
    assert.equal(cold.asked(), 1, 'the rebuild was chosen without asking the session whether it had a room');

    // 3. Two outcomes and no third, so a caller cannot forget one. Written as a
    //    set rather than as two equalities because the point is exhaustiveness.
    assert.deepEqual(
      [...new Set([takeTypedDoor(roomOpen()), takeTypedDoor(noRoom())])].sort(),
      ['kept-the-room', 'needs-a-new-session'],
    );

    // 4. The offer. Exactly the failures whose own sentence says typing helps,
    //    and only while the learner is not already typing. Walked over the
    //    whole union so a new failure cannot arrive with no answer.
    const offered = EVERY_FAILURE.filter((failure) => typedDoorFor(failure, { typing: false }));
    assert.deepEqual(
      offered.sort(),
      ['mic-denied', 'mic-in-use', 'mic-missing', 'mic-unavailable', 'tutor-deaf', 'tutor-mute', 'tutor-talks-over', 'voice-unavailable'],
      'the typed door is offered on a different set of failures than the copy promises it on',
    );
    for (const failure of EVERY_FAILURE) {
      assert.equal(
        typedDoorFor(failure, { typing: false }),
        failureCopy(failure).canType,
        `${failure}: the screen and the sentence disagree about whether typing is a way out`,
      );
      assert.equal(
        typedDoorFor(failure, { typing: true }),
        false,
        `${failure}: a learner already typing is offered a door into the room they are standing in`,
      );
    }
    // And the sentences themselves are the ones that make the offer load
    // bearing: each of these says out loud that typing is available.
    for (const failure of offered) {
      assert.match(
        failureCopy(failure).message,
        /typing/,
        `${failure} draws a typed door under a sentence that never mentions typing`,
      );
    }

    // 5. The claim in the title that no test on this side can drive: the door
    //    does not go near the token server. `useLiveSession.ts` cannot be
    //    imported here at all, so the function that would have to ask for a
    //    second grant is read instead.
    const at = hook.indexOf('const switchToText = useCallback');
    assert.ok(at >= 0, 'switchToText is gone from the hook, so this reads nothing at all');
    const body = hook.slice(at, hook.indexOf('\n  }, [', at));
    assert.match(body, /if \(room === null\) return false;/, 'the door no longer says when it cannot be taken');
    for (const reach of ['/session/start', 'fetch(', 'new Room(', 'grant', 'connect(']) {
      assert.ok(
        !body.includes(reach),
        `switchToText reaches for ${reach}, which is the second session the lease refuses`,
      );
    }
    assert.match(body, /setMicrophoneEnabled\(false\)/, 'the door leaves the microphone open');
    assert.match(body, /phase === 'error' \? \{ phase: 'live' \}/, 'the failure screen stays up over the room it kept');

    // 6. The wiring, screen by screen. Both doors on the conversation go
    //    through the rule, and the rebuild exists in exactly one place: inside
    //    the branch that was told there is no room.
    assert.match(
      convo,
      /const goQuiet = \(\) => \{\s*if \(takeTypedDoor\(live\) === 'needs-a-new-session'\) setOpenedTyped\(true\);/,
      'the conversation takes the quiet door by hand again',
    );
    assert.equal(
      (convo.match(/setOpenedTyped\(true\)/g) ?? []).length,
      1,
      'something else on the conversation flips the session mode, which is what restarts the session',
    );
    assert.match(convo, /IconAction layout="inline" icon="keyboard" label=\{QUIET_DOOR\} onPress=\{goQuiet\}/, 'the choosing screen has its own door again');
    assert.match(
      convo,
      /onType=\{!walkMode && typedDoorFor\(live\.status\.failure, \{ typing \}\) \? goQuiet : null\}/,
      'the failure screen decides for itself whether typing is offered',
    );

    // The restart itself. It is still there, it is still an effect, and it
    // still watches only the modes this session CONNECTS in: a door that
    // changed anything this list reads would restart the session again, which
    // is the defect wearing its original clothes.
    assert.equal((convo.match(/live\.start\(\)/g) ?? []).length, 1, 'the conversation starts a session from more than one place');
    assert.match(
      convo,
      /if \(!walkMode\) \{ void live\.start\(\); return; \}[\s\S]*?\}, \[openedTyped, walkMode\]\);/,
      'the connect effect watches something other than the cold-start mode',
    );
    assert.match(convo, /const gate = prepareWalk\(walkObserver\(\), \{\s*start: live\.start,/, 'Walk bypasses its interruption gate to start a room');
    assert.match(
      convo,
      /const typing = openedTyped \|\| live\.voiceless;/,
      'the screen keeps its own copy of whether the learner is typing, which the room already knows',
    );

    // 7. The lesson, on the same terms. It had the same rebuild and the same
    //    lease waiting for it; `onRetryAsText` is now only the cold path.
    assert.match(
      lesson,
      /const goQuiet = \(\) => \{\s*if \(takeTypedDoor\(live\) === 'needs-a-new-session'\) onRetryAsText\(\);/,
      'the lesson still rebuilds itself to go quiet',
    );
    assert.match(lesson, /onRetryAsText: \(\) => void;/, 'the fallback is optional again, so the door can be a button that does nothing');
    assert.equal(
      (lesson.match(/onRetryAsText\(\)/g) ?? []).length,
      1,
      'the lesson reaches for the cold rebuild from somewhere other than the one branch that needs it',
    );
    assert.match(
      lesson,
      /onType=\{typedDoorFor\(live\.status\.failure, \{ typing \}\) \? goQuiet : null\}/,
      'the two live screens decide the typed door differently, which is how they drift',
    );

    // 8. The screen the door is drawn on. The button appears only when it has
    //    something to do, and the prop is required so that forgetting it is a
    //    compile error rather than a promise with nothing under it.
    assert.match(errorView, /onType: \(\(\) => void\) \| null;/, 'onType is optional again, so a screen can silently drop the door');
    assert.match(errorView, /const canType = copy\.canType && onType !== null;/, 'the button no longer checks it has a handler');
    assert.match(errorView, /label="Continue by typing" onPress=\{onType\}/, 'the door is drawn without being wired to anything');

    // 9. And Back closes the room. A blocking failure with a typed door leaves
    //    the room OPEN on purpose, so the exit beside that door is the one
    //    place that has to hang up rather than walk away from a running meter.
    for (const [name, screen] of [['the conversation', convo], ['the lesson', lesson]] as const) {
      const block = screen.slice(screen.indexOf('<LiveErrorView'), screen.indexOf('/>', screen.indexOf('<LiveErrorView')));
      assert.match(block, /onBack=\{leaveNow\}/, `${name} walks away from the failure screen without leaving the room`);
      if (name === 'the conversation') {
        assert.match(
          screen,
          /const leaveNow = \(\) => leaveTo\(onExit\)/,
          "the conversation's Back action no longer delegates to the shared leave path",
        );
        assert.match(
          screen,
          /live\.leave\(\)\.finally\(afterLeave\)/,
          "the conversation's shared way out no longer leaves the room before it navigates",
        );
      } else {
        assert.match(
          screen,
          /live\.leave\(\)\.finally\(onExit\)/,
          `${name}'s way out no longer leaves the room before it navigates`,
        );
      }
    }
  });
});
