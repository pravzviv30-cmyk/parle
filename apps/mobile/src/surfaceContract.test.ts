/**
 * The promises the app makes about its own surface, held to the source.
 *
 * There is no renderer in this suite (docs/TESTING.md), so anything that lives
 * only in JSX has to be checked by reading the file. That is a blunt tool and it
 * is used here for one specific class of thing: a rule the design system states
 * out loud and then breaks somewhere. Every one of these was found broken.
 *
 * The alternative to a grep is a comment nobody reads, which is exactly how a
 * direction contract ended up describing a red microphone two directions after
 * the microphone went green.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES } from './onboarding/answers.ts';
import { FIRST_RUN_SURFACES } from './onboarding/disclosure.ts';

const SRC = new URL('.', import.meta.url).pathname;
const APP = join(SRC, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Comments go, because several of these checks look for a shape in the markup
 * and a comment that mentions `<Svg>` while explaining why one is split in two
 * is not a drawing. Same reason motion.test.ts strips them.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SOURCES = walk(SRC).map((path) => ({ path, body: stripComments(readFileSync(path, 'utf8')) }));
const named = (name: string) => SOURCES.find((f) => f.path.endsWith(name))!.body;

/**
 * `first` is written before `second`, with both proven present first.
 *
 * Every ordering claim in this file goes through here, because the obvious
 * spelling of one is a trap. `indexOf` answers -1 for something that is not
 * there, and -1 sorts before every real position, so `a.indexOf(x) <
 * a.indexOf(y)` passes most confidently in the one case it exists to catch:
 * `x` deleted outright. That is how the flag raised before a network probe went
 * missing under a green suite.
 */
function writtenBefore(text: string, first: string, second: string, why: string): void {
  const at = text.indexOf(first);
  const then = text.indexOf(second);
  assert.notEqual(at, -1, `${why}; \`${first}\` is not there at all`);
  assert.notEqual(then, -1, `${why}; \`${second}\` is not there at all`);
  assert.ok(at < then, `${why}; \`${first}\` comes after \`${second}\``);
}

describe('the tutor intro teaches what the app actually does — J3', () => {
  const intro = named('tutor/TutorIntro.tsx');
  // The page count is a claim made in the file header, so this one check reads
  // the comments the rest of this file deliberately strips.
  const introRaw = readFileSync(join(SRC, 'tutor', 'TutorIntro.tsx'), 'utf8');

  test('the intro names the thinking colour what the theme calls it', () => {
    // It said "Yellow", and rung one's actual yellow lives one screen away.
    assert.match(intro, /Amber, it is thinking/);
    assert.doesNotMatch(intro, /Yellow, it is thinking/);
  });

  test('the intro header counts its own pages', () => {
    const pages = (intro.match(/^\s*key: '/gm) ?? []).length;
    const claimed = /Three pages/.test(introRaw) ? 3 : /Four pages/.test(introRaw) ? 4 : 0;
    assert.notEqual(claimed, 0, 'the header no longer says how many pages there are');
    assert.equal(claimed, pages, `the header claims ${claimed} pages and PAGES holds ${pages}`);
  });
});

describe('the tab bar can be used without seeing it — J4', () => {
  const bar = named('nav/LuvaniTabBar.tsx');

  test('changing tab announces the destination', () => {
    // Five icons, no labels. announceTab was written for exactly this and then
    // called from nowhere, so the screen replaced itself in silence.
    assert.ok(bar.includes('announceTab(route.name)'), 'nothing announces the tab change');
  });

  test('staying put announces nothing', () => {
    const guard = bar.slice(bar.indexOf('const onPress'), bar.indexOf('return (', bar.indexOf('const onPress')));
    // Guarded, because a bare index comparison here reads as passing the moment
    // `!focused` is deleted, which is the whole of the bug it guards.
    writtenBefore(
      guard,
      '!focused',
      'announceTab',
      'a tap on the tab you are already on must not announce anything',
    );
  });
});

describe('the touch floor is a floor — J5', () => {
  test('no control is built below the touch floor', () => {
    for (const { path, body } of SOURCES) {
      const offences = body.match(/min(?:Height|Width):\s*HIT\s*-\s*\d+/g) ?? [];
      assert.deepEqual(offences, [], `${path} builds a control under the 44pt floor: ${offences.join(', ')}`);
    }
  });
});

describe('drawings are drawings — J6', () => {
  test('every drawing in the app is hidden from assistive technology', () => {
    // theme.ts exports `decorative` for this and motion.test.ts already enforces
    // it on illustrations. The icon layer never spread it, so the microphone,
    // the ear and every chevron reached a screen reader as unlabelled images.
    for (const { path, body } of SOURCES) {
      for (const tag of body.match(/<Svg[^>]*>/g) ?? []) {
        assert.ok(
          tag.includes('decorative') || tag.includes('accessibilityElementsHidden') || tag.includes('aria-hidden'),
          `${path} draws an Svg that assistive tech will read: ${tag}`,
        );
      }
    }
  });
});

describe('nothing animates where nobody is looking — J7', () => {
  test('a scene on a tab that is not focused stops moving', () => {
    // Bottom tabs stay mounted after their first visit, so an unpaused loop
    // here runs for the rest of the session behind whatever the learner is
    // actually doing. DESIGN.md says scenes stop; these four did not.
    for (const name of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx']) {
      const body = named(name);
      const scenes = body.match(/<(SpeakBubbles|NobodyYet|HeroCafe|LearnStack|NothingDue)\b[^/>]*\/>/g) ?? [];
      assert.ok(scenes.length > 0, `${name} no longer renders a scene; this test is stale`);
      for (const scene of scenes) {
        assert.ok(scene.includes('paused='), `${name} loops a scene off-screen: ${scene}`);
      }
      assert.ok(body.includes('useIsFocused'), `${name} passes paused without knowing whether it is focused`);
    }
  });
});

describe('progress is dots, not a count — J8', () => {
  test('the lesson header shows its position once, and not as a count', () => {
    const header = named('SessionView.tsx');
    const top = header.slice(header.indexOf('<View style={st.header}>'), header.indexOf('<ScrollView'));
    assert.ok(top.includes('StationLine'), 'the dot rail is what says where the learner is');
    assert.doesNotMatch(
      top,
      /\{prompt\.position\}\s*\/\s*\{prompt\.total\}/,
      'the header prints the position as a number as well as a dot rail',
    );
  });
});

describe('failure is explained to a learner — J9', () => {
  const failure = named('live/failure.ts');
  const messages = [...failure.matchAll(/message:\s*'([^']*)'/g)].map((m) => m[1]!);

  test('no failure message explains the plumbing to the learner', () => {
    assert.ok(messages.length >= 8, 'the failure table shrank; this test is reading the wrong thing');
    for (const message of messages) {
      assert.doesNotMatch(
        message,
        /\b(room service|browser|missing a key|api|token server|endpoint|localhost|cors)\b/i,
        `a learner is told about the plumbing: "${message}"`,
      );
      assert.ok(!/—/.test(message), `"${message}" carries an em dash`);
    }
  });

  test('every failure still offers a way forward', () => {
    for (const message of messages) {
      assert.match(
        message,
        /try again|typing|saved|counted|switch|moment|worth sending|network|allow|settings|sign(ing)? (in|out)|come back|details below/i,
        `"${message}" tells the learner what happened and nothing about what to do`,
      );
    }
  });
});

describe('the live microphone is green — J10', () => {
  test('nothing in the app still calls the live microphone red', () => {
    // The founder chose this direction and the mic went green with it. Three
    // comments went on describing the old one, including the direction contract
    // at the top of App.tsx, which is the first thing anybody reads.
    const contract = readFileSync(join(APP, 'App.tsx'), 'utf8');
    for (const { path, body } of [...SOURCES, { path: 'App.tsx', body: contract }]) {
      assert.doesNotMatch(
        body,
        /red (live )?microphone|signal\.live red|red mic\b/i,
        `${path} still describes the live microphone as red`,
      );
    }
  });
});

describe('one motion vocabulary, not four — J12', () => {
  test('nothing hand-rolls the reduce-motion check any more', () => {
    // DESIGN.md said this had exactly one implementation while it had four,
    // and three of the four sampled the setting once and never looked again —
    // so a learner who turned reduce motion on mid-session went on being
    // animated at until the next launch.
    for (const { path, body } of SOURCES) {
      if (path.endsWith('/motion.ts')) continue;
      assert.ok(
        !body.includes('isReduceMotionEnabled'),
        `${path} asks for reduce motion itself instead of using useReduceMotion`,
      );
    }
  });

  test('the settling entrance has one set of numbers', () => {
    const offenders = SOURCES.filter(
      ({ path, body }) => !path.endsWith('/motion.ts') && /duration:\s*380\b/.test(body),
    );
    assert.deepEqual(
      offenders.map((o) => o.path),
      [],
      'the 380ms settle is copy-pasted again instead of coming from settleIn',
    );
  });
});

describe('the tokens are the vocabulary — J13', () => {
  test('the back chevron never spells the touch floor as a number', () => {
    for (const { path, body } of SOURCES) {
      assert.doesNotMatch(
        body,
        /back:\s*\{\s*width:\s*44\b/,
        `${path} writes 44 where the app has a token that means 44`,
      );
    }
  });

  test('the half step is a token, not a two', () => {
    for (const { path, body } of SOURCES) {
      assert.doesNotMatch(body, /marginTop:\s*2\s*[,}]/, `${path} writes a raw 2 where space(0.5) exists`);
    }
  });
});

describe('nothing ships that nothing renders — J14', () => {
  /** Exports the app used to carry and never called. */
  const RETIRED = ['Chip', 'Bloom', 'OffTheHook'];

  test('the components and scenes nothing imported are gone', () => {
    for (const name of RETIRED) {
      const definers = SOURCES.filter(({ body }) => new RegExp(`export function ${name}\\b`).test(body));
      assert.deepEqual(definers.map((d) => d.path), [], `${name} is exported again and still has no caller`);
    }
  });

  test('every scene the barrel exports is drawn somewhere', () => {
    const barrel = named('illustrations/index.ts');
    const exported = [...barrel.matchAll(/export \{([^}]*)\}/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((n) => n.trim())
      .filter(Boolean);
    assert.ok(exported.length > 0, 'the illustration barrel exports nothing; this test is stale');
    for (const name of exported) {
      // Anywhere but the file that defines it. Some of these are building
      // blocks the other scenes draw with rather than scenes a screen draws.
      const definer = SOURCES.find(({ body }) =>
        new RegExp(`export (function|const) ${name}\\b`).test(body),
      )?.path;
      // Drawn as an element, or called: the barrel carries hooks and helpers
      // as well as scenes, and both kinds have to be reached from somewhere.
      const used = SOURCES.some(
        ({ path, body }) => path !== definer && new RegExp(`(<${name}\\b|\\b${name}\\()`).test(body),
      );
      assert.ok(used, `${name} is exported by the illustration barrel and reached from nowhere`);
    }
  });
});

/* ===========================================================================
 * Phase 3: the first run.
 *
 * Everything below reads source, and that is the honest ceiling of it. There is
 * no renderer here, so "bound to its input" means the props that do the binding
 * are written down, not that VoiceOver read the label out. What these catch is
 * the regression: a heading role dropped in a refactor, a font cap added to
 * make a title fit, a label turned back into a placeholder. What they cannot
 * catch is the experience, and F114's device pass is where that is measured.
 * Nothing here should be quoted as evidence that a screen reader works.
 * =========================================================================== */

/** A path a human can read in a failure message. */
const rel = (path: string) => (path.startsWith(SRC) ? path.slice(SRC.length) : 'App.tsx');

/** App.tsx is a screen too, and the door is written in it. */
const APP_ENTRY = {
  path: join(APP, 'App.tsx'),
  body: stripComments(readFileSync(join(APP, 'App.tsx'), 'utf8')),
};
const EVERYTHING = [...SOURCES, APP_ENTRY];

/**
 * The opening tag that starts at `from`, counting braces.
 *
 * A regex cannot do this and quietly gets it wrong rather than failing: an
 * `onPress={() => setPage(previous)}` carries a `>` that is not the end of the
 * tag, so a lazy `[\s\S]*?>` stops on the arrow and reports a Pressable with
 * no role on every control that takes an arrow function, which is all of them.
 */
function openingTag(body: string, from: number): string {
  let depth = 0;
  for (let i = from; i < body.length; i += 1) {
    const char = body[i]!;
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return body.slice(from, i + 1);
  }
  return body.slice(from);
}

/** Every `<Tag ...>` or `<Tag ... />` in a file, whole. */
function tags(body: string, tag: string): string[] {
  const found: string[] = [];
  const opener = new RegExp(`<${tag}\\b`, 'g');
  for (const match of body.matchAll(opener)) found.push(openingTag(body, match.index));
  return found;
}

describe('one front door, not three — F105', () => {
  test('the app has exactly one product introduction', () => {
    // Three screens used to introduce the product: a device-level splash, the
    // auth welcome, and TutorIntro. Two are gone; the third was demoted to the
    // door of the tutor, where it explains a thing the learner is about to use
    // rather than the app they have already installed.
    const definers = EVERYTHING.filter(({ body }) => /export function WelcomeScreen\b/.test(body)).map((f) =>
      rel(f.path),
    );
    assert.deepEqual(definers, ['onboarding/WelcomeScreen.tsx'], 'the app introduces itself somewhere other than once');

    // One importer, and it decides *when* the welcome shows rather than what it
    // says. Matched on an import statement, because disclosure.ts carries the
    // same filename as a string and a string is not a second front door.
    const importers = EVERYTHING.filter(({ body }) =>
      /import\s*\{[^}]*\bWelcomeScreen\b[^}]*\}\s*from/.test(body),
    ).map((f) => rel(f.path));
    assert.deepEqual(importers, ['auth/AuthFlow.tsx'], 'the welcome is reached from somewhere other than the auth flow');

    // Gone as a folder, as a component, and as a flag with a reader. The key
    // string survives on purpose, in RETIRED_DEVICE_KEYS, which is the sweep.
    assert.deepEqual(
      EVERYTHING.filter(({ path }) => rel(path).startsWith('splash/')).map((f) => rel(f.path)),
      [],
      'the splash folder is back',
    );
    for (const { path, body } of EVERYTHING) {
      assert.doesNotMatch(
        body,
        /\bSplashScreen\b|\bhasSeenSplash\b|\bmarkSplashSeen\b/,
        `${rel(path)} still reaches for the splash`,
      );
    }

    // And the door renders no introduction of its own in front of the flow.
    const gate = APP_ENTRY.body.slice(
      APP_ENTRY.body.indexOf('function Gate()'),
      APP_ENTRY.body.indexOf('export default function App()'),
    );
    assert.ok(gate.includes('<AuthFlow />'), 'Gate no longer renders the auth flow; this test is reading the wrong thing');
    const returned = [...gate.matchAll(/return <([A-Z]\w*)/g)].map((m) => m[1]!);
    assert.deepEqual(
      returned.filter((name) => /Splash|Welcome|Onboard|Intro/.test(name)),
      [],
      'Gate introduces the product itself again; the app has one introduction and AuthFlow is what shows it',
    );
  });
});

describe('a form says out loud what it shows — F109', () => {
  const components = named('components.tsx');
  const field = components.slice(
    components.indexOf('export function Field('),
    components.indexOf('export function TabBar'),
  );

  /** Every `<Field ... />` written anywhere in the app. */
  const calls = SOURCES.flatMap(({ path, body }) =>
    tags(body, 'Field').map((call) => ({ where: rel(path), call })),
  );

  test('every visible field label is bound to its input for assistive tech', () => {
    assert.ok(field.length > 0, 'Field moved or was renamed; this test is reading nothing');
    assert.ok(calls.length >= 8, `only ${calls.length} Field call sites found; this test is reading the wrong thing`);

    // The binding lives in the primitive, once, which is why eight screens got
    // it without being edited. Three platforms want three mechanisms and the
    // spellings were read off react-native 0.86 and react-native-web 0.21,
    // the pair Expo SDK 57 pins.
    assert.match(field, /useId\(\)/, 'Field invents its own ids instead of asking React for one');
    assert.match(field, /<Text\s+id=\{labelId\}/, 'the visible label carries no id for anything to point at');
    assert.match(field, /aria-labelledby=\{[^}]*labelId/, 'Android has nothing to resolve the label from');
    assert.match(field, /aria-label=\{[^}]*name/, 'iOS, which has no labelledby at all, gets no name');
    assert.match(
      field,
      /const name = label \?\? placeholder/,
      'a field with only a placeholder is announced as an unnamed text field',
    );

    // And no caller leaves it with nothing to say. A visible label where there
    // is one, the placeholder where there is not, never neither.
    for (const { where, call } of calls) {
      assert.ok(
        /\blabel=/.test(call) || /\bplaceholder=/.test(call),
        `${where} renders a Field with neither a label nor a placeholder, so it has no accessible name`,
      );
    }
  });

  test('a field error is announced when it appears', () => {
    // Announced, not merely rendered: an error that only changes pixels is
    // invisible to somebody who cannot see the pixels change.
    assert.match(field, /<Text\s+id=\{errorId\}/, 'the error line has no id for the input to describe itself with');
    assert.match(field, /role="alert"/, 'the web is not told the error line is an alert');
    assert.match(field, /accessibilityLiveRegion="polite"/, 'Android is not told to read the error when it appears');
    assert.match(field, /'aria-describedby': errorId/, 'the input does not point at its own error on the web');
    assert.match(field, /'aria-invalid'/, 'the web input is never marked invalid');
    // VoiceOver has neither a live region nor role=alert, so iOS is told.
    assert.match(
      field,
      /AccessibilityInfo\.announceForAccessibility\(error\)/,
      'iOS is left with an error nothing speaks',
    );
    assert.match(
      field,
      /aria-label=\{name != null && error != null \? `\$\{name\}, \$\{error\}` : name\}/,
      'coming back to a failed field on iOS says the name and not the reason',
    );

    // The primitive can only announce an error it is given. These two screens
    // are the ones on the first run that can fail, and every problem they
    // compute has to reach the field it belongs to rather than a loose line.
    for (const where of ['auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx']) {
      const body = named(where);
      const states = [...body.matchAll(/const \[(\w*[eE]rror)\b/g)].map((m) => m[1]!);
      assert.ok(states.length > 0, `${where} no longer tracks a field error; this test is stale`);
      for (const state of states) {
        assert.ok(
          new RegExp(`error=\\{${state}\\}`).test(body),
          `${where} computes ${state} and never hands it to the Field, so nothing announces it`,
        );
      }
    }
  });
});

/**
 * Every screen a brand-new learner crosses, in the order they cross it.
 *
 * OnboardingFlow is one file holding three pages, so it owes one heading per
 * page and the count comes from PAGES rather than from a number typed here.
 */
const FIRST_RUN: readonly { where: string; headings: number }[] = [
  { where: 'onboarding/WelcomeScreen.tsx', headings: 1 },
  { where: 'auth/SignUpScreen.tsx', headings: 1 },
  { where: 'auth/SignInScreen.tsx', headings: 1 },
  { where: 'onboarding/OnboardingFlow.tsx', headings: PAGES.length },
  { where: 'tutor/TutorIntro.tsx', headings: 1 },
];

describe('the first run is readable by more than the eye — F110, F114', () => {
  test('the first-run list and the disclosure list name the same screens', () => {
    // Two lists of first-run surfaces exist: this one, and the one in
    // disclosure.ts that says which files carry the AI wording. A screen that
    // is on that list and not on this one would be told to say "AI" and never
    // checked for a heading, so the lists are pinned together here.
    for (const surface of FIRST_RUN_SURFACES) {
      assert.ok(
        FIRST_RUN.some((screen) => screen.where === surface.where),
        `${surface.where} carries first-run disclosure copy and is not on the first-run accessibility list`,
      );
    }
  });

  test('every first-run screen leads with a heading role', () => {
    // A screen reader's rotor is how somebody finds the top of a page without
    // scrolling through it. A title styled as a title and rolled as nothing is
    // a title only to the eye.
    for (const { where, headings } of FIRST_RUN) {
      const body = named(where);
      const found = (body.match(/accessibilityRole="header"/g) ?? []).length;
      assert.equal(
        found,
        headings,
        `${where} marks ${found} of its ${headings} title(s) as a heading; add accessibilityRole="header" to the Text that carries the title`,
      );
    }
  });

  test('no first-run screen caps font scaling', () => {
    for (const { where } of FIRST_RUN) {
      const body = named(where);
      assert.doesNotMatch(
        body,
        /allowFontScaling\s*[=:]\s*\{?\s*false/,
        `${where} switches off font scaling, so a learner with large text set does not get it`,
      );
      assert.doesNotMatch(
        body,
        /maxFontSizeMultiplier/,
        `${where} caps how far its text may grow, which is the same refusal wearing a number`,
      );
      // The other way to cap text is to give it nowhere to go. Every one of
      // these screens scrolls, so a title at 200% still ends somewhere the
      // learner can reach rather than under the buttons. A ScrollScreen is a
      // scroll container too — the frame's ScrollView — so it counts.
      assert.match(
        body,
        /<Scroll(View|Screen)\b/,
        `${where} has no scroll container, so text that grows has nowhere to go`,
      );
    }
  });

  test('no first-run control opts out of the keyboard', () => {
    for (const { where } of FIRST_RUN) {
      const body = named(where);
      for (const [pattern, complaint] of [
        [/focusable\s*[=:]\s*\{?\s*false/, 'takes a control out of the focus order'],
        [/tabIndex\s*[=:]\s*\{?\s*-\s*\d/, 'gives a control a negative tabIndex'],
        [/accessible\s*[=:]\s*\{?\s*false/, 'hides a control from assistive tech'],
        [/importantForAccessibility="no/, 'tells Android to skip part of the screen'],
      ] as const) {
        assert.doesNotMatch(body, pattern, `${where} ${complaint}`);
      }
      // A tap handler that is not a Pressable is not reachable by keyboard at
      // all, and a Pressable with no role is reachable and unannounced.
      assert.doesNotMatch(
        body,
        /TouchableWithoutFeedback|onStartShouldSetResponder|onTouchEnd/,
        `${where} builds a control out of a raw touch handler, which no keyboard can reach`,
      );
      for (const tag of tags(body, 'Pressable')) {
        assert.match(
          tag,
          /accessibilityRole=/,
          `${where} has a Pressable with no role, so it is reachable and unannounced: ${tag.replace(/\s+/g, ' ').slice(0, 70)}`,
        );
      }
    }
  });

  test('no first-run screen hardcodes a viewport width', () => {
    // Not a device pass. This only proves nobody typed a phone's width into a
    // stylesheet; whether the layout survives five real viewports is F114's
    // stopwatch-and-simulator job, and DEVICE_VERIFICATION.md holds the matrix.
    for (const { where } of FIRST_RUN) {
      const body = named(where);
      assert.doesNotMatch(
        body,
        /\b(width|maxWidth|minWidth):\s*\d/,
        `${where} writes a pixel width into a style instead of letting the layout be told how wide it is`,
      );
      assert.doesNotMatch(
        body,
        /Dimensions\.get\(|useWindowDimensions/,
        `${where} measures the window itself; a first-run screen should not need to know`,
      );
      assert.doesNotMatch(body, /\d\s*(vw|vh)\b/, `${where} uses a browser viewport unit, which native has no answer for`);
    }
  });
});

describe('a tap that starts with a network probe — F154', () => {
  // Ceiling: this reads the tab as text. It cannot prove a second tap did
  // nothing on a device; it proves the guard and the acknowledgement are inside
  // the two handlers that fire the probe, which is where they were missing.
  const tab = named('tabs/PracticeTab.tsx');
  const bodyOf = (opens: string): string => {
    const from = tab.indexOf(opens);
    assert.notEqual(from, -1, `${opens} is gone from PracticeTab; this test is stale`);
    const to = tab.indexOf('\n  };\n', from);
    assert.notEqual(to, -1, `${opens} no longer closes at component level`);
    return tab.slice(from, to);
  };

  test('a practice tap during the probe is acknowledged and never doubled', () => {
    // Both call sites fired recheck() and navigated with no flag at all, so for
    // up to a second and a half the tap did nothing visible and a second tap
    // queued a second navigation. TutorTab already solved this; the tab was the
    // one place it had not been copied to.
    for (const [name, opens] of [
      ['the lesson row', 'const open = ('],
      ['talk again', 'const talkAgain = ('],
    ] as const) {
      const body = bodyOf(opens);
      assert.match(body, /recheck\(\)/, `${name} no longer probes, so this test is stale`);
      assert.match(body, /if \(checking\) return;/, `${name} lets a second tap queue a second navigation`);
      assert.match(body, /setChecking\(false\)/, `${name} never lets go, so one probe disables the tab for good`);
      // The probe cannot reject today, but a handler that would strand the tab
      // if it ever did is a handler that will.
      assert.match(
        body,
        /\.then\(go, go\)/,
        `${name} clears its flag on success only, so a probe that threw would leave the tab dead`,
      );
    }

    // The acknowledgement itself, in the gate's own words rather than a second
    // vocabulary for the same wait.
    assert.match(tab, /TUTOR_OFFLINE/, 'the tab writes its own word for checking instead of the gate\'s');
    assert.match(tab, /\{TUTOR_OFFLINE\.checking\}/, 'nothing on the tab says a probe is running');
    assert.match(
      tab,
      /\{checking && \([\s\S]{0,200}accessibilityLiveRegion="polite"[\s\S]{0,200}TUTOR_OFFLINE\.checking/,
      'the acknowledgement is either not a live region or not tied to the flag, so it is invisible to a screen reader or never goes away',
    );
    // And the one control on the tab that can show a disabled state does.
    assert.match(
      tab,
      /<GhostButton\s+label="Unable to speak right now\?"\s+disabled=\{checking\}/,
      'the quiet door stays live-looking while the probe it would start is already running',
    );
  });

  test('the checking flag is raised before the probe, not merely consulted', () => {
    // Separated out and guarded, because the claim above it used to be spelled
    // `body.indexOf('setChecking(true)') < body.indexOf('recheck()')`. That is
    // true of a handler that never raises the flag at all: -1 is less than the
    // position of the probe. Deleting both raises left the guard, the Checking
    // line and the disabled door all inert under a green suite, which is F154
    // back in full wearing a tick.
    //
    // So the raise is proven present first, then placed: consulted by the guard,
    // raised, and only then the network is touched. Read as three positions in
    // one handler, because a flag raised inside `.then` is a flag raised after
    // the second and a half it exists to cover.
    for (const [name, opens] of [
      ['the lesson row', 'const open = ('],
      ['talk again', 'const talkAgain = ('],
    ] as const) {
      const body = bodyOf(opens);
      assert.ok(
        body.includes('setChecking(true)'),
        `${name} never raises the checking flag, so the tap it starts says nothing for as long as the probe runs`,
      );
      assert.ok(body.includes('recheck()'), `${name} no longer probes, so this test is stale`);
      writtenBefore(
        body,
        'if (checking) return;',
        'setChecking(true)',
        `${name} raises the flag before it has checked whether one is already up`,
      );
      writtenBefore(
        body,
        'setChecking(true)',
        'recheck()',
        `${name} probes before it says it is probing, so the tap is dead while it runs`,
      );
      // Raised once. Twice would mean one of them sits in a callback, which is
      // the same silence in a different place.
      assert.equal(
        (body.match(/setChecking\(true\)/g) ?? []).length,
        1,
        `${name} raises the checking flag more than once, so one of the raises is not the one guarding the probe`,
      );
    }
  });
});

describe('a ghost control can be busy — F152 hand-off', () => {
  // GhostButton was the only button in the set with no disabled state, which is
  // why Forgot password stayed tappable while the screen it sits on was busy.
  // Held here because it is a claim about the design system, not about a screen.
  const ghost = named('components.tsx').match(/export function GhostButton\(\{[\s\S]*?\n\}\n/)![0];

  test('a ghost button can be turned off, and looks it', () => {
    assert.match(ghost, /disabled\?: boolean/, 'GhostButton cannot be disabled');
    assert.match(ghost, /disabled=\{disabled\}/, 'GhostButton stays tappable while disabled');
    assert.match(ghost, /pressed && !disabled/, 'a disabled GhostButton still flashes when pressed');
    assert.match(ghost, /disabled \? paper\.inkFaint/, 'a disabled GhostButton looks live');
  });
});

/* ===========================================================================
 * Phase 1: one frame, one way back, one labelled bar (F307–F315).
 *
 * The design system landed the frame primitive (`layout.tsx`) and the labelled
 * tab bar. These read the screens that adopt them. Same ceiling as everything
 * above: this is a walk over text, so "built on the frame" means the source
 * says so, not that a renderer proved the notch was paid once. What it catches
 * is the regression — a screen that re-grows its own safe-area maths, a second
 * back control, a hand-rolled chevron, a tab that truncates its label.
 * =========================================================================== */

const ROOT = join(SRC, '..', '..', '..');

/** Every tab and pushed screen rebuilt on the shared frame in this phase. */
const ADOPTERS = [
  'tabs/HomeTab.tsx',
  'tabs/TutorTab.tsx',
  'tabs/PracticeTab.tsx',
  'tabs/MyFrenchTab.tsx',
  'tabs/ProfileTab.tsx',
  'SessionView.tsx',
  'SummaryScreen.tsx',
  'ReviewScreen.tsx',
  'DrillScreen.tsx',
  'missions/MissionsScreen.tsx',
  'soundcheck/SoundCheckScreen.tsx',
  'phrases/PhrasebookScreen.tsx',
  'tutor/TutorIntro.tsx',
  'legal/Acknowledgements.tsx',
];

/**
 * The only files that may still measure the safe area themselves.
 *
 * `layout.tsx` owns it. `ConvoScreen` keeps its own scene layout this phase and
 * is not adopted. `RecapScreen` and the focus drill player are pushed screens
 * the design system has not reached yet. The auth, onboarding and friends
 * screens are the same: not adopted, so still framing themselves. Adjust this
 * list as those screens are adopted; a file dropping off it is the work landing.
 */
const SAFE_AREA_ALLOW = [
  'layout.tsx',
  'ConvoScreen.tsx',
  'RecapScreen.tsx',
  'drill/FocusDrillPlayer.tsx',
  'auth/SignInScreen.tsx',
  'auth/SignUpScreen.tsx',
  'auth/SetNewPasswordScreen.tsx',
  'onboarding/WelcomeScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
  'onboarding/AgeGateScreen.tsx',
  'friends/AddFriendsScreen.tsx',
  'tabs/LeaderboardTab.tsx',
];

/**
 * The only files that may still draw a chevron by hand. `layout.tsx` draws the
 * one every adopted screen now borrows; the rest are the not-yet-adopted
 * auth/onboarding/friends screens, and they lose theirs when they are adopted.
 */
const CHEVRON_ALLOW = [
  'layout.tsx',
  'auth/SignInScreen.tsx',
  'auth/SignUpScreen.tsx',
  'friends/AddFriendsScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
];

describe('every screen sits inside the one frame — F307', () => {
  test('every tab and pushed screen is built on Screen or ScrollScreen — F307', () => {
    for (const name of ADOPTERS) {
      assert.match(
        named(name),
        /<(Screen|ScrollScreen)\b/,
        `${name} is not built on the shared frame, so it re-derives the safe-area and keyboard maths itself`,
      );
    }
  });

  test('no adopted screen reads the safe area or opens a ScrollView for itself — F307', () => {
    for (const name of ADOPTERS) {
      const body = named(name);
      assert.ok(
        !body.includes('useSafeAreaInsets'),
        `${name} still measures the safe area itself instead of letting the frame pay the notch once`,
      );
      assert.doesNotMatch(
        body,
        /<ScrollView\b/,
        `${name} opens its own ScrollView; the frame's ScrollScreen is the one that keeps taps and carries the web height fix`,
      );
    }
    // And nobody outside the allow-list re-grows the safe-area read. This is the
    // half that catches a brand new screen measuring for itself.
    for (const { path, body } of SOURCES) {
      if (!body.includes('useSafeAreaInsets')) continue;
      assert.ok(
        SAFE_AREA_ALLOW.some((a) => path.endsWith(a)),
        `${rel(path)} reads the safe area and is neither the frame nor a screen still waiting to be adopted; adopt it or add it to SAFE_AREA_ALLOW with a reason`,
      );
    }
  });
});

describe('one way back, and it is the shared header — F309', () => {
  /** The single-view pushed screens: exactly one header, one way back. */
  const PUSHED_ONE_BACK = [
    'SessionView.tsx',
    'SummaryScreen.tsx',
    'ReviewScreen.tsx',
    'DrillScreen.tsx',
    'missions/MissionsScreen.tsx',
    'soundcheck/SoundCheckScreen.tsx',
    'phrases/PhrasebookScreen.tsx',
    'tutor/TutorIntro.tsx',
    'legal/Acknowledgements.tsx',
  ];

  test('a pushed screen has exactly one way back, and it is the shared header — F309', () => {
    for (const name of PUSHED_ONE_BACK) {
      const headers = (named(name).match(/<ScreenHeader\b/g) ?? []).length;
      assert.equal(
        headers,
        1,
        `${name} draws ${headers} shared headers; a pushed screen shows exactly one way back and it is ScreenHeader`,
      );
    }
    // No adopter hand-rolls a back control beside the shared header.
    for (const name of ADOPTERS) {
      const body = named(name);
      assert.ok(!body.includes('<ChevronLeft'), `${name} hand-rolls a chevron instead of using the shared header`);
      assert.ok(
        !body.includes('accessibilityLabel="Back"'),
        `${name} builds its own Back pressable instead of routing through the shared header`,
      );
    }
    // And the hand-rolled chevron survives nowhere but the frame and the
    // screens not yet adopted.
    for (const { path, body } of SOURCES) {
      if (!body.includes('<ChevronLeft')) continue;
      assert.ok(
        CHEVRON_ALLOW.some((a) => path.endsWith(a)),
        `${rel(path)} draws a chevron by hand outside the frame; the shared header is the one back affordance`,
      );
    }
  });

  test('the end card and the mock lesson have a way out — F309', () => {
    // These three were the dead ends: the summary end card had no back, the
    // session surface's Leave was hand-rolled, and the mock lesson had no exit
    // at all. Now the card gets a chevron, the surface gets the shared Leave,
    // and the mock passes its exit straight through.
    assert.match(named('SummaryScreen.tsx'), /<ScreenHeader\s+back=/, 'the end card has no way back');
    assert.match(named('SessionView.tsx'), /<ScreenHeader\s+leave=/, 'the session surface has no Leave');
    // Leading slash so this reads the mock driver and not LiveSessionScreen,
    // whose filename also ends with "SessionScreen.tsx".
    assert.match(named('/SessionScreen.tsx'), /onLeave=\{onExit\}/, 'the mock lesson never wires its exit to the surface Leave');
  });
});

describe('the hardware back button is answered in place — F312', () => {
  /** Every sub-view that opens in place rather than as a stack route. */
  const IN_PLACE = [
    'phrases/PhrasebookScreen.tsx',
    'tutor/TutorIntro.tsx',
    'legal/Acknowledgements.tsx',
    'tabs/ProfileTab.tsx',
    'SummaryScreen.tsx',
  ];

  test('every in-place sub-view answers the hardware back button — F312', () => {
    for (const name of IN_PLACE) {
      assert.match(
        named(name),
        /useHardwareBack\(/,
        `${name} opens a sub-view in place and never answers Android's hardware back, so the button pops the whole screen`,
      );
    }
  });

  test('the hardware back hook only listens while its view is up — F312', () => {
    const hook = named('nav/useHardwareBack.ts');
    assert.match(hook, /useFocusEffect\(/, 'the hook listens even when its screen is not on top of the stack');
    assert.match(hook, /BackHandler\.addEventListener\(/, 'the hook never registers a back handler');
    assert.match(hook, /return true;/, 'the handler does not consume the press, so the screen still pops behind it');
    assert.match(hook, /if \(!active\) return;/, 'the hook eats the back press even while its sub-view is closed');
  });
});

describe('the tab bar shows a word, and it is the page edge — F313', () => {
  const tabbar = named('nav/LuvaniTabBar.tsx');

  test('every tab cell shows its label, and the label scales and wraps rather than truncating — F313', () => {
    assert.match(tabbar, /<Text\b/, 'the tab cell renders no text at all');
    assert.match(tabbar, /\{label\}/, 'the tab cell does not render its own label');
    for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!tabbar.includes(cap), `the tab bar caps its label with ${cap}; a long word must wrap and the bar grow to hold it`);
    }
  });

  test('the active tab is told by ink and weight, and a screen reader still hears selected — F313', () => {
    assert.match(tabbar, /accessibilityState=\{\{\s*selected/, 'a screen reader is not told which tab is selected');
    assert.match(tabbar, /fontFamily: type\.button\.fontFamily/, 'the active tab is not marked by the heavier weight');
    assert.ok(!/\bst\.dot\b/.test(tabbar) && !tabbar.includes('dotActive'), 'the tab bar still marks the active cell with a dot');
  });

  test("the bar is the page's edge, not a card — F313", () => {
    const from = tabbar.indexOf('bar: {');
    assert.notEqual(from, -1, 'the bar style is gone; this test is reading the wrong thing');
    const barStyle = tabbar.slice(from, tabbar.indexOf('},', from) + 1);
    assert.match(barStyle, /backgroundColor: paper\.ground/, 'the bar is not on the page paper');
    assert.match(barStyle, /borderTopWidth/, 'the bar has no top rule, so it does not read as the edge');
    for (const card of ['shadow', 'elevation', 'borderRadius', "position: 'absolute'"]) {
      assert.ok(!barStyle.includes(card), `the bar carries ${card}, which makes it a floating card rather than the page edge`);
    }
  });

  test('the design doc no longer calls the tabs icon-only — F313', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    assert.ok(!/icon-only/i.test(design), 'DESIGN.md still describes an icon-only tab bar that no screen renders');
  });
});

describe('the active tab wears the identity violet — F325', () => {
  const tabbar = named('nav/LuvaniTabBar.tsx');

  test('the active tab is set in the identity violet', () => {
    // Phase 1 marked the active tab in ink-on-ink, which read as no interactive
    // layer at all. The focused glyph and label both take accent.primary now;
    // the inactive ones stay inkFaint glyph and inkSoft label.
    assert.match(
      tabbar,
      /color=\{focused \? accent\.primary : paper\.inkFaint\}/,
      'the active tab glyph is not set in the identity violet',
    );
    assert.match(
      tabbar,
      /focused \? \{ color: accent\.primary, fontFamily: type\.button\.fontFamily \}/,
      'the active tab label is not set in the identity violet at the heavier weight',
    );
    assert.match(tabbar, /\{ color: paper\.inkSoft \}/, 'the inactive tab label is no longer soft ink');
  });
});

describe('the device runbook carries the Phase 1 checks — F315', () => {
  test('the device runbook carries the Phase 1 layout and back checks — F315', () => {
    // The layout and back work is verifiable statically only up to a point: the
    // keyboard actually clearing the field, the label wrapping at AX5, the swipe
    // being blocked, the hardware back closing a sheet — those are a device's to
    // prove. The runbook is where that pass is recorded, so it has to name them.
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /Phase 1/, 'the runbook has no Phase 1 section for the layout and back pass');
    for (const row of ['Review', 'tab bar', 'hardware back', 'swipe']) {
      assert.match(runbook, new RegExp(row), `the Phase 1 runbook names no check for ${row}`);
    }
  });
});

describe('the Phase 1 revise fixes — F317, F318, F319', () => {
  test('a terminal sound-check card has Done and no chevron — F317', () => {
    // The "no check" and "result" cards are terminal: Done is the one door, as
    // on Review and Drill. The chevron is gated off them, so a terminal card
    // never offers two ways to the same place.
    const src = stripComments(readFileSync(join(SRC, 'soundcheck', 'SoundCheckScreen.tsx'), 'utf8'));
    assert.match(
      src,
      /header=\{!noCheck && phase !== 'result' \?/,
      'the sound-check chevron is not gated off the terminal cards, so a terminal card shows two doors',
    );
  });

  test('the shared Leave tells a screen reader what it leaves — F318', () => {
    // "Leave, button" with no object is what a screen reader heard on every
    // metered screen. The header takes an optional accessibilityLabel and each
    // caller names the room it leaves.
    const layout = stripComments(readFileSync(join(SRC, 'layout.tsx'), 'utf8'));
    assert.match(
      layout,
      /accessibilityLabel=\{leave\.accessibilityLabel \?\? leave\.label\}/,
      'the shared header ignores a leave accessibilityLabel',
    );
    for (const [file, phrase] of [
      ['SessionView.tsx', 'Leave the lesson'],
      ['ConvoScreen.tsx', 'Leave the conversation'],
      ['ReviewScreen.tsx', 'Leave the review'],
      ['DrillScreen.tsx', 'Leave the drills'],
    ] as const) {
      const src = stripComments(readFileSync(join(SRC, file), 'utf8'));
      assert.ok(
        src.includes(`accessibilityLabel: '${phrase}'`),
        `${file} leaves a metered room as a bare "Leave" with no object`,
      );
    }
  });

  test('a Profile sheet that answers back itself is not answered twice — F319', () => {
    // The intro and acknowledgements sheets render their own screens with their
    // own hardware-back hook. ProfileTab's hook stands down for them, so two
    // handlers never race and close the whole sheet from page two.
    const src = stripComments(readFileSync(join(SRC, 'tabs', 'ProfileTab.tsx'), 'utf8'));
    assert.match(
      src,
      /useHardwareBack\(\s*sheet !== 'none' && sheet !== 'intro' && sheet !== 'acknowledgements'/,
      "ProfileTab's hardware back also fires for the sheets that answer it themselves",
    );
  });
});
