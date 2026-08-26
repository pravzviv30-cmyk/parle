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
  const bar = named('nav/ParleTabBar.tsx');

  test('changing tab announces the destination', () => {
    // Five icons, no labels. announceTab was written for exactly this and then
    // called from nowhere, so the screen replaced itself in silence.
    assert.ok(bar.includes('announceTab(route.name)'), 'nothing announces the tab change');
  });

  test('staying put announces nothing', () => {
    const guard = bar.slice(bar.indexOf('const onPress'), bar.indexOf('return (', bar.indexOf('const onPress')));
    assert.ok(
      guard.indexOf('!focused') < guard.indexOf('announceTab'),
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
      // learner can reach rather than under the buttons.
      assert.match(
        body,
        /<ScrollView\b/,
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
