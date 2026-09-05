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
    // F391 moved Home's scene out of the tab and into the card that draws it, so
    // reading the two tab files alone would now find nothing and pass. The
    // surfaces are the tabs AND the cards they lifted out; the scene list is the
    // barrel's, so a scene added there cannot slip through unpaused.
    // The daily pack moved Home's drawing behind a chooser, and that nearly made
    // this test blind: once `WordOfDayCard.tsx` stopped naming `WordSprout`, the
    // only scene left on the Home side was `EveningIn` over on Tutor, so
    // `drawn > 0` still held while nothing about the twenty was checked. So the
    // chooser is a surface, and every scene it can draw is a name here.
    const DAILY = [
      'WordSprout', 'WordKettle', 'WordCroissant', 'WordCandle', 'WordCasserole', 'WordTeapot',
      'WordUmbrella', 'WordCloud', 'WordKite', 'WordLeaves', 'WordSnowflake', 'WordPostbox',
      'WordBicycle', 'WordFountain', 'WordPigeon', 'WordLantern', 'WordShutters', 'WordSnail',
      'WordCat', 'WordSailboat',
    ];
    const SCENE = [
      'SpeakBubbles', 'NobodyYet', 'HeroCafe', 'LearnStack', 'NothingDue', 'EveningIn',
      'StillWriting', 'Phrasebook', 'RecapPostcard', 'StreetCorner', 'MarketStall', 'FrontDesk',
      'WordScene', ...DAILY,
    ].join('|');
    const SURFACES = [
      'tabs/HomeTab.tsx',
      'tabs/TutorTab.tsx',
      'home/WordOfDayCard.tsx',
      'home/SituationCard.tsx',
      'home/WordScene.tsx',
    ];
    let drawn = 0;
    for (const name of SURFACES) {
      const body = named(name);
      const scenes = body.match(new RegExp(`<(${SCENE})\\b[^/>]*\\/>`, 'g')) ?? [];
      drawn += scenes.length;
      for (const scene of scenes) {
        assert.ok(scene.includes('paused='), `${name} loops a scene off-screen: ${scene}`);
      }
    }
    assert.ok(drawn > 0, 'none of the tab surfaces renders a scene any more; this test is stale');
    // And the chooser draws every one of the twenty, so a key added without a
    // drawing, or a case that forgets to pass `paused` down, fails here too.
    const chooser = named('home/WordScene.tsx');
    for (const name of DAILY) {
      assert.match(
        chooser,
        new RegExp(`<${name}\\b[^/>]*paused=`),
        `the word-of-the-day chooser draws ${name} without telling it to stop when the tab is not on top`,
      );
    }
    // Only a tab can ask whether it is focused: the hook throws outside a
    // navigator, so a card takes `paused` as a prop from the tab above it.
    for (const name of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx']) {
      assert.ok(
        named(name).includes('useIsFocused'),
        `${name} passes paused without knowing whether it is focused`,
      );
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
  // TodayRow and PhrasebookCard left Home in F399 and F400. Home was their only
  // caller; the daily count's philosophy stays in progress/today.ts with its
  // suite, and the phrasebook is still drawn on My French.
  const RETIRED = ['Chip', 'Bloom', 'OffTheHook', 'TodayRow', 'PhrasebookCard'];

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
    const definers = EVERYTHING.filter(({ body }) => /export function PreAccountOnboarding\b/.test(body)).map((f) =>
      rel(f.path),
    );
    assert.deepEqual(definers, ['onboarding/PreAccountOnboarding.tsx'], 'the app introduces itself somewhere other than once');

    // One importer, and it decides *when* the welcome shows rather than what it
    // says. Matched on an import statement, because disclosure.ts carries the
    // same filename as a string and a string is not a second front door.
    const importers = EVERYTHING.filter(({ body }) =>
      /import\s*\{[^}]*\bPreAccountOnboarding\b[^}]*\}\s*from/.test(body),
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
    assert.ok(gate.includes('<AuthFlow'), 'Gate no longer renders the auth flow; this test is reading the wrong thing');
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
  { where: 'onboarding/PreAccountOnboarding.tsx', headings: 5 },
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
  // Pass 3: the first run adopts the frame too (F352, F357).
  'onboarding/PreAccountOnboarding.tsx',
  'onboarding/AgeGateScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
  'auth/SignUpScreen.tsx',
  'auth/SignInScreen.tsx',
];

/**
 * The only files that may still measure the safe area themselves.
 *
 * `layout.tsx` owns it. `ConvoScreen` keeps its own scene layout this phase and
 * is not adopted. `RecapScreen` and the focus drill player are pushed screens
 * the design system has not reached yet. `SetNewPasswordScreen` is the one auth
 * screen Pass 3 did not reach: it is the password-recovery landing, not a
 * first-run surface, so it still frames itself. `friends` and the leaderboard
 * are the same. The first-run auth and onboarding screens dropped off this list
 * in Pass 3 (F352, F357); a file dropping off it is the work landing.
 */
const SAFE_AREA_ALLOW = [
  'layout.tsx',
  'ConvoScreen.tsx',
  'RecapScreen.tsx',
  'drill/FocusDrillPlayer.tsx',
  'auth/SetNewPasswordScreen.tsx',
  'friends/AddFriendsScreen.tsx',
  'tabs/LeaderboardTab.tsx',
];

/**
 * The only files that may still draw a chevron by hand. `layout.tsx` draws the
 * one every adopted screen now borrows; the rest are the not-yet-adopted
 * friends screen. The auth and onboarding screens gave theirs up in Pass 3.
 */
const CHEVRON_ALLOW = [
  'layout.tsx',
  'friends/AddFriendsScreen.tsx',
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
    // Pass 3: the two auth screens are pushed from the welcome, so each shows
    // exactly one way back and it is the shared header (F357).
    'auth/SignUpScreen.tsx',
    'auth/SignInScreen.tsx',
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

/* ===========================================================================
 * Pass 1b: the chrome is consistent (F329–F343).
 *
 * Same ceiling as everything above: a walk over source, not a renderer. What it
 * catches is the regression a device pass would only find by eye — a tab that
 * re-grows its own title, a caps label sunk to faint ink, a hand-rolled pill, a
 * scroll that pads itself twice over the frame.
 * =========================================================================== */

/** The five tabs, which all open the same way now. */
const TABS = [
  'tabs/HomeTab.tsx',
  'tabs/TutorTab.tsx',
  'tabs/PracticeTab.tsx',
  'tabs/MyFrenchTab.tsx',
  'tabs/ProfileTab.tsx',
];

describe('the session names its rung once — F329', () => {
  test('the rung row says the rung once, in the bullet and the label, and draws no bare dot', () => {
    const view = named('SessionView.tsx');
    // The 8pt fill read ~1.4 on the ground for rung one. The LineBullet row and
    // the ink rungLabel on the same line already name the rung, so the dot goes.
    assert.ok(!view.includes('rungDot'), 'SessionView still draws the bare rung dot or its style');
    assert.ok(!/rungColor/.test(view), 'rungColor still reaches SessionView, so a fill can be drawn on the ground again');
    // The two things that DO name the rung stay.
    assert.match(view, /<LineBullet\b/, 'SessionView no longer draws the rung bullets; this test is stale');
    assert.match(view, /rungLabel\(rung/, 'SessionView no longer names the rung in words');
  });
});

describe('faint ink is a mark, not a word — F330, F338', () => {
  // A drawn glyph the faint ink is allowed to colour: an icon, a spinner, an
  // inactive tab mark. Words a learner reads never travel in it.
  const GLYPH = /<(ArrowRight|EarGlyph|MicGlyph|ChevronLeft|HelpGlyph|GoogleMark|ActivityIndicator|Icon)\b/;
  // The exact off-control expressions faint ink may still letter: a disabled
  // ghost, a muted mic, an inactive bullet numeral, an empty draft's Send, a
  // used token, a locked row's title. Nothing else. Normalised to single spaces.
  const OFF_CONTROL = new Set([
    '<Text style={[type.bodyStrong, { color: disabled ? paper.inkFaint : color }]}>{label}</Text>',
    'const iconColor = active ? paper.onInk : muted ? paper.inkFaint : signal.good;',
    'color: active ? (rung === 4 ? paper.onInk : paper.ink) : paper.inkFaint,',
    '<Text style={[type.bodyStrong, { color: draft.trim().length === 0 ? paper.inkFaint : paper.ink }]}>Send</Text>',
    '<Text style={[type.french, { color: used ? paper.inkFaint : paper.ink }]}>{token}</Text>',
    '<Text style={[type.bodyStrong, { color: locked ? paper.inkFaint : paper.ink }]}>{node.title}</Text>',
  ]);

  test('a caps label is violet, or it reports a state in ink; none is faint', () => {
    for (const { path, body } of SOURCES) {
      for (const line of body.split('\n')) {
        assert.ok(
          !/<Label\b[^>]*paper\.inkFaint/.test(line),
          `${rel(path)} sets a caps Label in faint ink, which clears neither the word floor nor a state's: ${line.trim()}`,
        );
      }
    }
  });

  test('faint ink colours marks and off controls, never a line a learner reads', () => {
    for (const { path, body } of SOURCES) {
      for (const raw of body.split('\n')) {
        if (!raw.includes('paper.inkFaint')) continue;
        const line = raw.trim();
        const norm = line.replace(/\s+/g, ' ');
        const allowed =
          /placeholderTextColor=\{paper\.inkFaint\}/.test(line) ||
          /backgroundColor:\s*paper\.inkFaint/.test(line) ||
          (GLYPH.test(line) && line.includes('paper.inkFaint')) ||
          OFF_CONTROL.has(norm);
        assert.ok(
          allowed,
          `${rel(path)} sets a line a learner reads in the faint ink that only clears the mark floor: ${line}`,
        );
      }
    }
  });
});

describe('the five tabs open the same way — F336', () => {
  test('every tab opens with the one tab header and draws no headline of its own', () => {
    for (const name of TABS) {
      const body = named(name);
      assert.equal(
        (body.match(/<TabHeader\b/g) ?? []).length,
        1,
        `${name} does not open with exactly one TabHeader`,
      );
      assert.doesNotMatch(
        body,
        /\.\.\.type\.display/,
        `${name} spreads the display line into a style of its own instead of leaving it to TabHeader`,
      );
      assert.doesNotMatch(
        body,
        /header=\{[^}]*type\.(title|display)/,
        `${name} passes a title into the frame's header slot instead of opening the scroll body with TabHeader`,
      );
    }
  });

  /**
   * Home is the one tab with no purpose line, and it is named here so a second
   * one cannot go quietly.
   *
   * The founder's mockup opens Home on the rotating greeting and nothing else,
   * and a sentence under it would be the app explaining a screen that is already
   * a word of the day and one situation. Every other tab still says what it is
   * for, and the assertion below is what stops that becoming a habit.
   */
  test('every tab but Home says what it is for in one line — F406', () => {
    const WITHOUT_PURPOSE = ['tabs/HomeTab.tsx'];
    assert.doesNotMatch(
      named('tabs/HomeTab.tsx'),
      /purpose=/,
      'Home grew a purpose line back; the founder asked for the greeting alone',
    );
    for (const name of TABS.filter((t) => !WITHOUT_PURPOSE.includes(t))) {
      const body = named(name);
      // A quoted literal, a template, or a constant read from a `.ts` — the
      // Tutor tab reads TUTOR_PURPOSE, which is where its words belong.
      const m = /purpose=(?:"([^"]*)"|\{`([^`]*)`\}|\{([A-Z_]+)\})/.exec(body);
      assert.ok(m, `${name} opens a TabHeader with no purpose line`);
      if (m![3] !== undefined) continue;
      const purpose = m![1] ?? m![2] ?? '';
      assert.ok(purpose.length > 0, `${name}'s purpose line is empty`);
      assert.doesNotMatch(purpose, /—/, `${name}'s purpose line carries an em dash`);
      assert.doesNotMatch(purpose, /TODO|FIXME|XXX|\bWIP\b/, `${name}'s purpose line carries a debt marker`);
    }
  });
});

describe('the learner initial is one drawn thing — F337', () => {
  test('the learner\'s initial is drawn once, on Profile — F406', () => {
    // Home's monogram went with its purpose line: the founder's mockup opens on
    // the greeting alone. Profile is still reachable from the bottom bar, and it
    // is still the one place the disc is drawn, which is what F337 was for.
    assert.match(named('tabs/ProfileTab.tsx'), /<Monogram\b/, 'Profile no longer draws the shared Monogram');
    assert.doesNotMatch(
      named('tabs/HomeTab.tsx'),
      /<Monogram\b/,
      'Home drew the initial again; the founder asked for the greeting alone',
    );
    // Neither hand-rolls its own disc any more.
    assert.ok(!named('tabs/HomeTab.tsx').includes('st.avatar'), 'Home still hand-rolls its avatar disc');
    assert.ok(!named('tabs/ProfileTab.tsx').includes('st.ring'), 'Profile still hand-rolls its identity ring');
  });
});

describe('the tabs and the drill use the app buttons — F339', () => {
  test('no tab draws a pill, a text button or a card-button of its own', () => {
    for (const name of TABS) {
      const body = named(name);
      // A word boundary so this does not trip on st.doors or st.doorGloss, which
      // are the row of doors and the primary door's gloss, not a card-button.
      assert.doesNotMatch(body, /st\.door\b/, `${name} hand-rolls a card-button (st.door) instead of OutlineButton`);
      assert.ok(!body.includes('st.smallAction'), `${name} hand-rolls a text button (st.smallAction) instead of GhostButton`);
      assert.ok(
        !body.includes('type.button'),
        `${name} sets type.button on a control of its own instead of using the shared buttons`,
      );
    }
  });

  test("the drill's Check is the pill, twice, and nothing hand-rolled", () => {
    const drill = named('DrillScreen.tsx');
    assert.equal(
      (drill.match(/<PillButton\s+label="Check"/g) ?? []).length,
      2,
      "the drill's two Check actions are not both the shared PillButton",
    );
    assert.doesNotMatch(drill, /ds\.check\b/, 'DrillScreen still defines a hand-rolled Check pill style');
    assert.ok(!/accent\./.test(drill), 'the now-unused accent import lingers in DrillScreen');
  });

  test("the tutor's doors are cards drawn with the app's buttons, not a bespoke card-button — F364", () => {
    // F364 turned the three doors into cards that say what is behind them. The
    // shape is still the app's: one Card per door, the pill or the outline from
    // components.tsx for its action, and no hand-rolled pressable card.
    const tutor = named('tabs/TutorTab.tsx');
    const doors = tutor.slice(tutor.indexOf('doors.map('), tutor.indexOf('st.quiet'));
    assert.ok(doors.length > 0, 'the tutor no longer maps its doors');
    assert.match(doors, /<Card\b/, 'a door is not drawn as a Card');
    assert.match(doors, /<PillButton\b/, 'a door that should be pressable is not the pill');
    // F405 replaced the guided door's single outline with the list the founder's
    // screenshot draws: every situation is its own row, so the door needs no
    // button of its own and each row is the way in. The check moves from "a
    // quiet door is an outline" to "the quiet door is the rows", which is the
    // same rule about not hand-rolling a control, read off what is actually there.
    assert.match(doors, /MISSIONS\.map\(/, 'the guided door no longer lists its situations as rows');
    assert.match(doors, /<MissionDisc\b/, 'the situation rows lost the disc that says where each one is');
    assert.match(doors, /door\.gloss/, 'the doors lost their gloss line');
    assert.match(doors, /door\.action/, 'a door names its own button instead of reading the word from gate.ts');
    assert.doesNotMatch(tutor, /st\.door\b/, 'the tutor still draws a bespoke card-button for its quiet doors');
  });
});

describe('the frame owns the tab gaps — F340', () => {
  test('no tab pads its own scroll; the header gap and the bottom air come from the frame', () => {
    for (const name of TABS) {
      const body = named(name);
      const m = /scroll:\s*\{([^}]*)\}/.exec(body);
      assert.ok(m, `${name} no longer defines a scroll style; this test is stale`);
      const scroll = m![1]!;
      assert.doesNotMatch(scroll, /padding/, `${name}'s scroll style pads itself instead of leaving the gaps to the frame`);
      assert.match(scroll, /flexGrow:\s*1/, `${name}'s scroll style should keep only flexGrow: 1`);
      assert.ok(
        !/paddingBottom/.test(body),
        `${name} writes paddingBottom somewhere; the frame owns the air above the tab bar`,
      );
    }
  });
});

describe('a chip is set in the token, not a raw size — F341', () => {
  test('no text names a raw font size, except the inputs that hold iOS at 16', () => {
    for (const { path, body } of SOURCES) {
      if (path.endsWith('/theme.ts')) continue;
      const p = rel(path);
      for (const m of body.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)) {
        const value = Number(m[1]);
        const ok =
          (p === 'components.tsx' && (value === 24 || value === 20)) ||
          ((p === 'ReviewScreen.tsx' || p === 'DrillScreen.tsx') && value === 16);
        assert.ok(
          ok,
          `${p} names a raw font size ${value}; only fitDisplay and the iOS-16 inputs may, everything else is a token`,
        );
      }
    }
  });
});

describe('one primary pill per door, and none on a list — F342, F406', () => {
  /**
   * F406 changed this rule in two ways, both from the founder's own drawings.
   *
   * The Tutor screenshot pills two doors, Resume and Open conversation, so the
   * rule is now one pill per DOOR rather than one per tab. It is pinned at
   * exactly two rather than loosened to "at most", so a third cannot appear.
   *
   * And Home's one pill moved into `home/SituationCard.tsx` when the tab was
   * broken into cards, so counting `tabs/HomeTab.tsx` alone would read zero and
   * pass while the card grew a second. The count is over the tab AND every card
   * it draws, which is stricter than what it replaced.
   */
  test('a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406', () => {
    const HOME_SURFACES = [
      'tabs/HomeTab.tsx',
      'home/WordOfDayCard.tsx',
      'home/SituationCard.tsx',
      'home/MomentumCards.tsx',
      'home/NextStepRow.tsx',
    ];
    const homePills = HOME_SURFACES.flatMap((name) =>
      (named(name).match(/<PillButton\b/g) ?? []).map(() => name),
    );
    assert.deepEqual(
      homePills,
      ['home/SituationCard.tsx'],
      `Home draws its pills in ${homePills.join(', ') || 'nowhere'}; the one pill is Start oral session, on the situation card`,
    );

    const counts: Record<string, number> = {
      'tabs/HomeTab.tsx': 0,
      'tabs/TutorTab.tsx': 2,
      'tabs/MyFrenchTab.tsx': 1,
      // F365: the next step is Practice's one pill. Two branches draw it, and
      // exactly one renders.
      'tabs/PracticeTab.tsx': 2,
      'tabs/ProfileTab.tsx': 0,
    };
    for (const [name, expected] of Object.entries(counts)) {
      const n = (named(name).match(/<PillButton\b/g) ?? []).length;
      assert.equal(n, expected, `${name} draws ${n} primary pills; the tab is allowed ${expected}`);
    }
  });
});

describe('the device runbook carries the Pass 1b chrome checks — F343', () => {
  test('the device runbook carries the Pass 1b chrome checks', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 1b chrome/, 'the runbook has no Pass 1b chrome section');
    const section = runbook.slice(runbook.indexOf('## Pass 1b chrome'));
    const rows = section.split('\n').filter((l) => /\|\s*P1b-\d/.test(l));
    assert.equal(rows.length, 6, `the Pass 1b section names ${rows.length} rows; it should carry P1b-1 through P1b-6`);
    for (let i = 1; i <= 6; i += 1) {
      assert.match(section, new RegExp(`P1b-${i}\\b`), `the Pass 1b runbook names no P1b-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 1b row is walked before a device has: ${row.trim()}`);
    }
  });
});

describe('the device runbook carries the Pass 2 content checks — F350', () => {
  test('the device runbook carries the Pass 2 content checks', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 2 content/, 'the runbook has no Pass 2 content section');
    const section = runbook.slice(runbook.indexOf('## Pass 2 content'));
    const rows = section.split('\n').filter((l) => /\|\s*P2-\d/.test(l));
    assert.equal(rows.length, 4, `the Pass 2 section names ${rows.length} rows; it should carry P2-1 through P2-4`);
    for (let i = 1; i <= 4; i += 1) {
      assert.match(section, new RegExp(`P2-${i}\\b`), `the Pass 2 runbook names no P2-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 2 row is walked before a device has: ${row.trim()}`);
    }
  });
});

describe('one Monogram, borrowed everywhere — F344', () => {
  test('the app exports one Monogram, and the leaderboard borrows it', () => {
    // Two Monograms is two initials that drift: friends/ui.tsx drew a sans disc
    // with radius.pill, components.tsx draws the serif decorative one. The tab
    // that shows the learner their own row used the friends copy. One export now.
    assert.doesNotMatch(
      named('friends/ui.tsx'),
      /export function Monogram/,
      'friends/ui.tsx still exports its own Monogram',
    );
    assert.match(
      named('tabs/LeaderboardTab.tsx'),
      /import \{[^}]*\bMonogram\b[^}]*\} from '\.\.\/components\.tsx'/,
      'the leaderboard does not borrow the shared Monogram',
    );
  });
});

/* ===========================================================================
 * Pass 3: the first run sits inside the one frame (F352, F355, F356, F357,
 * F359, F361).
 *
 * Same ceiling as everything above: a walk over source, not a renderer. What it
 * catches is the regression a device pass would find by eye — a first-run screen
 * that re-grows its own safe-area maths, an auth pill that scrolls away under a
 * keyboard, a first-run chevron drawn by hand beside the shared header.
 * =========================================================================== */

describe('the first run sits inside the one frame — F352', () => {
  /** The five first-run surfaces this pass moved onto the frame. */
  const FIRST_RUN_ADOPTED = [
    'onboarding/PreAccountOnboarding.tsx',
    'onboarding/AgeGateScreen.tsx',
    'onboarding/OnboardingFlow.tsx',
    'auth/SignUpScreen.tsx',
    'auth/SignInScreen.tsx',
  ];

  test('the first-run screens are adopters, not allow-listed — F352', () => {
    for (const name of FIRST_RUN_ADOPTED) {
      // On the adopters list, and off both allow lists: a screen that measures
      // the notch itself and a screen that borrows the frame's cannot both be
      // true, so the allow-list membership is the thing that has to be gone.
      assert.ok(ADOPTERS.includes(name), `${name} is not on the adopters list, so nothing holds it to the frame`);
      assert.ok(!SAFE_AREA_ALLOW.includes(name), `${name} is still allowed to read the safe area itself`);
    }
    // The three that hand-rolled a chevron give it up; the shared header is now
    // their one way back.
    for (const name of ['onboarding/OnboardingFlow.tsx', 'auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx']) {
      assert.ok(!CHEVRON_ALLOW.includes(name), `${name} is still allowed a hand-rolled chevron`);
    }
    // SetNewPassword is the recovery landing, not a first-run surface, so it is
    // not part of this pass and keeps its own safe-area read.
    assert.ok(
      SAFE_AREA_ALLOW.includes('auth/SetNewPasswordScreen.tsx'),
      'SetNewPassword was dropped from the safe-area allow list, but this pass did not adopt it',
    );
    // And each screen is actually built on the frame, with no safe-area read and
    // no ScrollView of its own. (F307 and F309 now cover these five too, since
    // they are on ADOPTERS; this is the F352-named check that they are adopted.)
    for (const name of FIRST_RUN_ADOPTED) {
      const body = named(name);
      assert.match(body, /<(Screen|ScrollScreen)\b/, `${name} is not built on the shared frame`);
      assert.ok(!body.includes('useSafeAreaInsets'), `${name} still measures the safe area itself`);
      assert.ok(!body.includes('<ChevronLeft'), `${name} still hand-rolls a chevron beside the shared header`);
    }
  });
});

describe('the auth screens pin the primary action in the footer — F357', () => {
  /** The balanced `footer={...}` prop of a screen, braces and all. */
  function footerProp(body: string): string {
    const at = body.indexOf('footer={');
    assert.notEqual(at, -1, 'the screen has no footer slot at all');
    const start = at + 'footer='.length;
    let depth = 0;
    for (let i = start; i < body.length; i += 1) {
      if (body[i] === '{') depth += 1;
      else if (body[i] === '}') {
        depth -= 1;
        if (depth === 0) return body.slice(start, i + 1);
      }
    }
    return body.slice(start);
  }

  test('the auth screens pin their pills in the frame\'s footer — F357', () => {
    for (const name of ['auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx']) {
      const body = named(name);
      // Keyboard-aware, so the fields lift rather than hide; and the one back is
      // the shared header, not a hand-rolled chevron.
      assert.match(body, /<ScrollScreen\b[\s\S]*?avoidKeyboard/, `${name} is not a keyboard-aware ScrollScreen`);
      assert.match(body, /<ScreenHeader\s+back=/, `${name} does not draw its one back through the shared header`);

      // The primary pill and the Google outline live in the footer, where a
      // keyboard cannot scroll them out of reach.
      const footer = footerProp(body);
      assert.match(footer, /<PillButton\b/, `${name} does not pin its primary pill in the footer`);
      assert.match(footer, /<OutlineButton\b/, `${name} does not pin the Google door in the footer`);
      assert.match(footer, /GoogleMark/, `${name}'s footer outline is not the Google door`);

      // The switch row is NOT in the footer: it stays at the body's end so a
      // field is visible over an SE-class keyboard rather than pinned under the
      // buttons. It is the only Pressable on the screen, so the footer holding
      // one would be the row in the wrong place.
      assert.ok(!footer.includes('<Pressable'), `${name} pins its switch row in the footer instead of the body's end`);
      assert.match(body, /<Pressable\b[\s\S]*?accessibilityRole="button"/, `${name} lost the switch row from the body`);
    }
  });
});

describe('the device runbook carries the Pass 3 first-run checks — F361', () => {
  test('the device runbook carries the Pass 3 first-run checks — F361', () => {
    // The frame work is verifiable statically up to a point: the left edge not
    // moving from the voice step into the chooser, the keyboard keeping the pill
    // and a field visible, the ear turning violet on tap and clearing on the
    // clip's end, the refusal being spoken on both gates and Sign out landing on
    // the welcome — those are a device's to prove. The runbook records that pass.
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 3 first run/, 'the runbook has no Pass 3 first run section');
    const section = runbook.slice(runbook.indexOf('## Pass 3 first run'));
    const rows = section.split('\n').filter((l) => /\|\s*P3-\d/.test(l));
    assert.equal(rows.length, 6, `the Pass 3 section names ${rows.length} rows; it should carry P3-1 through P3-6`);
    for (let i = 1; i <= 6; i += 1) {
      assert.match(section, new RegExp(`P3-${i}\\b`), `the Pass 3 runbook names no P3-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 3 row is walked before a device has: ${row.trim()}`);
    }
  });
});

describe('the notes the mockup review left behind — F378, F379, F381', () => {
  /** A tally in words, for a doc that says a count the way a sentence does. */
  const IN_WORDS: Record<number, string> = {
    4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
    17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 21: 'twenty-one', 22: 'twenty-two',
    23: 'twenty-three', 24: 'twenty-four', 25: 'twenty-five',
  };

  test("the tab bar's comments say what the bar does — F378", () => {
    // Comments are read raw here on purpose: the whole point is what a reader
    // is told. F313 removed the dot and F325 made active the identity violet
    // plus weight; two headers went on describing ink and a dot for four passes.
    for (const name of ['nav/icons.tsx', 'nav/LuvaniTabBar.tsx']) {
      const raw = readFileSync(join(SRC, name), 'utf8');
      const header = raw.slice(0, raw.indexOf('*/'));
      assert.doesNotMatch(header, /dot underneath/, `${name} still says the active tab has a dot underneath`);
      assert.doesNotMatch(header, /both go ink/, `${name} still says the active tab goes ink`);
      assert.match(header, /identity violet/, `${name} does not say the active tab takes the identity violet`);
      assert.match(header, /no dot|there is no dot/, `${name} does not say there is no dot`);
    }
  });

  test('the live-voice doc counts the failures failure.ts enumerates — F379', () => {
    // The doc said eleven while the table grew to eighteen. Both numbers are
    // read back out of the source so the sentence cannot drift again.
    const failure = stripComments(readFileSync(join(SRC, 'live', 'failure.ts'), 'utf8'));
    const union = failure.slice(failure.indexOf('export type LiveFailure'));
    const kinds = (union.slice(0, union.indexOf(';')).match(/'[a-z-]+'/g) ?? []).length;
    const typed = (failure.match(/canType: true/g) ?? []).length;
    assert.ok(kinds >= 11, `failure.ts enumerates ${kinds} failures, fewer than the doc ever claimed`);
    const doc = readFileSync(join(ROOT, 'docs', 'LIVE_VOICE.md'), 'utf8');
    const said = doc.match(/enumerates (\S+) distinct failures[^;]*; (\S+) carry `canType: true`/);
    assert.ok(said, 'LIVE_VOICE.md no longer says how many failures failure.ts enumerates');
    assert.equal(said[1], IN_WORDS[kinds], `the doc says ${said[1]} failures and failure.ts has ${kinds}`);
    assert.equal(said[2], IN_WORDS[typed], `the doc says ${said[2]} typed routes and failure.ts has ${typed}`);
  });

  test('the device runbook carries the Pass 4 checks — F381', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 4 mockup review/, 'the runbook has no Pass 4 section');
    const section = runbook.slice(runbook.indexOf('## Pass 4 mockup review'));
    const rows = section.split('\n').filter((l) => /\|\s*P4-\d/.test(l));
    assert.equal(rows.length, 6, `the Pass 4 section names ${rows.length} rows; it should carry P4-1 through P4-6`);
    for (let i = 1; i <= 6; i += 1) {
      assert.match(section, new RegExp(`P4-${i}\\b`), `the Pass 4 runbook names no P4-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 4 row is walked before a device has: ${row.trim()}`);
    }
    // The one row a phone alone cannot walk says why.
    assert.match(section, /paid Apple Developer capability/, 'the section does not say what P4-2 needs before it can run');
  });

  /**
   * Pass 5 is the daily Home and the rebuilt Tutor.
   *
   * More of this pass than usual is invisible to a source walk, which is why the section
   * exists. A fade at a measured timing, a screen reader meeting text that changes every
   * few seconds, a column at the largest reading size on a small phone, and whether two
   * pills can be reached with one thumb are all things a test can only take somebody's
   * word for. Naming them here is what makes "not run" an honest answer rather than a
   * silence.
   */
  /**
   * DESIGN.md is read here for the same reason F313 reads it: a doc that
   * describes a screen nobody draws any more is worse than no doc, because it is
   * believed. This pass changed enough of two tabs that four of its sentences
   * became false at once, and the four are checked against the source rather
   * than against each other.
   */
  test('the design doc describes the greeting, the daily situation and the tutor\'s pills as the tabs draw them — F407', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    const home = named('tabs/HomeTab.tsx');
    const tutor = named('tabs/TutorTab.tsx');

    // 1. The greeting. The doc used to call "Bonjour, {name}" Home's single
    //    French flourish, which stopped being true when it started cycling.
    for (const word of ['Salut', 'Bonjour', 'Hello']) {
      assert.ok(design.includes(word), `DESIGN.md never names "${word}", which Home's greeting cycles through`);
    }
    assert.doesNotMatch(
      design,
      /single flourish/,
      'DESIGN.md still calls the greeting a single flourish, and it is three words on a loop now',
    );

    // 2. Home's header. The doc has to say Home is the exception, because the
    //    guard above lets exactly one tab be one.
    assert.match(design, /Home is the one tab that carries no purpose line/, 'DESIGN.md does not name Home as the tab without a purpose line');
    assert.doesNotMatch(home, /purpose=/, 'Home draws a purpose line the design doc says it does not');

    // 3. The pill rule, which changed from per tab to per door.
    assert.match(design, /One primary pill per door/, 'DESIGN.md still states the rule as one pill per tab');
    assert.equal(
      (tutor.match(/<PillButton\b/g) ?? []).length,
      2,
      'the design doc says Tutor carries two pills and the tab draws a different number',
    );

    // 4. The revision. The doc described a fade through three words for exactly
    //    one day; these are the claims that replaced it, and a doc that drifts
    //    back to the old ones is a doc somebody will build from.
    assert.doesNotMatch(
      design,
      /It fades rather than\s+slides/,
      'DESIGN.md still says the greeting fades rather than slides, and it swipes now',
    );
    assert.match(design, /rises up out of its slot/, 'DESIGN.md does not describe the greeting slot');
    // F427 closed the hole and F428 fixed the frame it closed it on. The doc may
    // not go back to promising a name that never moves: that promise and a tight
    // line are the same tradeoff seen from two sides, and this is the side that
    // shipped.
    assert.doesNotMatch(
      design,
      /name is outside the\s+slot and never moves/,
      'DESIGN.md promises a name that never moves, which is the version that left a hole after Salut',
    );
    assert.match(
      design,
      /Seven greetings, and the hour decides which/,
      'DESIGN.md does not record that the greeting pool is filtered by the hour',
    );
    assert.match(design, /daily pack/i, 'DESIGN.md never names the pack of drawings Home rotates through');
    assert.match(
      design,
      /Demo mode\*{0,2} label left the situation card/,
      'DESIGN.md does not record that the demo label left the situation card',
    );

    // 5. The retired pair, so nobody reinstates them from a stale doc.
    for (const gone of ['TodayRow', 'PhrasebookCard']) {
      assert.ok(design.includes(gone), `DESIGN.md never records that ${gone} left Home`);
    }
    assert.ok(design.includes('WordSprout'), 'DESIGN.md never names the scene Home draws for the word of the day');
  });

  /**
   * The same reason as F407, on the sentence the founder's decision of
   * 2026-09-05 rewrote.
   *
   * DESIGN.md described Home's momentum as three tiles that were absent at zero
   * for as long as that was what shipped. It is four cards now, present from a
   * learner's first day, and the four names in that sentence are the four the
   * module exports, read out of `momentum.ts` rather than copied here — a doc
   * checked against another doc is two documents agreeing about a screen
   * neither of them has seen.
   */
  test('the design doc describes the momentum block as four cards there from the first day — F440', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    const row = design.split('\n').find((line) => line.startsWith('| Home |'));
    assert.ok(row, 'DESIGN.md no longer carries a Home row in the tab table');

    // Four, and the source says four: one hero, two half tiles and the goal.
    const block = named('home/MomentumCards.tsx');
    const cards = (block.match(/<Card\b/g) ?? []).length;
    assert.equal(cards, 4, `MomentumCards draws ${cards} cards; the design doc says four`);
    assert.match(row!, /four cards/, 'DESIGN.md does not say the momentum block is four cards');

    // The overturn itself, in the two phrases PRODUCT.md uses for it, so the
    // doc cannot drift back to describing a block nobody would meet on day one.
    assert.match(row!, /there from the first day/, 'DESIGN.md does not record that the momentum block ships on a first run');
    assert.match(row!, /worded as a start/, 'DESIGN.md does not record that a count at nought is worded as a start');
    assert.doesNotMatch(row!, /momentum[^|]{0,80}absent at zero/, 'DESIGN.md still says the momentum block is absent at zero, and it ships from day one now');

    // And it names all four cards, in the module's own words. A doc that names
    // three of them is a doc that will be believed about the fourth.
    const module = named('progress/momentum.ts');
    const labelOf = (name: string): string => {
      const found = new RegExp(`export const ${name} = (?:'([^']*)'|"([^"]*)")`).exec(module);
      assert.ok(found, `momentum.ts no longer exports ${name}, so this check reads nothing`);
      return (found![1] ?? found![2])!;
    };
    for (const name of ['RETAINED_LABEL', 'DAYS_LABEL', 'MASTERY_LABEL', 'GOAL_TITLE']) {
      const label = labelOf(name);
      assert.ok(
        row!.toLowerCase().includes(label.toLowerCase()),
        `DESIGN.md's Home row never names "${label}", which is one of the four cards Home draws`,
      );
    }
    // The week rail is drawn and described, and it is a picture rather than a
    // quota, which is the one part of this block that has ever been mistaken
    // for one.
    assert.match(row!, /week rail/, "DESIGN.md does not describe the days card's week rail");
    assert.match(block, /days\.week\.map\(/, 'the days card no longer draws the week rail the design doc describes');
  });

  /**
   * A runbook row that asks for the wrong thing is worse than no row: a tester
   * follows it and marks a correct build FAIL. This one did. A beginner DOES
   * meet the next step, with the first situation in it, because
   * `suggestedMission` falls through to the head of the catalogue and a blank
   * page is not what a first run should be.
   */
  test('the Pass 5 runbook expects the next step row on a fresh account — F413', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    const section = runbook.slice(runbook.indexOf('## Pass 5 daily home'));
    // The table row, not any line that happens to name it. The prose above the
    // table explains why this row changed with F432, and reading that sentence
    // as the row would fail a runbook that is correct.
    const p54 = section.split('\n').find((l) => /^\|\s*P5-4\b/.test(l));
    assert.ok(p54, 'the Pass 5 runbook has no P5-4 row about a fresh account');
    assert.doesNotMatch(
      p54!,
      /no next step/,
      'the Pass 5 runbook tells a tester a fresh account shows no next step, and Home draws one',
    );
    assert.match(p54!, /next step row/, 'the Pass 5 runbook does not say the next step row is there on day one');
    // And the screen still agrees: the row is outside every momentum gate. It
    // is drawn on its own situation and on nothing else, which is what makes a
    // first run a page with something on it rather than a blank one.
    const home = named('tabs/HomeTab.tsx');
    assert.match(home, /<NextStepRow\b/, 'Home no longer draws the row the runbook says a beginner meets');
    assert.match(
      home,
      /\{nextMission !== null && \(\s*<NextStepRow/,
      'the next step row is drawn behind some other condition than having a situation to offer',
    );
    const gated = home.split('\n').find((l) => l.includes('momentum !== null &&'));
    assert.ok(gated, 'Home no longer gates the momentum block at all, so this check reads nothing');
    assert.ok(
      !gated!.includes('NextStepRow'),
      'the next step row hides behind the momentum gate, so a beginner would meet a blank page',
    );
  });

  test('the device runbook carries the Pass 5 checks — F410', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 5 daily home/, 'the runbook has no Pass 5 section');
    const section = runbook.slice(runbook.indexOf('## Pass 5 daily home'));
    const rows = section.split('\n').filter((l) => /\|\s*P5-\d/.test(l));
    // Eleven since the Home revision: the swipe's gap at every reading size, and
    // a scene that changes with the day, are two more things no source walk can
    // see. The count is asserted rather than a floor so a row cannot go quietly.
    assert.equal(rows.length, 11, `the Pass 5 section names ${rows.length} rows; it should carry P5-1 through P5-11`);
    for (let i = 1; i <= 11; i += 1) {
      assert.match(section, new RegExp(`P5-${i}\\b`), `the Pass 5 runbook names no P5-${i} row`);
    }
    for (const row of rows) {
      // Every row still owes a device. One is allowed to carry evidence from the
      // web build beside that debt, because the greeting's timing was measured
      // there and hiding a real measurement is its own dishonesty; what it may
      // not do is drop the `not run` and read as finished. A bare `pass` in
      // either column without a device walk is the thing this catches.
      assert.match(row, /not run/, `a Pass 5 row claims to be finished before a device walked it: ${row.trim()}`);
      const claimed = row.match(/\|\s*(pass|fail)\s*\|/g) ?? [];
      assert.equal(
        claimed.length,
        0,
        `a Pass 5 row is marked without naming the platform it was walked on: ${row.trim()}`,
      );
    }
    // The four things this pass added that no test in this repository can see.
    for (const [what, pattern] of [
      ['the greeting word sliding up out of its slot', /slides up out of its slot/],
      ['the name staying tight to the word', /never overlapping it and never leaving a hole/],
      ['reduce motion resting the greeting', /reduce motion on/],
      ['a screen reader hearing one greeting', /VoiceOver and TalkBack read one greeting/],
      ['a fresh account meeting four momentum cards with start lines in them', /fresh account/],
      ['the gap after a short word', /word-space rather than a hole/],
      ['a drawing that changes with the day', /different drawing appears on a different day/],
    ] as const) {
      assert.match(section, pattern, `the Pass 5 section never asks anyone to check ${what}`);
    }
  });
});
