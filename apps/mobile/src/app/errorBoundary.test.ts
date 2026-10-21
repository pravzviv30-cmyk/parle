/**
 * The app's error boundary (F794): a throw anywhere below the root shows a way
 * back instead of a blank screen.
 *
 * apps/mobile has no renderer, so this is tested in two halves. The boundary
 * class has no react-native in it, so node drives the real class: what it
 * draws before and after a catch, what Try again does, and what it reports.
 * React's part, deriving the caught state and calling componentDidCatch, is
 * played by `harness` below in the order React plays it. Where the boundary
 * sits is a source contract over App.tsx in the mould of launchScreen.test.ts,
 * because its place decides three things no class test can see: whether a
 * catch could blank or strand the launch, what a Try again forgets, and what
 * the way back may lean on.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  APP_ERROR_ALARM,
  AppErrorBoundary,
  CAUGHT_ERROR_FIELDS,
  FIRST_MOUNT,
  UNKNOWN_NAME,
  caughtError,
  formatCaughtError,
  logCaughtError,
  triedAgain,
  type BoundaryState,
  type CaughtError,
} from './errorBoundary.ts';
import { APP_ERROR_COPY } from './appErrorCopy.ts';
import { guiltIn } from '../copy/guilt.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const APP = strip(read('../../App.tsx'));
const SCREEN = strip(read('./AppErrorScreen.tsx'));

/** The door, from its declaration to App's. */
const GATE = APP.slice(APP.indexOf('function Gate()'), APP.indexOf('export default function App()'));
/** What the door opens on: the body of `door`, which every screen is drawn from. */
const DOOR = GATE.slice(GATE.indexOf('  const door = () => {'), GATE.indexOf('\n  };', GATE.indexOf('  const door = () => {')));
/** What App() returns. */
const APP_TREE = (() => {
  const app = APP.slice(APP.indexOf('export default function App()'));
  return app.slice(app.indexOf('  return ('), app.indexOf('\n  );\n'));
})();

/** The body of a top-level function, from its declaration to the brace that closes it. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `${name} is no longer where this test looks for it`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, `${name} has no closing brace this test can find`);
  return source.slice(start, end);
}

const CHILDREN = 'the whole app';
const WAY_BACK = 'the way back';

/**
 * The real boundary, with React's part played by hand. React derives the caught
 * state from the static method and renders, then commits and calls
 * componentDidCatch; `throwBelow` does the same, in that order. setState is
 * applied in place, since a constructed instance has no renderer to queue it.
 */
function harness(report?: (caught: CaughtError) => void) {
  const handed: Array<() => void> = [];
  const boundary = new AppErrorBoundary({
    children: CHILDREN,
    fallback: (tryAgain) => {
      handed.push(tryAgain);
      return WAY_BACK;
    },
    ...(report ? { report } : {}),
  });
  boundary.setState = ((update: (state: BoundaryState) => BoundaryState) => {
    boundary.state = { ...boundary.state, ...update(boundary.state) };
  }) as typeof boundary.setState;
  const throwBelow = (thrown: unknown) => {
    boundary.state = { ...boundary.state, ...AppErrorBoundary.getDerivedStateFromError() };
    boundary.componentDidCatch(thrown);
  };
  return { boundary, handed, throwBelow };
}

/** The tree the boundary draws when nothing has been caught, checked for shape. */
function drawnTree(node: ReactNode): ReactElement<{ children: ReactNode }> {
  assert.ok(isValidElement(node), 'the boundary draws something other than the app beneath it');
  const tree = node as ReactElement<{ children: ReactNode }>;
  assert.equal(tree.type, Fragment, 'the app beneath the boundary is wrapped in something that draws');
  assert.equal(tree.props.children, CHILDREN, 'the boundary draws something other than its children');
  return tree;
}

describe('error boundary — a throw shows a way back', () => {
  test('a throw anywhere below the root shows a way back instead of a blank screen', () => {
    // The real boundary and the real screen, not a stand-in of the same name.
    assert.match(APP, /^import \{ AppErrorBoundary \} from '\.\/src\/app\/errorBoundary\.ts';$/m, 'App.tsx draws a boundary from somewhere else');
    assert.match(APP, /^import \{ AppErrorScreen \} from '\.\/src\/app\/AppErrorScreen\.tsx';$/m, 'App.tsx draws an error screen from somewhere else');
    assert.doesNotMatch(APP, /\b(?:function|const|let|var|class)\s+AppError(?:Boundary|Screen)\b/, 'App.tsx declares its own AppErrorBoundary or AppErrorScreen, which could catch nothing');
    assert.equal((APP.match(/<AppErrorBoundary\b/g) ?? []).length, 1, 'App.tsx should draw the one app boundary, once');

    // Where: the door's own root, around every screen the door opens on. Gate
    // returns the boundary and nothing else, so no branch can be drawn outside it.
    const returns = GATE.match(/^ {2}(?:if \(.*\) )?return\b.*$/gm) ?? [];
    assert.deepEqual(
      returns,
      ['  return <AppErrorBoundary fallback={(tryAgain) => <AppErrorScreen onTryAgain={tryAgain} />}>{door()}</AppErrorBoundary>;'],
      'the door returns something that is not the boundary around what it opens on',
    );
    const outsideTheDoor = GATE.replace(DOOR, '');
    for (const screen of ['<Loading', '<SetNewPasswordScreen', '<SignedInRoot', '<EraseNoticeScreen', '<DeletionPendingNotice', '<GuestReminderPlanner', '<AuthFlow']) {
      assert.ok(DOOR.includes(screen), `${screen} is no longer one of the screens the door opens on; this test is reading the wrong thing`);
      assert.ok(!outsideTheDoor.includes(screen), `${screen} is drawn outside the boundary, so a throw in it still empties the screen`);
    }
    // One boundary for every branch, never one per branch: F792's cleanup threw
    // while the welcome handed over to the signed-in app, and a boundary that
    // went with the welcome could not have caught it.
    assert.equal((DOOR.match(/AppErrorBoundary/g) ?? []).length, 0, 'a branch draws a boundary of its own, which is unmounted mid-hand-over');

    // What: the app until a throw, the way back after it.
    const { boundary, handed, throwBelow } = harness(() => {});
    drawnTree(boundary.render());
    assert.deepEqual(handed, [], 'the way back is drawn before anything has been thrown');
    throwBelow(new Error('a cleanup touched a released player'));
    assert.equal(boundary.render(), WAY_BACK, 'a caught throw draws something other than the way back, such as nothing');
    assert.equal(handed.length, 1, 'the way back was drawn without a way to try again');
    assert.equal(typeof handed[0], 'function');
  });

  test('trying again mounts everything behind the door afresh, the way a relaunch does', () => {
    assert.deepEqual(FIRST_MOUNT, { caught: false, generation: 0 });
    assert.deepEqual(triedAgain({ caught: true, generation: 0 }), { caught: false, generation: 1 }, 'Try again leaves the way back up');
    assert.deepEqual(triedAgain({ caught: true, generation: 4 }), { caught: false, generation: 5 });

    const reports: CaughtError[] = [];
    const { boundary, handed, throwBelow } = harness((caught) => reports.push(caught));
    /** Draw the way back, as React would, and press the Try again it was handed. */
    const pressTryAgain = () => {
      assert.equal(boundary.render(), WAY_BACK, 'there is no way back on screen to try again from');
      const tryAgain = handed.at(-1);
      assert.ok(tryAgain, 'the way back was drawn without a way to try again');
      tryAgain();
    };
    const first = drawnTree(boundary.render());
    throwBelow(new Error('first'));
    pressTryAgain();
    const second = drawnTree(boundary.render());
    // A new key is a new tree to React: every component behind the door mounts
    // again and reads the learner's storage back, as it does on a relaunch.
    assert.notEqual(second.key, first.key, 'Try again draws the old tree, keeping whatever state broke it');
    assert.equal(first.key, '0');
    assert.equal(second.key, '1');

    // A throw that comes back is caught again, rather than looping or crashing.
    throwBelow(new Error('second'));
    assert.equal(boundary.render(), WAY_BACK, 'a second throw after Try again is not caught');
    assert.deepEqual(reports.map((r) => r.retries), [0, 1], 'the report does not say how many times the learner had tried again');
    pressTryAgain();
    assert.equal(drawnTree(boundary.render()).key, '2');

    // The signed-in app sets up the learner's storage when it mounts and takes
    // it down when it goes, so the tree a Try again mounts starts as clean as
    // the one a relaunch would.
    const signedIn = APP.slice(APP.indexOf('function SignedInRoot('), APP.indexOf('function Gate()'));
    assert.match(signedIn, /setActiveUser\(user\.id\);\s*const owner = scopeGeneration\(\);\s*void migrateLegacyStores\(user\.id\)/, 'a fresh signed-in tree no longer sets up its own storage scope');
    assert.match(signedIn, /engine\?\.stop\(\);\s*resetSyncRegistry\(\);\s*setActiveUser\(null\);/, 'the signed-in tree no longer takes its storage and sync down when it goes, so a Try again would start on top of them');
  });

  test('trying again keeps what this launch must remember, because the door and the session sit above the boundary', () => {
    // The door holds four facts in memory that must last the whole launch: the
    // under-13 refusal (F637, F641), the kept-copy notice (F496), a pending
    // deletion, and the onboarding draft. Declared in Gate, they belong to the
    // boundary's parent, so a Try again cannot end them.
    const above = GATE.slice(0, GATE.indexOf('  const door = () => {'));
    for (const fact of [
      'const [preAccountRefused, setPreAccountRefused] = useState(false);',
      'const [localCopyKept, setLocalCopyKept] = useState(false);',
      'const [deletionPending, setDeletionPending] = useState(false);',
      'const [preAccountDraft, setPreAccountDraft] = useState<PreAccountOnboardingDraft | null>(null);',
    ]) {
      assert.ok(above.includes(fact), `${fact.slice(7, fact.indexOf(']'))} is no longer held by the door, so a Try again could end it`);
    }
    // The session and a password recovery live in the auth provider, which App
    // draws around the door.
    const auth = APP_TREE.indexOf('<AuthProvider adapter={auth}>');
    const gate = APP_TREE.indexOf('<Gate />');
    assert.ok(auth >= 0 && gate > auth && APP_TREE.indexOf('</AuthProvider>') > gate, 'the auth provider is no longer around the door, so a Try again could drop a password recovery');
    assert.doesNotMatch(APP_TREE, /AppErrorBoundary/, 'App draws a boundary above the door, so a Try again would end what the door holds');
  });

  test('the launch is never inside the boundary, so a catch can neither blank it nor strand it', () => {
    assert.doesNotMatch(GATE, /<LaunchScreen\b/, 'the launch is drawn behind the door, so a catch could take it away before it releases the native launch');
    const hidden = APP_TREE.indexOf('accessibilityElementsHidden={!launched}');
    const gate = APP_TREE.indexOf('<Gate />');
    const launch = APP_TREE.indexOf('{!launched && <LaunchScreen onDone={finishLaunch} />}');
    // The way back is drawn inside the screen-reader hold, so while the launch
    // is up it is out of reach as the app would be, and under the launch, which
    // fades onto it.
    assert.ok(hidden > 0 && gate > hidden, 'a screen reader could reach the way back while the launch is still up');
    assert.ok(launch > gate, 'the launch is no longer drawn over the door until it is done');
    // A real screen: it holds nothing, so the launch can leave onto it, and it
    // never touches the native launch, which is the launch screen's to release.
    assert.doesNotMatch(SCREEN, /useLaunchHold/, 'the way back holds the launch, so the launch would wait on a screen that is not loading');
    assert.doesNotMatch(SCREEN, /expo-splash-screen/, 'the way back reaches for the native launch, which only the launch screen releases');
  });

  test('the way back needs nothing that could have broken, and is never shown the error', () => {
    // Its parts, exactly, so a new one has to be added to the scan below.
    const sources = [...SCREEN.matchAll(/^import [^;]* from '([^']+)';$/gm)].map((m) => m[1]);
    assert.deepEqual(
      sources.sort(),
      ['../components.tsx', '../layout.tsx', '../settings/TroubleLine.tsx', '../theme.ts', './appErrorCopy.ts', 'react-native'],
      'the way back leans on something new, which may be what broke',
    );
    const drawn = [...new Set([...SCREEN.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]))].sort();
    assert.deepEqual(drawn, ['PillButton', 'ScrollScreen', 'Text', 'TroubleLine'], 'the way back draws a part this test does not check');
    // Every hook those parts call, all the way down, needs nothing that lives
    // below the boundary. The safe-area insets come from App. A navigation,
    // auth, profile or context hook would throw, or read a tree that is gone,
    // and a way back that throws escapes to the root and takes the app down.
    // Reanimated's useSharedValue and useAnimatedStyle read no React context;
    // Press animates its press with them. TroubleLine reads two settings
    // contexts that each carry a default, so with no provider above them they
    // give paper colours and an ungrouped line; the defaults are pinned below.
    // 2026-10-20, UI-008: useB and useThemedStyles read the appearance context,
    // whose default is light (pinned below), so they need no provider either.
    const PROVIDER_FREE = new Set(['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useCallback', 'useMemo', 'useId', 'useSafeAreaInsets', 'useWindowDimensions', 'useReduceMotion', 'useSharedValue', 'useAnimatedStyle', 'useSettingsColors', 'useInGroup', 'useB', 'useThemedStyles']);
    assert.match(strip(read('../main/bTheme.tsx')), /export const Appearance = createContext<AppearanceValue>\(\s*appearanceFor\('light'/, 'the appearance context lost its light default, so the way back would need a provider');
    assert.match(strip(read('../settings/SettingsAppearance.tsx')), /const SettingsColors = createContext\(paperColors\);/, 'the settings colours lost their default, so the way back would need a provider');
    assert.match(strip(read('../settings/SettingsGroup.tsx')), /const InGroup = createContext\(false\);/, 'the settings group lost its default, so the way back would need a provider');
    const parts = [
      { file: './AppErrorScreen.tsx', names: ['AppErrorScreen'] },
      { file: '../layout.tsx', names: ['ScrollScreen', 'Screen'] },
      { file: '../components.tsx', names: ['PillButton', 'Press'] },
      { file: '../settings/TroubleLine.tsx', names: ['TroubleLine'] },
      { file: '../motion.ts', names: ['useReduceMotion'] },
    ];
    for (const { file, names } of parts) {
      const source = strip(read(file));
      for (const name of names) {
        const hooks = [...bodyOf(source, name).matchAll(/\b(use[A-Z]\w*)\s*[(<]/g)].map((m) => m[1] ?? '');
        const reaching = hooks.filter((hook) => hook !== name && !PROVIDER_FREE.has(hook));
        assert.deepEqual(reaching, [], `${name} in ${file} calls a hook the way back cannot rely on`);
      }
    }
    // Its one input is the way back. The boundary hands it nothing else.
    assert.match(SCREEN, /export function AppErrorScreen\(\{ onTryAgain \}: \{ onTryAgain: \(\) => void \}\)/, 'the way back takes more than a way to try again');
    assert.match(SCREEN, /footer=\{<PillButton label=\{APP_ERROR_TRY_AGAIN\} onPress=\{onTryAgain\} \/>\}/, 'the one pill does not try again');
    assert.match(SCREEN, /<Text accessibilityRole="header" [^>]*>\{APP_ERROR_TITLE\}<\/Text>/, 'the title is not a header, or says something other than the copy module');
    assert.match(SCREEN, /<TroubleLine message=\{APP_ERROR_BODY\} strong \/>/, 'the sentence says something other than the copy module, or a screen reader is not told');
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 1, 'the way back has more than one ink pill');
  });

  test("a catch reports the error's class and code, never its message", () => {
    const learner = new TypeError('je ne comprends pas, Marie');
    assert.deepEqual(caughtError(learner, 0), { name: 'TypeError', code: null, retries: 0 });
    assert.doesNotMatch(JSON.stringify(caughtError(learner, 0)), /comprends|Marie/, 'a learner\'s words reached the report');
    assert.deepEqual(Object.keys(caughtError(learner, 0)), [...CAUGHT_ERROR_FIELDS], 'the report grew a field');

    const native = Object.assign(new Error("Calling the 'pause' function has failed"), { code: 'ERR_FUNCTION_CALL' });
    assert.deepEqual(caughtError(native, 2), { name: 'Error', code: 'ERR_FUNCTION_CALL', retries: 2 });

    // Anything that is not a plain word goes whole, never trimmed into
    // something still readable.
    assert.equal(caughtError(Object.assign(new Error('x'), { name: 'Bonjour Marie' }), 0).name, UNKNOWN_NAME);
    assert.equal(caughtError(Object.assign(new Error('x'), { code: 'je suis perdu' }), 0).code, null);
    assert.equal(caughtError(Object.assign(new Error('x'), { code: 404 }), 0).code, null);
    for (const thrown of ['je suis perdu', null, undefined, 42, Symbol('x')]) {
      const caught = caughtError(thrown, 0);
      assert.deepEqual(caught, { name: UNKNOWN_NAME, code: null, retries: 0 }, `a thrown ${typeof thrown} is reported as something`);
    }
    // Anything can be thrown, and reading it may itself throw.
    const hostile = { get name(): string { throw new Error('no'); } };
    assert.deepEqual(caughtError(hostile, 1), { name: UNKNOWN_NAME, code: null, retries: 1 });
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    assert.deepEqual(caughtError(proxy, 0), { name: UNKNOWN_NAME, code: null, retries: 0 });
    assert.equal(caughtError(learner, -3).retries, 0);
    assert.equal(caughtError(learner, Number.NaN).retries, 0);
    assert.equal(caughtError(learner, 2.7).retries, 2);

    // One greppable line, the alarm first.
    assert.equal(formatCaughtError({ name: 'TypeError', code: null, retries: 0 }), '[luvani] APP_ERROR_CAUGHT name=TypeError retries=0');
    assert.equal(formatCaughtError({ name: 'Error', code: 'ERR_FUNCTION_CALL', retries: 2 }), `${APP_ERROR_ALARM} name=Error code=ERR_FUNCTION_CALL retries=2`);

    // The boundary reports what it caught, and how many tries came before.
    const reports: CaughtError[] = [];
    const { throwBelow } = harness((caught) => reports.push(caught));
    throwBelow(native);
    assert.deepEqual(reports, [{ name: 'Error', code: 'ERR_FUNCTION_CALL', retries: 0 }]);

    // A report that throws cannot take the way back down with it.
    const broken = harness(() => {
      throw new Error('the sink is down');
    });
    assert.doesNotThrow(() => broken.throwBelow(learner), 'a failing report broke the boundary');
    assert.equal(broken.boundary.render(), WAY_BACK, 'a failing report stopped the way back being drawn');

    // With no report handed in, the alarm goes to the console, once.
    const original = console.error;
    const lines: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      harness().throwBelow(learner);
      logCaughtError({ name: 'Error', code: null, retries: 1 });
    } finally {
      console.error = original;
    }
    assert.deepEqual(lines, [[`${APP_ERROR_ALARM} name=TypeError retries=0`], [`${APP_ERROR_ALARM} name=Error retries=1`]]);
  });

  test('the way back is short, plain and kind', () => {
    assert.equal(APP_ERROR_COPY.length, 3, 'the error screen says something the copy sweep cannot read');
    for (const line of APP_ERROR_COPY) {
      assert.doesNotMatch(line, /[—–·]/, `"${line}" has a dash or a middot`);
      assert.equal(guiltIn(line), undefined, `"${line}" uses a word Luvani's copy does not say`);
      assert.doesNotMatch(line, /!/, `"${line}" shouts`);
      // No raw error and no jargon: the learner is told what happened and what
      // to do, never what the code called it.
      assert.doesNotMatch(line, /\b(error|crash|exception|bug|stack|code|fatal)\b/i, `"${line}" talks like a log`);
      // Nothing about what is saved: the screen can follow an account deletion
      // the learner asked for, when nothing is.
      assert.doesNotMatch(line, /\b(saved|safe|progress|kept|still here)\b/i, `"${line}" promises something about saved work that is not always true`);
      for (const sentence of line.split(/(?<=\.)\s+/)) {
        assert.ok(sentence.split(/\s+/).length <= 12, `"${sentence}" is not a short sentence`);
      }
    }
  });
});
