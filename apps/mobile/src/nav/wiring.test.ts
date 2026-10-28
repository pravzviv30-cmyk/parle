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
    const start = summary.indexOf('label="Practise this sound"');
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

/**
 * The address bar is a two-way door, and only one side of it was checked.
 *
 * `linking.config.screens` is deliberately explicit rather than a catch-all, so
 * nothing resolves by accident and `luvani://auth/callback` is never swallowed
 * by the navigator. The cost of explicit is that a root screen added without a
 * line in it produces an address on the way in that resolves to nothing on the
 * way back: React Navigation falls back to the raw route name in the bar, and
 * feeding that path in returns undefined, so a reload or a shared link drops
 * the learner on Home.
 *
 * Settings was the one screen that had it, which is the worst one to have it:
 * it holds delete account and the data export. F493.
 */
describe('every root screen has an address on the web — F493', () => {
  test('every root screen the navigator can push has a path it can be read back from', () => {
    const routes = strip(read('./types.ts'));
    const start = routes.indexOf('export type RootStackParamList = {');
    assert.notEqual(start, -1, 'the root route map moved or was renamed; this test is reading nothing');
    const block = routes.slice(start, routes.indexOf('\n};', start));
    const declared = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]!);
    assert.ok(declared.length > 5, `only ${declared.length} root routes were found; this test is reading the wrong block`);

    // What the navigator can actually push, which is the set that matters: a
    // route declared in the type and never registered cannot be reached, and a
    // screen registered and never declared would not compile.
    const navigator = strip(read('./RootNavigator.tsx'));
    const registered = [...navigator.matchAll(/<Stack\.Screen name="(\w+)"/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...registered].sort(),
      [...declared].sort(),
      'the root stack registers a different set of screens than the route map declares',
    );

    // And every one of them has a line in the map. Tabs is the container and
    // takes the empty path with its five children below it; everything else is
    // a word.
    const linkingSource = strip(read('./theme.ts'));
    const config = linkingSource.slice(linkingSource.indexOf('screens: {'));
    const paths = new Map<string, string>();
    for (const name of registered) {
      const match = config.match(new RegExp(`\\b${name}:\\s*(?:'([^']*)'|\\{[\\s\\S]*?path: '([^']*)')`));
      assert.ok(match != null, `${name} is a root screen with no path, so its address is a raw route name nothing can read back`);
      paths.set(name, match[1] ?? match[2]!);
    }

    // A path that can be read back is a path that is unique and, apart from the
    // container, not empty. Two screens on one address resolve to whichever the
    // map met first, which is the same lost learner by a different route.
    const written = [...paths.entries()].filter(([name]) => name !== 'Tabs');
    for (const [name, path] of written) {
      assert.notEqual(path, '', `${name} takes the container's own empty path, so its address is indistinguishable from Home`);
      assert.match(path, /^[a-z][a-z-]*(?:\/:\w+\??)?$/, `${name} has a path a browser cannot carry cleanly: ${path}`);
    }
    const all = [...paths.values()];
    assert.equal(new Set(all).size, all.length, `two root screens share one address: ${all.join(', ')}`);

    // The one this entry was filed about, named rather than left to the sweep,
    // because it is the screen holding delete account and the data export.
    assert.equal(paths.get('Settings'), 'settings', 'Settings has no address of its own');

    // B0 (2026-10-20): the three Phase B detail screens have their addresses.
    assert.equal(paths.get('ScenePreview'), 'scene-preview/:missionId');
    assert.equal(paths.get('Fixes'), 'fixes/:packId');
    assert.equal(paths.get('ThenNow'), 'then-and-now');
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
  test('the in-room end control on both live screens opens the confirm rather than leaving — F310', () => {
    // The end control inside a live room used to disconnect on the tap. It asks
    // first: the header press opens the sheet, and the exit runs from an effect
    // once the guard is down (F311). Held here because it is a wiring claim two
    // screens must make identically.
    const live = strip(read('../LiveSessionScreen.tsx'));
    assert.match(live, /onEnd=\{\(\) => setConfirming\(true\)\}/, 'the lesson end control leaves instead of opening the confirm');
    assert.match(live, /<ConfirmSheet\b/, 'the lesson renders no confirm sheet');
    assert.match(live, /leaveConfirmCopy\('lesson'\)/, 'the lesson confirm is not drawn from the lesson copy');

    const convo = strip(read('../ConvoScreen.tsx'));
    assert.match(convo, /onEnd=\{\(\) => setConfirming\(true\)\}/, 'the conversation end control leaves instead of opening the confirm');
    assert.match(convo, /<ConfirmSheet\b/, 'the conversation renders no confirm sheet');
    assert.match(convo, /leaveConfirmCopy\('conversation', learnerReplies\)/, 'the conversation confirm is not drawn from the conversation copy');
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
    // header end control opens.
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
      assert.match(src, /useEffect\(\(\) => \{[\s\S]{0,80}leaving[\s\S]{0,80}leaveNow\(\)[\s\S]{0,40}\}, \[leaving\]\)/,
        `${name} does not run the exit from an effect keyed on the guard coming down`);
      assert.match(src, /setLeaving\(true\)/, `${name} confirm never lowers the guard, so the exit is prevented forever`);
    }
  });
});

describe('the recap handler keeps its identity between renders — F386', () => {
  // ConvoScreen's recap effect keeps `onRecap` in its dependencies and calls it
  // as soon as a recap exists. The handler writes the learner model, which
  // re-renders this navigator, so an inline arrow here is a new identity every
  // render and the effect re-fires until React refuses. Seen on a simulator:
  // "Maximum update depth exceeded", roughly once a second, for as long as the
  // recap stayed open.
  const NAV = readFileSync(fileURLToPath(new URL('./RootNavigator.tsx', import.meta.url)), 'utf8');

  /** One component's source, from its declaration to the next top-level one. */
  function componentBody(source: string, name: string): string {
    const start = source.indexOf(`function ${name}()`);
    assert.notEqual(start, -1, `${name} is missing from RootNavigator.tsx`);
    const rest = source.slice(start + 1);
    const next = rest.indexOf('\nfunction ');
    return next === -1 ? rest : rest.slice(0, next);
  }

  test('the navigator hands ConvoScreen a memoised recap handler, not an inline arrow — F386', () => {
    assert.match(NAV, /onRecap=\{onRecap\}/, 'onRecap must be passed as a stable reference');
    assert.doesNotMatch(NAV, /onRecap=\{\(/, 'an inline arrow gives onRecap a new identity every render');
    const at = NAV.indexOf('const onRecap = useCallback(');
    assert.notEqual(at, -1, 'onRecap is not declared with useCallback');
    assert.match(NAV.slice(at, at + 400), /\[updateBrain\],/, 'the handler must depend only on the stable updateBrain');
  });

  test('the effect that calls it still keeps it in its dependencies — F386', () => {
    // The memoisation is only worth anything while the effect really does
    // depend on it: if that changes, this fix is load-bearing for nothing.
    const convo = readFileSync(fileURLToPath(new URL('../ConvoScreen.tsx', import.meta.url)), 'utf8');
    assert.match(convo, /\}, \[live\.recap, onRecap, stopped\]\);/, 'the recap effect no longer depends on onRecap');
  });

  // The rule the first version of this fix broke. Memoising onRecap cured the
  // loop and, placed below `if (!replayRead)`, replaced it with a hard crash:
  // a mission route renders Loading on its first pass, so the hook was reached
  // only on the second and React threw "Rendered more hooks than during the
  // previous render." A source-string match for the callback cannot see that,
  // and there is no ESLint here to run react-hooks/rules-of-hooks, so the
  // placement is asserted directly.
  test('every hook in a navigator route runs before that route can return early — F386', () => {
    for (const name of ['ConvoRoute', 'LessonRoute']) {
      const body = componentBody(NAV, name);
      const guard = body.search(/^  if \(.*\) (return|\{)/m);
      if (guard === -1) continue;
      const afterGuard = body.slice(guard);
      const late = afterGuard
        .split('\n')
        .filter((line) => /^  (const|let) .*= use[A-Z]/.test(line) || /^  use[A-Z][A-Za-z]*\(/.test(line));
      assert.deepEqual(
        late,
        [],
        `${name} calls a hook after its first early return, so a render that takes the early path ` +
          `and a render that does not call different numbers of hooks: ${late.join(' | ')}`,
      );
    }
  });
});

describe('a drill opened cold still has a way out', () => {
  // Seen in the browser: a practice sitting reloaded at /drill has no screen
  // behind it, so Leave called goBack, React Navigation answered GO_BACK not
  // handled, and the learner was stuck. Every exit from the drill (Leave, Done,
  // an unreadable link, a sitting that cannot resume) runs through one onDone.
  test('the drill route goes back when it can, and otherwise to Practice for a practice sitting, else the tabs', () => {
    const navigator = strip(read('./RootNavigator.tsx')).replace(/\s+/g, ' ');
    const route = navigator.slice(navigator.indexOf('function DrillRoute()'), navigator.indexOf('function ReviewRoute()'));
    assert.ok(route.length > 0, 'the drill route moved; this test is stale');
    // backOrTabs (`leave.ts`) goes back when it can, and otherwise to the
    // tabs, opened on the tab named here, with the drill closed (F775).
    assert.match(
      route,
      /onDone=\{\(\) => backOrTabs\(nav, practice !== undefined \? 'Practice' : undefined\)\}/,
      'a drill opened by a reload or a shared address has a Leave that does nothing',
    );
    assert.doesNotMatch(route, /onDone=\{\(\) => nav\.goBack\(\)\}/, 'the drill goes back unconditionally again');
    // One exit on the screen, so no branch can skip the fallback.
    const screen = strip(read('../DrillScreen.tsx'));
    assert.match(screen, /const leave = finishAndLeave;/);
    assert.match(screen, /const doneFooter = <PillButton label="Done" onPress=\{finishAndLeave\} \/>;/);
    assert.match(screen, /void gradeWritesRef\.current\.finally\(onDone\);/, 'the drill leaves before its writes come back, or by some other door');
    assert.equal((screen.match(/onDone\(/g) ?? []).length, 0, 'the drill calls onDone directly, around the one exit');
  });
});

describe('every pushed learning screen has a way out when opened cold — whole-app phase 1', () => {
  // Seen in the browser: /review Done did nothing (GO_BACK not handled) and a
  // cold /sound-check crashed reading route.params.missionId. A bare goBack is
  // dead when nothing is behind the screen, so each exit goes back when it can
  // and otherwise to the tabs.
  const navigator = strip(read('./RootNavigator.tsx')).replace(/\s+/g, ' ');
  const between = (from: string, to: string) => {
    const at = navigator.indexOf(from);
    const end = navigator.indexOf(to, at + from.length);
    assert.ok(at >= 0 && end > at, `${from} moved; this test is stale`);
    return navigator.slice(at, end);
  };

  test('the shared fallback goes back when it can and to the tabs otherwise', () => {
    // The helper is pure now, in `leave.ts`, so `leave.test.ts` can run it
    // against the real stack router; the tabs it falls back to are a reset,
    // so a sitting opened cold is closed on the way out (F775).
    const helper = strip(read('./leave.ts')).replace(/\s+/g, ' ');
    assert.match(helper, /export function backOrTabs\(nav: LeavingNav, tab\?: keyof TabParamList\): void \{ if \(nav\.canGoBack\(\)\) nav\.goBack\(\); else nav\.reset\(tabsAlone\(tab\)\); \}/);
    // 2026-10-21 UI-008, artboard B-Celebrate: tabsAlone joins it for "See your journey".
    assert.match(navigator, /import \{ backOrTabs, tabsAlone, type LeavingNav \} from '\.\/leave\.ts';/, 'the navigator keeps a fallback of its own');
    assert.doesNotMatch(navigator, /function backOrTabs\(/, 'the navigator keeps a fallback of its own');
  });

  test('review, lesson, conversation and sound check never call a bare goBack', () => {
    for (const [from, to] of [
      ['function LessonRoute()', 'function ConvoRoute()'],
      ['function ConvoRoute()', 'function DrillRoute()'],
      ['function ReviewRoute()', 'function PolicyRoute()'],
      ['function SoundCheckRoute()', 'function '],
    ] as const) {
      const route = between(from, to);
      assert.doesNotMatch(route, /=> nav\.goBack\(\)/, `${from} has an exit that is dead on a cold link`);
      assert.match(route, /backOrTabs\(nav/, `${from} no longer uses the safe exit`);
    }
  });

  test('a cold sound check reads its params optionally and never guesses a situation', () => {
    const route = between('function SoundCheckRoute()', 'function ');
    assert.doesNotMatch(route, /route\.params\.missionId/, 'the route reads params that a cold link does not have');
    assert.match(route, /route\.params\?\.missionId/);
    assert.match(route, /missionId=\{missionId\}/);
    assert.doesNotMatch(route, /mission:cafe|getMission\(/, 'the route invents a situation');
    const screen = strip(read('../soundcheck/SoundCheckScreen.tsx'));
    assert.match(screen, /missionId: string \| null;/);
    assert.match(screen, /Choose a situation first\./);
  });
});

describe('Listen only is delivered, not just declared', () => {
  // Same lesson as the mission id above: a param on the route type that no hop
  // forwards is a choice the learner made and the room never heard. Each hop
  // is held here, from the route to the hook.
  const flat = (s: string): string => s.replace(/\s+/g, ' ');
  const nav = flat(read('./RootNavigator.tsx'));

  test('both routes declare it', () => {
    const types = flat(read('./types.ts'));
    assert.match(types, /Lesson: \{ textMode\?: boolean; listenOnly\?: boolean \} \| undefined;/);
    assert.match(types, /Convo: \{ walkMode\?: boolean; textMode\?: boolean; (\/\*\*.*?\*\/ )?listenOnly\?: boolean;/);
  });

  test('the routes forward it, typed winning over listen', () => {
    assert.match(nav, /const listenOnly = !textMode && \(route\.params\?\.listenOnly \?\? false\);/);
    assert.match(nav, /key=\{textMode \? 'live-text' : listenOnly \? 'live-listen' : 'live'\}/, 'switching lesson mode must rebuild the room');
    assert.match(nav, /listenOnly=\{listenOnly\}/);
    assert.match(nav, /listenOnly=\{!walkMode && !\(route\.params\?\.textMode \?\? false\) && \(route\.params\?\.listenOnly \?\? false\)\}/);
  });

  test('both screens hand it to the hook and open the typing box with it', () => {
    const convo = flat(read('../ConvoScreen.tsx'));
    assert.match(convo, /useState\(listenOnly \|\| prefersTyping\(profile\)\)/);
    const convoOpts = convo.slice(convo.indexOf('useLiveSession('), convo.indexOf('useLiveSession(') + 300);
    assert.match(convoOpts, /listenOnly,/);
    assert.match(convo, /onOptionPress=\{typing \|\| typingOpen \? changeDraft : undefined\}/, 'a tapped option has nowhere to go in the conversation');

    const lesson = flat(read('../LiveSessionScreen.tsx'));
    assert.match(lesson, /const \[typingOpen, setTypingOpen\] = useState\(listenOnly\);/);
    const lessonOpts = lesson.slice(lesson.indexOf('useLiveSession('), lesson.indexOf('useLiveSession(') + 300);
    assert.match(lessonOpts, /listenOnly,/);
  });
});
