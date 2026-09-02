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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leaveConfirmCopy } from '../live/leaveConfirm.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Every non-test source file under src, for the "nobody reaches for a native alert" sweep. */
const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/** Comments may say anything; only what compiles is wiring. */
function strip(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

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

describe('the chooser is a stack screen a first run can leave', () => {
  test('the way out of the chooser works when there is nothing behind it', () => {
    // A first run opens ON Missions, so its back stack is empty. goBack() alone
    // would be a chevron that does nothing on the very first screen after
    // signing up, which is the definition of stranding somebody.
    const screen = read('../missions/MissionsScreen.tsx');
    const leave = screen.slice(screen.indexOf('const leave'), screen.indexOf('const open'));
    assert.ok(leave.includes('canGoBack()'), 'the way out assumes there is something behind this screen');
    assert.match(leave, /navigate\('Tabs'\)/, 'a chooser nobody can leave is a dead end on screen one');
  });

  test('the chooser sits above the tabs, not inside them', () => {
    // Inside the tab navigator it would carry the tab bar into a screen whose
    // whole job is to send somebody into a metered room, and Home could not
    // push it. It is a sibling of Lesson, Convo and Drill for the same reasons.
    const navigator = read('./RootNavigator.tsx');
    const tabs = navigator.slice(navigator.indexOf('<Tab.Navigator'), navigator.indexOf('</Tab.Navigator>'));
    assert.ok(!tabs.includes('Missions'), 'the chooser became a sixth tab');
    assert.match(navigator, /<Stack\.Screen name="Missions" component=\{MissionsScreen\}/, 'the chooser is not in the stack');
  });
});

describe('the mission id has to survive the route, not just be declared on it', () => {
  /** The props block passed to ConvoScreen inside the conversation route. */
  function convoScreenProps(source: string): string {
    // Lazily loaded, so the element is LazyConvoScreen. WebRTC stays off the
    // startup path that way, and the props block is the same either way.
    const open = source.indexOf('<LazyConvoScreen');
    assert.ok(open >= 0, 'the conversation route still renders the conversation screen');
    const close = source.indexOf('/>', open);
    assert.ok(close > open, 'the conversation element is still self-closing');
    return source.slice(open, close);
  }

  test('the mission id is forwarded from the route into the live session', () => {
    // This is the tripwire for the defect that made the whole round's headline
    // unreachable. `chooserView.test.ts` proved every card produces route params
    // carrying a mission id, and `nav/types.ts` declared the field, and both were
    // green while `ConvoRoute` forwarded `textMode` and `seedTopic` and dropped
    // the id on the floor one line later. So every mission opened as an ordinary
    // model-written conversation and nothing anywhere could tell.
    //
    // A declaration is not a delivery. What this holds is the delivery.
    const props = convoScreenProps(read('./RootNavigator.tsx'));

    assert.match(
      props,
      /missionId=\{route\.params\?\.missionId\}/,
      'ConvoRoute must hand the chosen mission on to the screen, or the authored scene is unreachable from the app',
    );
    assert.match(props, /seedTopic=\{route\.params\?\.seedTopic\}/, 'and the seed topic it already carried still rides');
  });
});

describe('the door that promises a recap must not close it', () => {
  test('finishing a mission asks for the recap instead of disconnecting', () => {
    // `leave()` publishes the wrap-up tag and then immediately disconnects, and
    // the recap is published back over that same room. So the win card's second
    // door promised a recap and then tore down the channel it arrives through.
    // The screen renders the recap in place precisely so the room can outlive
    // the card, which is what makes the promise keepable at all.
    const screen = read('../ConvoScreen.tsx');
    const open = screen.indexOf('<MissionWin');
    assert.ok(open >= 0, 'the win card is still rendered');
    const card = screen.slice(open, screen.indexOf('/>', open));

    assert.match(card, /live\.requestRecap\(\)/, 'the finish door has to ask for the recap and stay in the room');
    assert.doesNotMatch(card, /leaveNow\(\)/, 'and it must not take the bail-out exit, which disconnects first');
  });
});

describe('the last two hops of the mission pipe', () => {
  test('the mission id is carried from the screen into the session start body', () => {
    // Found by the judge, and it is this round's own defect class surviving one
    // seam further in. Every hop that had already bitten somebody got a
    // tripwire; these two are the hops nobody had reached yet. Delete either
    // spread today and every mission tap silently reverts to the model-written
    // scene build, with all 1421 tests green and nothing anywhere to say so.
    const screen = read('../ConvoScreen.tsx');
    const opts = screen.slice(screen.indexOf('useLiveSession('), screen.indexOf('useLiveSession(') + 900);
    assert.match(
      opts,
      /\.\.\.\(missionId !== undefined \? \{ missionId \} : \{\}\)/,
      'the screen has to hand the chosen mission to the session, or the id dies in a prop nobody reads',
    );

    const hook = read('../live/useLiveSession.ts');
    const body = hook.slice(hook.indexOf('/session/start'), hook.indexOf('/session/start') + 1400);
    assert.match(
      body,
      /\.\.\.\(missionId !== undefined \? \{ missionId \} : \{\}\)/,
      'and the session has to put it in the body, or the token server signs a mission nobody sent',
    );
    assert.match(body, /seedTopic/, 'beside the seed topic that already rode this pipe');
  });
});

describe('the under-13 stop reaches the account and the next launch', () => {
  test('a stop is written by the live screens and read by the gate', () => {
    // F177 built all four pieces and proved them together in
    // profile/ageStop.test.ts. What that cannot prove is that the app calls
    // any of them: a field written by nothing and read by nothing passes every
    // test in that file. This is the delivery, and the delivery is the defect
    // this entry exists for, because the stop lasting one session is exactly
    // what a stored flag nobody reads looks like from the outside.
    for (const [name, screen] of [
      ['the conversation', strip(read('../ConvoScreen.tsx'))],
      ['the lesson', strip(read('../LiveSessionScreen.tsx'))],
    ] as const) {
      assert.match(
        screen,
        /!isUnderAgeStop\(live\.safety\)\) return;[\s\S]{0,120}update\(withAgeStop\(profile\)\)/,
        `${name} meets the one stop that outlives its session and writes nothing down`,
      );
      // Once. A child who meets the boundary twice is not recorded twice, and
      // a re-render is not a second disclosure.
      assert.match(screen, /ageStopWrittenRef\.current \|\| !isUnderAgeStop/, `${name} rewrites the stop on every render`);
      // And it reads the frame through the one reader rather than matching on
      // a category string of its own.
      assert.ok(!/'under-13'/.test(screen), `${name} recognises the category itself, which is a second opinion about a child`);
    }

    // The gate. One value, not two booleans: the age gate lives INSIDE
    // onboarding, so a navigator that asked the two questions separately could
    // show the standalone gate to somebody who has never seen onboarding.
    const gate = strip(read('../app/ProfileContext.tsx'));
    assert.match(gate, /const entry = entryFor\(profile\);/, 'the gate decides what a launch is by hand again');
    assert.ok(!gate.includes('needsOnboarding'), 'the gate asks the two-way question the age stop cannot fit into');
    assert.match(gate, /entry === 'onboarding'/, 'a learner with no record no longer reaches onboarding');
    assert.match(
      gate,
      /entry === 'age-gate'[\s\S]{0,600}<AgeGateScreen onPass=\{\(\) => update\(withAgeGatePassed\(profile\)\)\}/,
      'a stopped account either never reaches the gate, or passing it does not open the doors',
    );

    // The gate itself is the age page, reached the second way. Same pills, same
    // refusal, different two lines, and nothing else asked again.
    const page = strip(read('../onboarding/AgeGateScreen.tsx'));
    for (const same of ['AGE_CONFIRM', 'AGE_DENY', 'ageGate(false).refusal']) {
      assert.ok(page.includes(same), `the return gate does not use the onboarding page's ${same}`);
    }
    assert.ok(page.includes('AGE_RETURN_TITLE') && page.includes('AGE_RETURN_SUB'), 'the return gate asks in the first-run words');
    assert.ok(!page.includes('AGE_QUESTION') && !page.includes('AGE_SUB'), 'the return gate reads as a first run');
    for (const asked of ['<Field', 'NAME_', 'PAGES', 'ProgressDots', 'dailyGoal']) {
      assert.ok(!page.includes(asked), `the return gate asks for ${asked} again, and the learner keeps everything`);
    }
    assert.match(page, /accessibilityRole="header"/, 'the gate has no heading for a screen reader to find');
  });
});

describe('the lesson deck goes through the outbox too', () => {
  test('a finished lesson is banked where a full phone can be retried', () => {
    // `addFromSummary` awaits the disk and drops the answer, so a learner who
    // finished a lesson with no room left lost the whole deck without a word.
    // It still compiles, which is the trap: only `bankLesson` keeps the summary
    // for the next launch to try again.
    const navigator = strip(read('./RootNavigator.tsx'));
    assert.match(navigator, /void bankLesson\(s\);/, 'the lesson banks its cards outside the outbox again');
    assert.ok(
      !/addFromSummary/.test(navigator),
      'the navigator still reaches the raw deck write, which answers and then swallows a failure',
    );
  });
});

describe('leaving a metered room is confirmed, not instant — F310', () => {
  test('the in-room Leave on both live screens opens the confirm rather than leaving — F310', () => {
    // The Leave inside a live room used to disconnect on the tap. It asks first
    // now: the header press opens the sheet, and the exit runs from an effect
    // once the guard is down (F311). Held here because it is a wiring claim two
    // screens must make identically.
    const live = strip(read('../LiveSessionScreen.tsx'));
    assert.match(live, /onLeave=\{\(\) => setConfirming\(true\)\}/, 'the lesson Leave leaves instead of opening the confirm');
    assert.match(live, /<ConfirmSheet\b/, 'the lesson renders no confirm sheet');
    assert.match(live, /leaveConfirmCopy\('lesson'\)/, 'the lesson confirm is not drawn from the lesson copy');

    const convo = strip(read('../ConvoScreen.tsx'));
    assert.match(convo, /onPress: \(\) => setConfirming\(true\)/, 'the conversation Leave leaves instead of opening the confirm');
    assert.match(convo, /<ConfirmSheet\b/, 'the conversation renders no confirm sheet');
    assert.match(convo, /leaveConfirmCopy\('conversation'\)/, 'the conversation confirm is not drawn from the conversation copy');
  });

  test('the leave confirm is honest, puts Stay first, and never uses a native alert — F310', () => {
    // A native Alert would be an OS box the app cannot make say Stay first or
    // keep the mid-session rules, so nothing anywhere reaches for one.
    for (const path of walk(SRC_DIR)) {
      const body = readFileSync(path, 'utf8');
      assert.ok(!body.includes('Alert.alert'), `${path} reaches for a native alert instead of the ConfirmSheet`);
    }
    for (const room of ['lesson', 'conversation'] as const) {
      const copy = leaveConfirmCopy(room);
      assert.equal(copy.stay, 'Stay', `${room} does not offer to stay first`);
      assert.equal(copy.leave, 'Leave', `${room} does not name the way out Leave`);
      assert.match(copy.body, /minutes stop/, `${room} is not honest that the meter stops`);
      assert.ok(!/—/.test(copy.body), `${room} confirm body carries an em dash`);
    }
  });
});

describe('hardware back and the swipe cannot slip a metered room — F311', () => {
  test('hardware back and the swipe on a live room are routed to the confirm — F311', () => {
    // usePreventRemove catches both Android's hardware back and iOS's edge
    // swipe, so neither can pop the room without meeting the same sheet the
    // header Leave opens.
    for (const [name, file] of [
      ['the lesson', '../LiveSessionScreen.tsx'],
      ['the conversation', '../ConvoScreen.tsx'],
    ] as const) {
      const src = strip(read(file));
      assert.match(
        src,
        /usePreventRemove\(inRoom && !leaving, \(\) => setConfirming\(true\)\)/,
        `${name} lets a swipe or hardware back pop the room without confirming`,
      );
    }
  });

  test('the room exit runs after the guard is down, not inline with it — F311', () => {
    // Running leaveNow() straight from the sheet's confirm would be prevented by
    // the very guard that opened the sheet. Instead the confirm raises `leaving`
    // — which drops the guard — and an effect keyed on it runs the exit.
    for (const [name, file] of [
      ['the lesson', '../LiveSessionScreen.tsx'],
      ['the conversation', '../ConvoScreen.tsx'],
    ] as const) {
      const src = strip(read(file));
      assert.match(src, /useEffect\(\(\) => \{[\s\S]{0,80}leaving[\s\S]{0,40}leaveNow\(\)[\s\S]{0,40}\}, \[leaving\]\)/,
        `${name} does not run the exit from an effect keyed on the guard coming down`);
      assert.match(src, /setLeaving\(true\)/, `${name} confirm never lowers the guard, so the exit is prevented forever`);
    }
  });
});
