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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { PAGES } from './onboarding/answers.ts';
import { FIRST_RUN_SURFACES } from './onboarding/disclosure.ts';
import { MORE_WAYS, startModes } from './tutor/speakView.ts';

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

  test('the intro names the orb states in words, never by colour', () => {
    // It said "Yellow", and rung one's actual yellow lived one screen away; then
    // it said "Amber" to match the theme. Revamp B (F595) repaints the orb coral,
    // mint, sun and ink, each with a glyph and a caption, so the state is carried
    // by the words and the glyph. A colour named in a title teaches the one cue a
    // colour-blind learner cannot see, and goes stale the next time a token moves.
    assert.match(intro, /title: `\$\{persona\.name\} is talking`/, 'the speaking row no longer says who is talking');
    assert.match(intro, /title: 'Your turn'/, 'the listening row no longer says it is the learner\'s turn');
    assert.match(intro, /title: 'It is thinking'/, 'the thinking row no longer says the tutor is thinking');
    assert.doesNotMatch(
      intro,
      /[`'](Red|Green|Amber|Yellow|Violet|Coral|Mint|Sun|Blue)\b/,
      'the intro names an orb state by its colour again',
    );
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
  test('every drawing in the app is hidden from assistive technology, and nothing imports Image', () => {
    // theme.ts exports `decorative` for this and motion.test.ts already enforces
    // it on illustrations. The icon layer never spread it, so the microphone,
    // the ear and every chevron reached a screen reader as unlabelled images.
    // The flat drawings under art/flat/ are Svgs too, so this walk holds them.
    for (const { path, body } of SOURCES) {
      for (const tag of body.match(/<Svg[^>]*>/g) ?? []) {
        assert.ok(
          tag.includes('decorative') || tag.includes('accessibilityElementsHidden') || tag.includes('aria-hidden'),
          `${path} draws an Svg that assistive tech will read: ${tag}`,
        );
      }
    }

    // Revamp A brought raster scenes into a world that had only ever drawn
    // vectors, and an unlabelled <Image> is announced as "image" by every
    // screen reader there is: the same defect J6 closed for the SVG layer.
    // Revamp B (F599) drew them again as vectors and retired the one renderer
    // that was allowed `Image`, so now no file may import it at all. The tag
    // walk is kept, so a picture that comes back is still caught unhidden.
    const importers: string[] = [];
    for (const { path, body } of SOURCES) {
      for (const tag of body.match(/<Image(?=[\s>])[^>]*>/g) ?? []) {
        assert.ok(
          tag.includes('decorative') || tag.includes('accessibilityElementsHidden') || tag.includes('aria-hidden'),
          `${rel(path)} draws a picture that assistive tech will read: ${tag.replace(/\s+/g, ' ')}`,
        );
      }
      for (const line of body.split('\n')) {
        if (!/from '(?:react-native|expo-image)'/.test(line)) continue;
        if (/\bImage\b/.test(line.slice(0, line.indexOf('from')))) importers.push(rel(path));
      }
    }
    assert.deepEqual(
      [...new Set(importers)],
      [],
      'a file imports Image again, so a bitmap can reach the screen outside the flat drawings and without the decorative spread',
    );
  });
});

describe('only the live microphone casts a shadow — F569', () => {
  test('the live glow is the only shadow and no source uses the retired whisper', () => {
    const exact = (name: string) => SOURCES.find((f) => rel(f.path) === name)!.body;
    const glow = (() => {
      const body = exact('components.tsx');
      const at = body.indexOf('speakLive: {');
      assert.notEqual(at, -1, 'components.tsx no longer holds the live microphone glow, so this allowance is stale');
      // To the style's own closing brace, not the first `},` in it: the glow's
      // offset is an object literal and stopping at that one would cut the
      // allowance in half and let the two numbers under it fail this test.
      const end = body.indexOf('\n  },', at);
      assert.notEqual(end, -1, 'the live glow is no longer a top-level entry in the stylesheet, so this allowance is stale');
      return body.slice(at, end);
    })();

    const offenders: string[] = [];
    for (const { path, body } of SOURCES) {
      assert.doesNotMatch(body, /\bshadow\s*(?:\.\s*whisper\b|\[\s*['"]whisper['"]\s*\])/, `${rel(path)} uses the retired whisper`);
      const outsideGlow = rel(path) === 'components.tsx' ? body.replace(glow, '') : body;
      for (const line of outsideGlow.split('\n')) {
        if (/\b(?:shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation|boxShadow)\s*:/.test(line)) {
          offenders.push(`${rel(path)}  ${line.trim()}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `Only the live microphone may cast a shadow:\n${offenders.join('\n')}`);
  });
});

describe('nothing animates where nobody is looking — J7', () => {
  test('decorative scenes are static even when a mounted tab is not focused', () => {
    // Bottom tabs stay mounted after their first visit, so an unpaused loop
    // here runs for the rest of the session behind whatever the learner is
    // actually doing. DESIGN.md says scenes stop; four of them did not.
    //
    // Revamp A moved every remaining loop off the tabs. The word of the day and
    // its twenty drawings went one level down to the `Progress` screen (F572),
    // and the missions chooser is the other screen that draws a picture per
    // place. A pushed screen is mounted behind whatever is pushed over it, so
    // the rule is the same rule and the surfaces are the ones that draw.
    //
    // The scene names are the barrel's own, read out of it rather than copied
    // here, because a list typed into a test is a list that stops matching the
    // app the day somebody adds the twenty-first drawing.
    const illustrations = SOURCES.filter(({ path }) => rel(path).startsWith('illustrations/'));
    assert.ok(illustrations.length > 0);
    for (const { path, body } of illustrations) {
      assert.doesNotMatch(body, /\bAnimated\b|useSceneMotion|arriveStyle|\.interpolate\(/, `${rel(path)} animates a decorative scene`);
    }
    const daily = named('daily/DailyCard.tsx');
    assert.doesNotMatch(daily, /WordScene|sceneForDaily|\bAnimated\b/);
  });
});

describe('a live room is not a progress dashboard — J8', () => {
  test('the lesson header shows neither the retired rail nor a numeric count', () => {
    const header = named('SessionView.tsx');
    const top = header.slice(header.indexOf('<View style={st.header}>'), header.indexOf('<ScrollView'));
    assert.ok(!top.includes('StationLine'), 'the stray progress rail is back above the live lesson');
    assert.doesNotMatch(
      top,
      /\{prompt\.position\}\s*\/\s*\{prompt\.total\}/,
      'the header replaced the retired rail with a score-like numeric position',
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
    // Come alive (F721): Reanimated is a fifth way to ask, and it samples the
    // setting once at load. So its own hook and its System mode are refused,
    // and its global switch is set in one place, the bridge, from the live hook.
    for (const { path, body } of SOURCES) {
      assert.doesNotMatch(body, /\buseReducedMotion\b/, `${rel(path)} asks Reanimated for reduce motion, which it sampled once at load`);
      assert.doesNotMatch(body, /\bReduceMotion\.System\b/, `${rel(path)} leaves reduce motion to Reanimated's sampled answer`);
      if (rel(path) !== 'motion/ReduceMotionBridge.tsx') {
        assert.doesNotMatch(body, /\bReducedMotionConfig\b/, `${rel(path)} sets Reanimated's reduce motion outside the bridge`);
      }
    }
    assert.match(named('motion/ReduceMotionBridge.tsx'), /<ReducedMotionConfig mode=\{reduced \? ReduceMotion\.Always : ReduceMotion\.Never\} \/>/, 'the bridge does not hand Reanimated the live answer');
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
  //
  // Revamp A retired four scenes to raster: the recap postcard, the birthday
  // cake, the cleared table and the phrasebook room are `recap-postcard`,
  // `onboard-cake`, `empty-table` and `phrasebook` in `art/registry.ts` now.
  // They are named here rather than merely deleted, because a vector redrawn
  // beside the raster that replaced it is the next person's coin toss about
  // which one a screen should use.
  //
  // And the five place drawings with the two components that stood between them
  // and a screen. `MissionDisc` drew `MissionArt` on a tinted disc, `MissionArt`
  // switched on a place, and once the chooser took `heroArt` and the rows took
  // `PlaceGlyph` nothing rendered either. Two hops is how a drawing stays alive
  // to a walk over source while no learner has seen it: the walk below finds
  // `<HeroCafe` in `MissionArt.tsx` and calls it drawn. So the components are on
  // this list too, which is the only check in the file that would have caught
  // the chain from either end.
  //
  // And `Art`, the watercolour renderer, which revamp B (F599) retired with
  // the PNGs it drew: the flat drawings reach a screen through `Illustration`,
  // and a second renderer beside it is the same coin toss again.
  const RETIRED = [
    'Chip', 'Bloom', 'OffTheHook', 'TodayRow', 'PhrasebookCard',
    'RecapPostcard', 'OnboardCake', 'NothingDue', 'Phrasebook',
    'MissionDisc', 'MissionArt',
    'HeroCafe', 'StreetCorner', 'MarketStall', 'FrontDesk', 'EveningIn',
    'Art',
  ];

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
    // Revamp B retired the last pen scene with the unreachable leaderboard.
    // An empty barrel is valid only when no runtime caller still imports it.
    if (exported.length === 0) {
      const callers = SOURCES.filter(({ body }) => /import(?!\s+type\b)[^;]*from ['"][^'"]*illustrations(?:\.tsx|\/index\.ts)['"]/.test(body));
      assert.deepEqual(callers.map(({ path }) => rel(path)), [], 'a caller still expects a retired runtime illustration');
    }
    // The barrel and the one-line shim in front of it re-export every name they
    // carry, so a file that only passes a scene along is not a file that draws
    // one. Counting them made this test unfalsifiable: every export reached
    // itself through its own export list.
    const RESELLING = ['illustrations/index.ts', 'illustrations.tsx'];
    for (const name of exported) {
      // Anywhere but the file that defines it. Some of these are building
      // blocks the other scenes draw with rather than scenes a screen draws.
      const definer = SOURCES.find(({ body }) =>
        new RegExp(`export (function|const) ${name}\\b`).test(body),
      )?.path;
      // Three ways a scene is reached, and no fourth. Drawn as an element,
      // where the character after the name has to be whitespace, a slash or the
      // close: `<Phrasebook\b` also matches `Pick<Phrasebook, 'count'>`, which
      // is a type in a module that draws nothing, and that one false positive
      // kept a retired room in the barrel for a whole pass. Called, because the
      // barrel carries hooks and helpers too. Or handed on as a value, which is
      // how `TutorIntro` reaches two of them: `art: OnboardWave,` draws it just
      // as surely as a tag does, and a test that missed that would have asked
      // for a live scene to be deleted.
      const reached = SOURCES.some(
        ({ path, body }) =>
          path !== definer &&
          !RESELLING.some((resold) => rel(path) === resold) &&
          (new RegExp(`<${name}[\\s/>]`).test(body) ||
            new RegExp(`\\b${name}\\(`).test(body) ||
            new RegExp(`[:=,(]\\s*${name}\\s*[,;)\\]}]`).test(body)),
      );
      assert.ok(reached, `${name} is exported by the illustration barrel and reached from nowhere`);
    }
  });

  test('every flat drawing reaches a screen or is on the not-yet-drawn list, which only shrinks', () => {
    // The same promise as the walk above, for the drawings revamp B (F599)
    // generated from ILLUSTRATIONS.md. `art/registry.test.ts` holds the
    // files themselves (generated, decorative, still, token-coloured); this is
    // the side that matters to a learner: a drawing that ships and reaches no
    // screen is weight nobody sees.
    //
    // A name is reached one of two ways. Drawn by name at a call site, as
    // `<Illustration name="state-offline"` or `name={'state-offline'}`. Or it
    // is a scene's drawing in `art/flat/scenes.ts`, and some screen asks that
    // map with `sceneIllustration(`, which is how the place drawings arrive:
    // the map is only a way in if somebody reads it.
    const flat = (path: string) => rel(path).startsWith('art/flat/');
    const names = [...named('art/flat/index.ts').matchAll(/^ {2}'([a-z][a-z0-9-]*)': \{ draw: /gm)].map((m) => m[1]!);
    assert.equal(names.length, 29, 'the flat registry no longer names the 23 Round 1 drawings, so this test is reading the wrong thing');

    const sceneMapRead = SOURCES.some(({ path, body }) => !flat(path) && /\bsceneIllustration\(/.test(body));
    const byScene = new Set([...named('art/flat/scenes.ts').matchAll(/:\s*'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]!));
    const postcardRead = SOURCES.some(({path,body}) => !flat(path) && /\bpostcardIllustration\(/.test(body));
    const byPostcard = new Set([...named('recap/postcardArt.ts').matchAll(/:\s*'([a-z][a-z0-9-]*)'/g)].map(m=>m[1]!));
    const mouthRead = SOURCES.some(({path,body}) => !flat(path) && /<MouthGuide\b/.test(body));
    const byMouth = new Set([...named('practice/mouthGuide.ts').matchAll(/:\s*'([a-z][a-z0-9-]*)'/g)].map(m=>m[1]!));
    const reached = (name: string) =>
      (mouthRead && byMouth.has(name)) ||
      (postcardRead && byPostcard.has(name)) ||
      (sceneMapRead && byScene.has(name)) ||
      SOURCES.some(
        ({ path, body }) =>
          !flat(path) && new RegExp(`<Illustration\\b[^>]*\\bname=(?:"${name}"|\\{'${name}'\\})`).test(body),
      );

    // Drawn by nothing yet, on purpose: Round 1 converted the whole set before
    // the screens that draw them are rebuilt. Stages 3 and 4 strike a name here
    // in the same change that draws it, and a name drawn but left on the list
    // fails as surely as a name dropped without being drawn, so the list only
    // ever shrinks. It ends empty.
    const UNDRAWN_YET: string[] = [
    ];
    assert.deepEqual(
      names.filter((name) => !reached(name)).sort(),
      [...UNDRAWN_YET].sort(),
      'the drawings no screen reaches are not exactly the not-yet-drawn list: strike a name once a screen draws it, and never add one',
    );
    // The seven place drawings reach a screen today, so none of them may ever
    // go back on the list: a screen that drops one has lost its picture.
    assert.deepEqual(UNDRAWN_YET.filter((name) => name.startsWith('place-')), [], 'a place drawing went back on the not-yet-drawn list');
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
    assert.deepEqual(importers.sort(), ['App.tsx', 'auth/AuthFlow.tsx'], 'the welcome is reached from somewhere other than the auth flow');

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
const FIRST_RUN: readonly { where: string; headings: number; part?: true }[] = [
  // 2026-09-27, Phase 5: six pages (hear it, first line, start level, reason, plan, save), one title each.
  { where: 'onboarding/PreAccountOnboarding.tsx', headings: 2 },
  { where: 'auth/SignUpScreen.tsx', headings: 1 },
  { where: 'auth/SignInScreen.tsx', headings: 1 },
  { where: 'onboarding/OnboardingFlow.tsx', headings: PAGES.length },
  { where: 'tutor/TutorIntro.tsx', headings: 1 },
  // Come alive, first run (README Part 7): the parts PreAccountOnboarding draws
  // its pages from, read as they are added. A part owns no heading (the page's
  // title is the screen's one) and scrolls inside the screen's ScrollScreen, so
  // it carries no scroll container of its own; every other rule holds.
  ...readdirSync(join(SRC, 'onboarding', 'firstRun'))
    .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes('.test.'))
    .map((entry) => ({ where: `onboarding/firstRun/${entry}`, headings: 0, part: true as const })),
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

  test('every first-run screen leads with a heading role and its art is decorative', () => {
    // F585. The heading half is the one above, re-stated here because the
    // ledger names both sentences and a title that a ledger entry is ticked
    // against is not free to move; the art half is what revamp A added.
    //
    // A first run is where somebody decides whether this app is for them, and
    // it is now the place with the most pictures in it. Two things have to hold
    // at once: the first thing a screen reader finds is still a heading, and
    // none of the pictures is a thing it finds at all.
    for (const { where, headings } of FIRST_RUN) {
      const body = named(where);
      assert.equal(
        (body.match(/accessibilityRole="header"/g) ?? []).length,
        headings,
        `${where} marks a different number of its titles as headings than the ${headings} it has`,
      );

      // Every picture on these screens comes through the one renderer, which
      // spreads `decorative` over the box and draws a drawing that spreads it
      // again. A screen that drew its own would be an unlabelled "image"
      // announced before the heading above. Revamp B (F599): the renderer is
      // `Illustration` now, and the watercolour one it replaced is retired.
      assert.doesNotMatch(body, /<(Art|HeaderArt)\b/, `${where} draws a retired watercolour`);
      const pictures = (body.match(/<Illustration\b/g) ?? []).length;
      if (pictures > 0) {
        assert.match(
          body,
          /import \{ Illustration \} from '\.\.\/art\/flat\/Illustration\.tsx'/,
          `${where} draws a picture that does not come from the one illustration renderer`,
        );
      }
    }
    const renderer = named('art/flat/Illustration.tsx');
    for (const promise of ['{...decorative}', "pointerEvents: 'none'"]) {
      assert.ok(renderer.includes(promise), `art/flat/Illustration.tsx no longer draws with ${promise}, so every first-run picture is announced or takes a touch`);
    }

    // And the vector scenes the raster replaced are gone from the first run,
    // with one exception pinned by name rather than waved through: the tutor
    // intro still hands two authored drawings to its page model, and that is a
    // deliberate keep, not a screen that was missed. A third would fail here.
    for (const where of ['onboarding/PreAccountOnboarding.tsx', 'onboarding/OnboardingFlow.tsx', 'auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx']) {
      assert.doesNotMatch(
        named(where),
        /from '(\.\.\/)+illustrations/,
        `${where} draws a vector scene as well as the registered picture, so two drawings answer for one page`,
      );
    }
    // 2026-09-27, Phase 4 (B1): the tutor intro's clip-art left with the notebook redesign; it keeps the
    // orb-colour teaching and draws no authored scene at all, so any illustrations import is a regression.
    assert.doesNotMatch(
      named('tutor/TutorIntro.tsx'),
      /from '(\.\.\/)+illustrations/,
      'the tutor intro draws a clip-art scene again; the orb is its only picture',
    );
  });

  test('no first-run screen caps font scaling', () => {
    for (const { where, part } of FIRST_RUN) {
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
      // scroll container too — the frame's ScrollView — so it counts. A part
      // is drawn inside its screen's, which this list holds above.
      if (!part) {
        assert.match(
          body,
          /<Scroll(View|Screen)\b/,
          `${where} has no scroll container, so text that grows has nowhere to go`,
        );
      }
    }
  });

  test('no first-run control opts out of the keyboard', () => {
    for (const { where } of FIRST_RUN) {
      const body = named(where);
      for (const [pattern, complaint] of [
        [/focusable\s*[=:]\s*\{?\s*false/, 'takes a control out of the focus order'],
        [/<(?:Press|Pressable|TextInput|Button)\b[^>]*tabIndex\s*[=:]\s*\{?\s*-\s*\d/, 'gives a control a negative tabIndex'],
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
  // Ceiling: this reads the tabs as text. It cannot prove a second tap did
  // nothing on a device; it proves the guard and the acknowledgement are inside
  // every handler that fires the probe, which is where they were missing.
  //
  // The list used to be two handlers on PracticeTab, named there. Both left
  // with the authored path in F442: the lesson row is a door on Tutor now, and
  // "talk about it again" became the suggestion card's tutor door. The rule did
  // not leave with them, so the test follows the behaviour rather than the file
  // it used to live in, and a new probing handler joins this table or it is not
  // covered.
  //
  // Revamp A moved two more. The suggestion card went with the opening card and
  // the walk store, so `talkAbout` has no screen left; and the pronunciation
  // lesson left the Tutor tab for the chooser's footer, where `openLesson`
  // carries the same guard under a different name. The rule is what travels,
  // not the handler: a probing handler that is not in this table is a tap that
  // can be doubled and nothing would say so.
  const PROBING = [
    ['the tutor tab\'s doors', 'tabs/TutorTab.tsx', 'const open = ('],
    ['the mission hero\'s start', 'home/MissionHero.tsx', 'const open = ('],
    ['the real moment\'s start', 'tutor/RealMomentScreen.tsx', 'const open = ('],
    ['the first conversation', 'tabs/PracticeTab.tsx', 'const startFirst = ('],
    ['the chooser\'s pronunciation lesson', 'missions/MissionsScreen.tsx', 'const openLesson = ('],
    // 2026-09-27, Phase 3: day one on Practice leads with the "bonjour" sound lesson, a live-capable door.
    ['Practice\'s day-one sound lesson', 'tabs/PracticeTab.tsx', 'const openLesson = ('],
  ] as const;

  const bodyOf = (file: string, opens: string): string => {
    const source = named(file);
    const from = source.indexOf(opens);
    assert.notEqual(from, -1, `${opens} is gone from ${file}; this test is stale`);
    const to = source.indexOf('\n  };\n', from);
    assert.notEqual(to, -1, `${opens} no longer closes at component level in ${file}`);
    return source.slice(from, to);
  };

  test('a tap during the probe is acknowledged and never doubled', () => {
    // Both call sites once fired recheck() with no flag at all, so for up to a
    // second and a half the tap did nothing visible and a second tap queued a
    // second navigation.
    for (const [name, file, opens] of PROBING) {
      const body = bodyOf(file, opens);
      assert.match(body, /recheck\(\)/, `${name} no longer probes, so this test is stale`);
      const guard = file === 'tabs/PracticeTab.tsx' ? /if \(checking \|\| !ownsReadNow\(\)\) return;/ : /if \(checking\) return;/;
      assert.match(body, guard, `${name} lets a second tap or a stale account queue navigation`);
      assert.match(body, /setChecking\(false\)/, `${name} never lets go, so one probe disables the tab for good`);
    }

    // The acknowledgement itself, in the gate's own words rather than a second
    // vocabulary for the same wait.
    for (const [, file] of PROBING) {
      const source = named(file);
      assert.match(source, /TUTOR_OFFLINE/, `${file} writes its own word for checking instead of the gate's`);
      assert.match(source, /\{TUTOR_OFFLINE\.checking\}/, `nothing on ${file} says a probe is running`);
      assert.match(
        source,
        // Practice also gates the receipt by the owner of the read, so the
        // previous account's pending probe cannot speak on a new account.
        file === 'tabs/PracticeTab.tsx'
          ? /\{ownerMatches && checking && \(?\s*<Text[\s\S]{0,240}accessibilityLiveRegion="polite"[\s\S]{0,240}TUTOR_OFFLINE\.checking/
          : /\{checking && \(?\s*<Text[\s\S]{0,240}accessibilityLiveRegion="polite"[\s\S]{0,240}TUTOR_OFFLINE\.checking/,
        `${file}'s acknowledgement is either not a live region or not tied to the flag, so it is invisible to a screen reader or never goes away`,
      );
    }
  });

  test('the quiet door for a learner who cannot speak is still on the Tutor tab', () => {
    // It used to be drawn twice, on Practice and on Tutor. Practice's copy left
    // with the lesson it opened; this is the assertion that the remaining one
    // did not leave with it, because it is the way out for a learner who cannot
    // speak aloud right now and there is no second one.
    // Notebook redesign (2026-09-27, Phase 3): the Speak/Type toggle became one
    // Start in the learner's standing mode and a quiet link to the other one.
    // For a speaker that link is "Type instead"; for a typist the Start itself
    // types. Either way a learner who cannot speak aloud has a way through, and
    // both halves are pinned: the drawn link and the mode model behind it.
    const tutor = named('tabs/TutorTab.tsx');
    assert.match(tutor, /const modes = startModes\(prefersTyping\(/, 'Speak no longer reads the learner\'s standing typing choice');
    assert.match(
      named('home/MissionHero.tsx'),
      /<GhostButton label=\{modes\.other\.label\}[^>]*onPress=\{\(\) => open\(modes\.other\.textMode\)\}/,
      'the quiet door is gone, and a learner who cannot speak aloud has no way through',
    );
    assert.deepEqual(
      [startModes(false).other, startModes(true).textMode],
      [{ label: 'Type instead', textMode: true }, true],
      'a speaker is not offered typing, or a typist does not start typing',
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
    for (const [name, file, opens] of PROBING) {
      const body = bodyOf(file, opens);
      const guard = file === 'tabs/PracticeTab.tsx' ? 'if (checking || !ownsReadNow()) return;' : 'if (checking) return;';
      assert.ok(
        body.includes('setChecking(true)'),
        `${name} never raises the checking flag, so the tap it starts says nothing for as long as the probe runs`,
      );
      assert.ok(body.includes('recheck()'), `${name} no longer probes, so this test is stale`);
      writtenBefore(
        body,
        guard,
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
    // F628. Revamp B: the opacity flash went, and the ghost presses through the
    // spring. The disabled flag reaches that one Press, and a disabled Pressable
    // never fires onPressIn, so a disabled ghost neither shrinks nor flashes.
    assert.match(ghost, /<Press haptic="light"[^>]*disabled=\{disabled\}/, 'a disabled GhostButton still springs when pressed');
    assert.match(ghost, /disabled \? paper\.inkSoft : color/, 'a disabled GhostButton looks live');
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
  // F473: the account, the documents and the phone's permissions left Profile
  // for one pushed screen, and the two legal documents got screens of their own.
  // All three take the frame from the day they are written, so none of them
  // re-derives a safe area or opens a ScrollView the way the screens above had
  // to be walked back from.
  'settings/SettingsScreen.tsx',
  'legal/PolicyScreen.tsx',
  'legal/TermsScreen.tsx',
  // Pass 3: the first run adopts the frame too (F352, F357).
  'onboarding/PreAccountOnboarding.tsx',
  'onboarding/AgeGateScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
  'auth/SignUpScreen.tsx',
  'auth/SignInScreen.tsx',
  // The subscription wall takes the frame from the day it is written, the way
  // the settings screens did, rather than being walked back from a safe area it
  // measured itself.
  'wall/WallScreen.tsx',
  // F548: the real moment takes the frame from the day it is written.
  'tutor/RealMomentScreen.tsx',
  // Revamp A: three sections that were half a tab each became routes of their
  // own (F572, F574, F575). All three take the frame from the day they are
  // written, so none of them has a safe area to be walked back from.
  'conversationPacks/ConversationsScreen.tsx',
  // Whole-app upgrade Stage 4 (2026-09-25): the sound journey and the goal
  // screen are new pushed routes, held to the frame from the day they land.
  'soundcheck/SoundJourneyScreen.tsx',
  'goals/GoalStepScreen.tsx',
  // 2026-09-27, Phase 5: the first scene's microphone primer, pushed over Today on a first run.
  'onboarding/FirstSceneScreen.tsx',
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
  'components.tsx', // Sheet's native Modal is outside its caller's frame and owns its inset.
  'ConvoScreen.tsx',
  'RecapScreen.tsx',
  'drill/FocusDrillPlayer.tsx',
  'auth/SetNewPasswordScreen.tsx',
  'friends/AddFriendsScreen.tsx',
];

/**
 * The only files that may still draw a chevron by hand. `components.tsx` draws
 * the one every adopted screen now borrows; the rest are the not-yet-adopted
 * friends screen. The auth and onboarding screens gave theirs up in Pass 3.
 */
const CHEVRON_ALLOW = [
  // F629. Revamp B: RoundButton's back mark, which ScreenHeader draws. The
  // frame's header no longer lays out a chevron of its own.
  'components.tsx',
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
    'tutor/RealMomentScreen.tsx',
    // Revamp A's three routes. Each is a chevron and a title, and each is the
    // only way back out of a place that used to be reachable by scrolling.
    'conversationPacks/ConversationsScreen.tsx',
    // Stage 4 (2026-09-25): both new routes are pushed, with one way back.
    'soundcheck/SoundJourneyScreen.tsx',
    'goals/GoalStepScreen.tsx',
    'onboarding/FirstSceneScreen.tsx',
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
    assert.equal(
      (named('SessionView.tsx').match(/<LiveRoomHeader\b/g) ?? []).length,
      1,
      'the lesson surface lost the one compact end-session header reserved for a live room',
    );
    // No adopter hand-rolls a back control beside the shared header.
    for (const name of ADOPTERS) {
      const body = named(name);
      assert.ok(!body.includes('<ChevronLeft'), `${name} hand-rolls a chevron instead of using the shared header`);
      assert.ok(
        !body.includes('accessibilityLabel="Back"'),
        `${name} builds its own Back pressable instead of routing through the shared header`,
      );
      // F629. The round back is a public part now, and it carries its own
      // chevron and its own default Back, so neither check above sees it. Only
      // ScreenHeader draws it; a screen that draws one too has two ways back.
      const roundBacks = tags(body, 'RoundButton').filter((tag) => /\bkind=(?:"back"|\{\s*['"]back['"]\s*\})/.test(tag));
      assert.equal(
        roundBacks.length,
        0,
        `${name} draws its own round back beside the shared header, so the screen has two ways back: ${roundBacks.join(' ')}`,
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

  test('every pushed screen keeps its way out and its one primary after the restyle', () => {
    // F584. Revamp A restyled every screen the founder's mockup does not show,
    // and the one thing a restyle takes away without anybody noticing is the
    // way out: a header replaced by a serif title, a chevron folded into a card
    // that was later deleted. So the whole set is walked at once rather than
    // screen by screen, and both halves are pinned exactly.
    //
    // One `ScreenHeader` each, which is the rule F309 already holds; and at most
    // one primary pill, because a pushed screen is one thing to do. The drill is
    // the single exception and it is pinned at its number rather than excused:
    // six pills across six mutually exclusive branches, of which a learner ever
    // sees one — the two Checks, "I said it", and a Done on each of the three
    // terminal cards.
    const BRANCHED: Record<string, number> = { 'DrillScreen.tsx': 6 };
    // The two auth screens are the other pinned case. They are one thing to do,
    // have an account, and revamp B's approved board (F601) draws two provider
    // doors above the form: Apple's ink pill, only where the platform offers it,
    // and Google's white one. A door is a way to that same one thing, not a
    // second thing, so it is set aside by the mark it carries and the screen is
    // still allowed one primary: the form's own pill, which the F357 test below
    // holds in the footer. The doors are pinned at exactly two, so a third door,
    // or a pill that is not a door, still counts against the one.
    const DOORS = ['auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx'];
    const isDoor = (tag: string) => /\bicon=\{\s*<(?:AppleMark|GoogleMark)\b/.test(tag);
    for (const name of PUSHED_ONE_BACK) {
      const body = named(name);
      assert.equal(
        (body.match(/<ScreenHeader\b/g) ?? []).length,
        1,
        `${name} lost its one way out in the restyle, or grew a second`,
      );
      const all = tags(body, 'PillButton');
      const doors = DOORS.includes(name) ? all.filter(isDoor) : [];
      if (DOORS.includes(name)) {
        assert.equal(doors.length, 2, `${name} draws ${doors.length} provider doors; it draws Apple and Google, and nothing else`);
      }
      const pills = all.length - doors.length;
      const allowed = BRANCHED[name] ?? 1;
      assert.ok(
        pills <= allowed,
        `${name} draws ${pills} primary pills; a pushed screen is one thing to do, so it is allowed ${allowed}`,
      );
    }
    assert.equal(
      (named('SessionView.tsx').match(/<LiveRoomHeader\b/g) ?? []).length,
      1,
      'the lesson surface lost its one way out in the restyle, or grew a second',
    );
    // And the three routes revamp A added are in that set rather than beside
    // it, so a screen that was written this round is held to the same rule as
    // one that was walked back onto the frame.
    for (const name of ['phrases/PhrasebookScreen.tsx', 'conversationPacks/ConversationsScreen.tsx']) {
      assert.ok(PUSHED_ONE_BACK.includes(name), `${name} is a pushed route and nothing holds it to having one way back`);
    }
  });

  test('the end card and the mock lesson have a way out — F309', () => {
    // These three were the dead ends: the summary end card had no back, the
    // session surface's exit was hand-rolled, and the mock lesson had no exit
    // at all. Now the card gets a chevron, the surface gets the live-room end,
    // and the mock passes its exit straight through.
    assert.match(named('SummaryScreen.tsx'), /<ScreenHeader\s+back=/, 'the end card has no way back');
    assert.match(
      named('SessionView.tsx'),
      /<LiveRoomHeader[\s\S]{0,120}onEnd=\{props\.onLeave\}/,
      'the session surface has no end-session control',
    );
    // Leading slash so this reads the mock driver and not LiveSessionScreen,
    // whose filename also ends with "SessionScreen.tsx".
    assert.match(named('/SessionScreen.tsx'), /onLeave=\{onExit\}/, 'the mock lesson never wires its exit to the surface Leave');
  });
});

describe('the hardware back button is answered in place — F312', () => {
  /**
   * Every sub-view that opens in place rather than as a stack route.
   *
   * The phrasebook left this list with revamp A and it left by being fixed: it
   * is a pushed route now with the shared header's own back, so there is no
   * sub-view for a hardware press to close. Conversations took its place, and
   * for the reason this list exists: the pack library opens over the feed
   * without a push, so Android's back has to close the library rather than the
   * screen under it.
   */
  const IN_PLACE = [
    'conversationPacks/ConversationsScreen.tsx',
    'tutor/TutorIntro.tsx',
    'legal/Acknowledgements.tsx',
    'tabs/ProfileTab.tsx',
    'SummaryScreen.tsx',
    // F473. Settings opens the delete confirmation and the export failure in
    // place, and the two document screens are opened in place by Settings and
    // answer the press themselves so two handlers never race (F319).
    'settings/SettingsScreen.tsx',
    'legal/PolicyScreen.tsx',
    'legal/TermsScreen.tsx',
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

describe('the tab bar shows a word, and it is a grounded dock — F313', () => {
  const tabbar = named('nav/LuvaniTabBar.tsx');

  test('every tab cell shows its label, and the label scales and wraps rather than truncating — F313', () => {
    assert.match(tabbar, /<Text\b/, 'the tab cell renders no text at all');
    assert.match(tabbar, /\{label\}/, 'the tab cell does not render its own label');
    for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!tabbar.includes(cap), `the tab bar caps its label with ${cap}; a long word must wrap and the bar grow to hold it`);
    }
  });

  test('the active tab is told by the brand blue and weight 700, and a screen reader still hears selected — F313', () => {
    assert.match(tabbar, /accessibilityState=\{\{\s*selected/, 'a screen reader is not told which tab is selected');
    // 2026-09-30, revamp B (F600): the heavier weight is Outfit Bold, 700,
    // beside the brand blue, over the tab label token's SemiBold.
    assert.match(tabbar, /fontFamily: font\.bold/, 'the active tab is not marked by the heavier weight, Outfit Bold');
    assert.ok(!/\bst\.dot\b/.test(tabbar) && !tabbar.includes('dotActive'), 'the tab bar still marks the active cell with a dot');
  });

  test('the bar is white with a top hairline, and never a floating shadow — F313', () => {
    // 2026-09-27, notebook Phase 1: the inset dock becomes a flat bar, per the
    // design contract. The floating rules are kept whole and the dock's own
    // corner, margin and ink outline are refused alongside them. 2026-09-30,
    // revamp B (F600): the bar is SNIPPETS' white, over the one hairline.
    const from = tabbar.indexOf('bar: {');
    assert.notEqual(from, -1, 'the bar style is gone; this test is reading the wrong thing');
    const barStyle = tabbar.slice(from, tabbar.indexOf('},', from) + 1);
    assert.match(barStyle, /backgroundColor: paper\.card/, 'the bar is not the opaque white surface of its own');
    assert.match(barStyle, /borderTopWidth: HAIRLINE/, 'the bar has no rule separating it from the page');
    assert.match(barStyle, /borderTopColor: paper\.line/, 'the rule is not the paper hairline');
    for (const floating of ['shadowOpacity', 'shadowRadius', 'elevation', "position: 'absolute'", 'borderRadius', 'marginHorizontal', 'borderColor: paper.ink']) {
      assert.ok(!barStyle.includes(floating), `the bar carries ${floating}, so it is a dock or it competes with the content`);
    }
  });

  test('the design doc no longer calls the tabs icon-only — F313', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    assert.ok(!/icon-only/i.test(design), 'DESIGN.md still describes an icon-only tab bar that no screen renders');
  });
});

describe('the active tab wears the brand blue — F325', () => {
  const tabbar = named('nav/LuvaniTabBar.tsx');

  test('the active tab is set in the brand blue, and the rest in soft ink', () => {
    // 2026-09-30, revamp B (F600). The identity colour on the bar was the ink
    // for a whole redesign; SNIPPETS gives the selected tab the brand blue,
    // glyph and word together, at Outfit Bold. The rest are soft ink, glyph and
    // word alike, because a word is held to the text floor (6.6 on white) and
    // faint ink is now only an alias of it. The same three pins as
    // nav/tabBar.test.ts, read here with the rest of the surface.
    assert.match(
      tabbar,
      /color=\{focused \? accent\.brand : paper\.inkSoft\}/,
      'the active tab glyph is not the brand blue, or the inactive one is not soft ink',
    );
    assert.match(
      tabbar,
      /focused \? \{ color: accent\.brand, fontFamily: font\.bold \}/,
      'the active tab label is not the brand blue at the heavier weight, Outfit Bold',
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
      /header=\{!noCheck && shownPhase !== 'result' \?/,
      'the sound-check chevron is not gated off the terminal cards, so a terminal card shows two doors',
    );
  });

  test('every room exit tells a screen reader what it ends or leaves — F318', () => {
    // "Leave, button" with no object is what a screen reader heard on every
    // metered screen. Both header variants now take a room-specific accessible
    // label, so each caller names what it ends or leaves.
    const layout = stripComments(readFileSync(join(SRC, 'layout.tsx'), 'utf8'));
    assert.match(
      layout,
      /accessibilityLabel=\{leave\.accessibilityLabel \?\? leave\.label\}/,
      'the shared header ignores a leave accessibilityLabel',
    );
    for (const [file, phrase, spelling] of [
      ['SessionView.tsx', 'End lesson', `accessibilityLabel="End lesson"`],
      ['ConvoScreen.tsx', 'End conversation', `accessibilityLabel="End conversation"`],
      ['ReviewScreen.tsx', 'Leave the review', `accessibilityLabel: 'Leave the review'`],
      ['DrillScreen.tsx', 'Leave the drills', `accessibilityLabel: 'Leave the drills'`],
    ] as const) {
      const src = stripComments(readFileSync(join(SRC, file), 'utf8'));
      assert.ok(
        src.includes(spelling),
        `${file} exposes its room exit without the object named in "${phrase}"`,
      );
    }
  });

  /**
   * F319's rule, now on two screens, and one expression each.
   *
   * A sheet that renders a whole screen of its own carries its own
   * `useHardwareBack`, so the screen that opened it must stand its own hook
   * down for exactly that sheet. Two handlers on one press race, and the loser
   * closes the wrong thing: the sub-view's back closes the sheet from page two
   * instead of turning a page.
   *
   * It is one assertion per screen rather than one shared regex, because the
   * exclusion list is different on each and the whole point is that it names
   * every self-answering sheet. A shared pattern would pass on a screen that
   * had grown a sixth sheet and forgotten it.
   *
   * F473 moved three sheets from Profile to Settings, which is why Profile now
   * excludes only the intro. Both expressions are checked in full, so a sheet
   * added to either without its exclusion fails here rather than on a phone.
   */
  test('a Profile sheet that answers back itself is not answered twice — F319', () => {
    // Revamp A left Profile with two sheets and neither answers for itself: the
    // name sheet and the voice sheet are both drawn by this file, so this file
    // answers the press for both and the exclusion list is empty. The intro
    // went to Settings' Help group with the acknowledgements that left in F473,
    // which is why the union is pinned as well as the hook: a third sheet added
    // here without a thought about the hardware back would change the union
    // first.
    const profile = stripComments(readFileSync(join(SRC, 'tabs', 'ProfileTab.tsx'), 'utf8'));
    assert.match(
      profile,
      /type Sheet = 'none' \| 'name' \| 'tutorVoice';/,
      'Profile draws a sheet this check has never seen; say whether it answers its own back press',
    );
    assert.match(
      profile,
      /useHardwareBack\(sheet !== 'none', closeCurrentSheet\)/,
      "ProfileTab's hardware back no longer answers for every sheet it draws itself",
    );
    for (const gone of ['acknowledgements', 'intro']) {
      assert.ok(
        !profile.includes(`sheet === '${gone}'`),
        `the ${gone} sheet is still drawn on Profile as well as on Settings`,
      );
    }

    // Settings holds four that answer for themselves: the acknowledgements, the
    // privacy notice, the terms and the tutor intro. Its own hook is for the
    // delete confirmation, the reminder time and the export failure, which are
    // drawn in place.
    const settings = stripComments(readFileSync(join(SRC, 'settings', 'SettingsScreen.tsx'), 'utf8'));
    assert.match(
      settings,
      /useHardwareBack\(\s*sheet !== 'none' &&\s*sheet !== 'acknowledgements' &&\s*sheet !== 'policy' &&\s*sheet !== 'terms' &&\s*sheet !== 'intro',/,
      "SettingsScreen's hardware back also fires for the four sheets that answer it themselves",
    );
    for (const own of ['acknowledgements', 'policy', 'terms', 'intro']) {
      assert.ok(
        settings.includes(`if (sheet === '${own}')`),
        `Settings names no ${own} sheet, so the exclusion above stands down for something that is not there`,
      );
    }
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
    assert.doesNotMatch(view, /<LineBullet\b/, 'support is explained in words instead of numbered levels');
    assert.match(view, /rungLabel\(rung/, 'SessionView no longer names the rung in words');
  });
});

describe('faint ink is a mark, not a word — F330, F338', () => {
  // A drawn glyph the faint ink is allowed to colour: an icon, a spinner, an
  // inactive tab mark. Words a learner reads never travel in it. `ChevronRight`
  // joined with revamp A: the tinted row and the white icon row both end in one,
  // and a chevron is a mark that says "this opens", never a line to read.
  const GLYPH = /<(ArrowRight|EarGlyph|MicGlyph|ChevronLeft|ChevronRight|HelpGlyph|GoogleMark|ActivityIndicator|Icon)\b/;
  // The exact off-control expressions faint ink may still letter: a disabled
  // ghost, a muted mic, an inactive bullet numeral, a used token, a locked row's
  // title. Nothing else. Normalised to single spaces.
  //
  // The empty draft's Send left this set with revamp A, and it left because it
  // stopped being an off control: the typed row's Send is a filled violet
  // control with `paper.onInk` on it now, live or not. An allowance that
  // matches no line in the app permits nothing, so it is removed rather than
  // kept as a comfort, and a Send that goes back to faint ink fails here.
  const OFF_CONTROL = new Set([
    '<Text style={[type.bodyStrong, { color: disabled ? paper.inkFaint : color }]}>{label}</Text>',
    'const iconColor = muted ? paper.inkFaint : paper.ink;',
    'color: active ? (rung === 4 ? paper.onInk : paper.ink) : paper.inkFaint,',
    '<Text style={[type.french, { color: used ? paper.inkFaint : paper.ink }]}>{token}</Text>',
    '<Text style={[type.bodyStrong, { color: locked ? paper.inkFaint : paper.ink }]}>{node.title}</Text>',
    // The three mid-session controls that are turned off while the tutor holds
    // the floor. They are off controls in exactly the sense this allow-set is
    // for, and the fourth and fifth in that row are deliberately NOT here,
    // because "Give me a moment" and "Type your reply instead" stay live: they
    // are the two ways out of a turn that is going badly.
    '<Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>Help me out</Text>',
    // 2026-09-27, Phase 4 (B1): "Slower" is labelled "Simpler", which is what it does; the wire tag is unchanged.
    '<Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>Simpler</Text>',
    '<Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>In English</Text>',
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
      const expectedHeaders = name === 'tabs/TutorTab.tsx' ? 2 : 1;
      assert.equal(
        (body.match(/<TabHeader\b/g) ?? []).length,
        expectedHeaders,
        `${name} lacks the header in a reachable render branch`,
      );
      if (name === 'tabs/TutorTab.tsx') {
        assert.match(body, /if \(renderHistoryStatus !== 'ready'\) return <ScrollScreen/, 'Speak must have a separate loading and unread branch');
        assert.match(body, /<TabHeader title=\{tutorHeading\(tutorName\)\}/g, 'Speak must name its tutor in both render branches');
      }
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
   * Every tab says what it is for, and Home's changes with the hour.
   *
   * Home was the one exception for four passes: the greeting alone, and a rule
   * naming it as the single tab allowed to carry no purpose line. Revamp A
   * ended the exception rather than widening it. Home's line is the hour's
   * question, "Ready to speak French this evening?", which is not the app
   * explaining the screen — it is the one sentence that changes with the time
   * of day, and it is the thing the greeting above it is greeting somebody
   * into.
   *
   * So Home is pinned harder than the other four rather than let off: its
   * purpose has to be `greeting.subline` and may never be a literal, because a
   * sentence typed into the tab is a sentence that stops changing with the hour
   * and no test would see it stop.
   */
  test("every tab says what it is for in one line, and Home's is the hour's", () => {
    assert.match(
      named('tabs/HomeTab.tsx'),
      /purpose=\{greeting\.subline\}/,
      "Home's purpose line is not the hour's own sentence from useGreetingRotation",
    );
    assert.doesNotMatch(
      named('tabs/HomeTab.tsx'),
      /purpose="/,
      'Home spells its purpose line itself, so it says the same thing at seven in the morning and at midnight',
    );
    for (const name of TABS.filter((t) => t !== 'tabs/HomeTab.tsx')) {
      const body = named(name);
      // A quoted literal, a template, or a constant read from a `.ts` — the
      // Tutor tab reads TUTOR_PURPOSE, which is where its words belong.
      const m = /purpose=(?:"([^"]*)"|\{`([^`]*)`\}|\{([A-Za-z_]+(?: \? [A-Za-z_]+ : [A-Za-z_]+)?)\})/.exec(body);
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
    // F364 turned the three doors into cards that say what is behind them, and
    // revamp A turned the cards into the shared tinted row: the circle above is
    // the tab's one primary, so a door is a row that opens something rather
    // than a card with a button in it. The rule this test has always held is
    // unchanged — the tutor draws the app's components and hand-rolls nothing —
    // and it is read off what is actually there.
    // Notebook redesign (2026-09-27, Phase 3): the tinted rows became the
    // ledger. Speak leads with the tutor card and the level path, and its other
    // ways in sit under "More ways to practise", drawn one way. The rule is the
    // same: the tutor draws the app's components and hand-rolls nothing.
    const tutor = named('tabs/TutorTab.tsx');
    const ways = tutor.slice(tutor.indexOf('MORE_WAYS.map('), tutor.indexOf('))}', tutor.indexOf('MORE_WAYS.map(')));
    assert.ok(ways.length > 0, 'the tutor no longer maps its other ways in');
    assert.match(ways, /<LedgerRow\b/, 'a way in is not drawn as the shared ledger row');
    assert.doesNotMatch(ways, /<Pressable\b/, 'a way in is hand-rolled as a Pressable instead of the shared row');
    assert.equal((ways.match(/<LedgerRow\b/g) ?? []).length, 1, 'the ways in are drawn more than one way, so two rows could drift apart');
    assert.match(ways, /way\.title/, 'a way in names itself instead of reading its words from the model');
    assert.match(ways, /way\.gloss/, 'the ways in lost their gloss line');

    // The ways in are the model's, not typed here: gate.ts's doors minus the
    // everyday door (the level path is that door now), plus what the tutor
    // remembers. A new way in is a model entry, not a row bolted on here.
    const keys = [...named('tutor/gate.ts').matchAll(/\{ key: '(\w+)', label: '/g)].map((m) => m[1]!);
    assert.deepEqual(keys, ['everyday', 'free', 'rehearse'], 'gate.ts no longer offers exactly the three ways in');
    assert.deepEqual(MORE_WAYS.map((way) => way.key), ['free', 'rehearse', 'memory'], 'the other ways in on Speak drifted from the model');

    // The scenes are on this tab on purpose now: the level path is the spine.
    // They come from the path model, never from a hand-typed catalogue list.
    // 2026-09-27, Phase 4 (B1): the path is drawn once, as the scene rows, so
    // Speak reads the model and draws no second LevelPath above them.
    assert.match(tutor, /speakPath\(progress\)/, 'Speak no longer reads its rows from the path model');
    assert.doesNotMatch(tutor, /<LevelPath\b/, 'Speak draws the path twice again, as a LevelPath above the rows');
    assert.doesNotMatch(tutor, /MISSIONS\.map\(/, 'Speak lists the catalogue by hand instead of reading the level path');
    assert.doesNotMatch(tutor, /DOOR_TINT|<TintRow\b/, 'Speak paints a way in with a place tint again');
    assert.doesNotMatch(tutor, /st\.door\b/, 'the tutor still draws a bespoke card-button for its quiet doors');
  });
});

describe('the frame owns the tab gaps and growth — F340, F594', () => {
  test('no tab pads its own scroll; the header gap and the bottom air come from the frame', () => {
    for (const name of TABS) {
      const body = named(name);
      const m = /scroll:\s*\{([^}]*)\}/.exec(body);
      if (m) {
        const scroll = m[1]!;
        assert.doesNotMatch(scroll, /padding/, `${name}'s scroll style pads itself instead of leaving the gaps to the frame`);
      }
      assert.ok(
        !/paddingBottom/.test(body),
        `${name} writes paddingBottom somewhere; the frame owns the air above the tab bar`,
      );
    }
  });

  test('no tab hangs a growing wrapper inside the scroll frame — F594', () => {
    // ScrollScreen already owns the growing content container. A second
    // flexGrow wrapper swallowed everything below the header at AX5 on My
    // French and the same shape remained on four tabs after that repair.
    for (const name of TABS) {
      const body = named(name);
      const m = /scroll:\s*\{([^}]*)\}/.exec(body);
      if (m) {
        assert.doesNotMatch(m[1]!, /flexGrow/, `${name} grows a wrapper inside the growing frame and can swallow its own body at AX5`);
      }
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
   * Every file a tab draws, per tab, because a count read off the tab alone is
   * a count that moves the moment a section becomes a card.
   *
   * That is not hypothetical: Home's one pill moved into a card in F406 and
   * counting `tabs/HomeTab.tsx` would have read zero and passed while the card
   * grew a second. Revamp A moved four more sections out the same way, so the
   * surfaces are listed per tab and both counts are taken over the whole tab.
   */
  // 2026-09-27, Phase 3: each tab's own surfaces as it imports them today. Home no longer draws
  // AbilitiesCard; My French draws its phrase bank and sounds map instead of SituationsCard. The row test
  // below fails if a listed file stops being drawn, so this list cannot go stale silently.
  // 2026-10-07, come alive Phase 4: the game cards each tab now draws, every one
  // with no pill of its own and no ledger row (README Part 7, Surfaces).
  const SURFACES: Record<string, readonly string[]> = {
    'tabs/HomeTab.tsx': ['tabs/HomeTab.tsx', 'practice/NextTaskCard.tsx', 'game/TodayHero.tsx', 'game/QuestsCard.tsx', 'daily/DailyCard.tsx'],
    'tabs/TutorTab.tsx': ['tabs/TutorTab.tsx', 'tutor/ContinuityCard.tsx'],
    'tabs/PracticeTab.tsx': [
      'tabs/PracticeTab.tsx',
      'practice/ReplayMomentCard.tsx',
      'practice/MakePhraseCard.tsx',
      'practice/TuneSoundCard.tsx',
    ],
    'tabs/MyFrenchTab.tsx': [
      'tabs/MyFrenchTab.tsx',
      'myfrench/LevelCard.tsx',
      'game/LevelXpCard.tsx',
      'game/StreakSummaryCard.tsx',
      'game/CountsGrid.tsx',
      'game/BadgeShelf.tsx',
      'progress/PostcardShelf.tsx',
    ],
    'tabs/ProfileTab.tsx': ['tabs/ProfileTab.tsx', 'game/ProfileStats.tsx'],
  };

  test('a tab carries at most one primary pill per door, and Home and Tutor carry exactly what the founder drew — F406', () => {
    const task = named('practice/NextTaskCard.tsx');
    const local = named('practice/LocalPracticeCard.tsx');
    const hero = named('home/MissionHero.tsx');
    for (const tab of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx', 'tabs/PracticeTab.tsx']) assert.match(named(tab), /<NextTaskCard/);
    assert.equal((task.match(/<PillButton\b/g) ?? []).length, 3, 'personal practice, authored review and allowance are exclusive');
    assert.equal((local.match(/<PillButton\b/g) ?? []).length, 1);
    assert.equal((hero.match(/<PillButton\b/g) ?? []).length, 1);
    assert.match(task, /if \(value.card !== null\)/);
    assert.match(task, /if \(kind === 'plans'\)/);
    assert.match(task, /kind === 'scene' && value.hero !== null \? <MissionHero/);
    assert.match(named('tabs/HomeTab.tsx'), /!unowned && readFailed/);
    assert.equal((named('tabs/MyFrenchTab.tsx').match(/<PillButton\b/g) ?? []).length, 1);
    assert.match(named('tabs/MyFrenchTab.tsx'), /firstVisit &&/);

  });

  test('a tab lists what it opens one way, as ledger rows, and never two shapes for one list — F569', () => {
    // The companion to the rule above. A tab with no pill still has to offer a
    // way in, and every list is drawn ONE way, so two rows in the same list
    // cannot drift apart. The counts are literal tags rather than rendered rows,
    // because every list is a `.map` over a model. Notebook redesign
    // (2026-09-27, Phase 3): the tinted stamp row became the hairline ledger
    // row, so both are counted. The tinted row is a deprecated wrapper now; its
    // last call site is Speak's memory row in ContinuityCard, and it goes in the
    // final sweep, when that count must reach zero too.
    for (const [tab, files] of Object.entries(SURFACES)) {
      for (const file of files.slice(1)) {
        assert.ok(named(tab).includes(`'../${file}'`), `${tab} no longer draws ${file}; the surface list is stale`);
      }
    }
    const tinted: Record<string, number> = {
      'tabs/HomeTab.tsx': 0,
      'tabs/TutorTab.tsx': 0,
      'tabs/PracticeTab.tsx': 0,
      'tabs/MyFrenchTab.tsx': 0,
      'tabs/ProfileTab.tsx': 0,
    };
    const ledger: Record<string, number> = {
      // Revamp B (F602): the one review row, under a scene or plans lead when
      // phrases are due. Everything else on Today is a card or a sentence.
      'tabs/HomeTab.tsx': 0,
      // The level path's scenes, the other ways in, and the memory row.
      'tabs/TutorTab.tsx': 2,
      // The review door on the tab, then replay a moment and make this phrase
      // yours in their own card files.
      'tabs/PracticeTab.tsx': 4,
      // Conversations and their "see all", the phrase shelf, the collection,
      // goals, the daily collection and the door to every situation. Phase 4
      // (2026-10-07): the postcards row became the postcard shelf, 5 to 4.
      'tabs/MyFrenchTab.tsx': 4,
      // Profile is cards of settings, not a list of places.
      'tabs/ProfileTab.tsx': 0,
    };
    for (const [tab, expected] of Object.entries(tinted)) {
      const n = SURFACES[tab]!.reduce((total, name) => total + (named(name).match(/<TintRow\b/g) ?? []).length, 0);
      assert.equal(n, expected, `${tab} draws ${n} tinted rows across its own surfaces; it should draw ${expected}`);
    }
    for (const [tab, expected] of Object.entries(ledger)) {
      const n = SURFACES[tab]!.reduce((total, name) => total + (named(name).match(/<LedgerRow\b/g) ?? []).length, 0);
      assert.equal(n, expected, `${tab} draws ${n} ledger rows across its own surfaces; it should draw ${expected}`);
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
  test('the app exports one Monogram, and Profile borrows it', () => {
    // Two Monograms is two initials that drift: friends/ui.tsx drew a sans disc
    // with radius.pill, components.tsx draws the serif decorative one. The tab
    // that shows the learner their own row used the friends copy. One export now.
    assert.doesNotMatch(
      named('friends/ui.tsx'),
      /export function Monogram/,
      'friends/ui.tsx still exports its own Monogram',
    );
    assert.match(
      named('profile/ProfileButton.tsx'),
      /import \{[^}]*\bMonogram\b[^}]*\} from '\.\.\/components\.tsx'/,
      'Profile does not borrow the shared Monogram',
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

  test("the auth screens lead with Apple above Google, then the fields, and pin one ink pill in the frame's footer", () => {
    for (const name of ['auth/SignUpScreen.tsx', 'auth/SignInScreen.tsx']) {
      const body = named(name);
      // Keyboard-aware, so the fields lift rather than hide; and the one back is
      // the shared header, not a hand-rolled chevron.
      assert.match(body, /<ScrollScreen\b[\s\S]*?avoidKeyboard/, `${name} is not a keyboard-aware ScrollScreen`);
      assert.match(body, /<ScreenHeader\b[^>]*\bback=/, `${name} does not draw its one back through the shared header`);

      // The footer holds one pill and nothing else, and it is the ink one (ink
      // is PillButton's default tone): the form's own action, where a keyboard
      // cannot scroll it out of reach. Revamp B (F601) moved the provider doors
      // out of the footer, so neither mark may be left behind in it, and the
      // outline Google door is gone from the file altogether.
      const footer = footerProp(body);
      const footerPills = tags(footer, 'PillButton');
      assert.equal(footerPills.length, 1, `${name} pins ${footerPills.length} pills in the footer; it pins exactly one`);
      assert.doesNotMatch(footerPills[0]!, /\btone=/, `${name}'s footer pill is not the ink one`);
      assert.doesNotMatch(footer, /AppleMark|GoogleMark/, `${name} left a provider door in the footer`);
      assert.doesNotMatch(body, /<OutlineButton\b/, `${name} still draws the outline door the board retired`);

      // The body, which follows the footer prop in the JSX, leads with the
      // doors. Apple's is gated and ink; Google's is the white pill beneath it;
      // and both come before the first field, the way the board draws them.
      const content = body.slice(body.indexOf('footer={') + 'footer='.length + footer.length);
      const doors = tags(content, 'PillButton');
      const apple = doors.find((tag) => /<AppleMark\b/.test(tag));
      const google = doors.find((tag) => /<GoogleMark\b/.test(tag));
      assert.ok(apple, `${name} lost the Apple door from the body`);
      assert.ok(google, `${name} lost the Google door from the body`);
      assert.doesNotMatch(apple, /\btone=/, `${name}'s Apple door is not an ink pill`);
      assert.match(google, /\btone="white"/, `${name}'s Google door is not the white pill`);
      writtenBefore(content, '{appleOffered && (', apple, `${name} draws the Apple door whether or not the platform offers it`);
      writtenBefore(content, apple, google, `${name} draws the Apple door below the Google one`);
      writtenBefore(content, google, '<Field', `${name} puts a field above the provider doors`);

      // The switch row is NOT in the footer: it stays at the body's end, after
      // the last field, so a field is visible over an SE-class keyboard rather
      // than pinned under the buttons. It is the only Press on the screen that
      // is not inside a part, so the footer holding one would be the row in the
      // wrong place.
      assert.doesNotMatch(footer, /<Press(?:able)?\b/, `${name} pins its switch row in the footer instead of the body's end`);
      const switchRow = tags(content, 'Press').find((tag) => /accessibilityRole="button"/.test(tag));
      assert.ok(switchRow, `${name} lost the switch row from the body`);
      assert.ok(
        content.lastIndexOf('<Field') < content.indexOf(switchRow),
        `${name} moved the switch row above a field, off the body's end`,
      );
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
      // 2026-09-27, notebook Phase 1: the header must now say the chartreuse is gone.
      assert.match(header, /no chartreuse/, `${name} does not say the selected tab carries no chartreuse`);
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
  test('the design doc describes Practice as the archive the tab actually draws — F442', () => {
    // The row for this tab described the authored path for as long as the tab
    // drew one, and then the archive for as long as it drew that. Revamp A moved
    // the archive one level down to `Conversations`, so the row says what a
    // learner actually meets: one next practice and three rows. It is pinned
    // here rather than left to prose because a doc that still promises a vault
    // and a feed on this tab is what the next change would be built from.
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    const row = design.split('\n').find((line) => line.startsWith('| Practice |'));
    assert.ok(row !== undefined, 'DESIGN.md has no Practice row in the tab table');

    for (const claim of ['made from', 'next practice', 'three rows', 'one level down']) {
      assert.ok(row.toLowerCase().includes(claim), `the Practice row never mentions "${claim}", which is what the tab now is`);
    }
    assert.ok(!/the path, the guided lesson/.test(row), 'the Practice row still promises the authored path');

    // And the archive really did move rather than being described away: the
    // route that took it says so in its own row, and the tab folds no archive.
    const route = design.split('\n').find((line) => line.startsWith('| Conversations |'));
    assert.ok(route !== undefined, 'DESIGN.md has no Conversations row, so the archive is described nowhere at all');
    for (const claim of ['vault', 'feed', 'filters']) {
      assert.ok(route.toLowerCase().includes(claim), `the Conversations row never mentions the ${claim} that left Practice`);
    }

    // And the claims held against the source rather than against each other, so
    // a doc and a screen cannot drift together into agreeing on something false.
    const tab = named('tabs/PracticeTab.tsx');
    assert.ok(!tab.includes('buildPath'), 'DESIGN.md says the path is gone and the tab still builds one');
    assert.doesNotMatch(tab, /archiveFrom/, 'DESIGN.md says the archive is one level down and Practice folds one anyway');
    assert.match(named('conversationPacks/ConversationsScreen.tsx'), /archiveFrom/, 'nothing folds the archive at all now, so it did not move, it went');
    assert.equal(
      (tab.match(/<PillButton\b/g) ?? []).length,
      1,
      'the design doc says Practice keeps one pill, for the learner with no conversation yet, and the tab draws a different number',
    );
  });

  test('the design doc and tabs agree on static greetings, picture-free daily French and one Speak primary — F407', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    const home = named('tabs/HomeTab.tsx');
    const tutor = named('tabs/TutorTab.tsx');
    assert.match(design, /voice orb, shared press, motion primitives, celebration host and bounded\s+state feedback animate/);
    // 2026-10-07, come alive Phase 4 (README Part 6): Home now draws the
    // scene's place on its brief and the game art, so the sentence is held to
    // what stays picture-free, the daily library and today's phrase.
    assert.match(design, /daily library and today's phrase\s+show no pictures/);
    // Revamp B (F599): the places are flat drawings now, and the doc must not
    // go on saying the retired watercolours ship.
    assert.match(design, /seven place drawings/);
    assert.doesNotMatch(design, /watercolours ship|Raster scenes, retiring/);
    assert.doesNotMatch(home, /titleSwap|useGreetingRotation|<DailyCarousel|<WordOfDayCard/);
    assert.match(home, /title=\{greeting\.title\}/);
    assert.match(home, /purpose=\{greeting\.subline\}/);
    // Revamp B (F602): Today draws the white "today" look of the same card.
    assert.match(home, /<DailyCard item=\{daily\.phrase\} variant="today" \/>/);
    assert.doesNotMatch(named('daily/DailyCard.tsx'), /<Art\b|<WordScene\b|sceneForDaily/);
    assert.equal((tutor.match(/<PillButton\b/g) ?? []).length, 0, 'the shared task owns the primary; connection retry is secondary');
    assert.match(tutor, /const primary = <GhostButton/);
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
  test('nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440', () => {
    // 2026-09-27, notebook final sweep. `progress/MomentumCards.tsx` and
    // `HomeProgressDetails` had had no renderer since the Phase 3 Today
    // rebuild, and `WeekRail`'s last live caller was the retired French wall
    // page, so all three are deleted rather than described. The DESIGN.md half
    // of F440 (the `| Progress |` route row and the Home row's "one level
    // down") is dropped here, not repointed: the docs rewrite that follows this
    // sweep pins the new Structure section.
    for (const file of ['progress/MomentumCards.tsx', 'progress/ProgressScreen.tsx', 'progress/progressView.ts']) {
      assert.equal(existsSync(join(SRC, file)), false, `${file} is retired`);
    }
    assert.doesNotMatch(named('components.tsx'), /export function WeekRail\b/, 'the week rail is exported again');
    // No screen draws a days count. The rule is PRODUCT.md's, and the model
    // that holds it by name stays in `progress/momentum.ts` with its suite;
    // nothing else may fold `momentumFrom` or spell the tile back onto a screen.
    for (const { path, body } of SOURCES) {
      if (rel(path) === 'progress/momentum.ts') continue;
      assert.doesNotMatch(
        body,
        /\b(?:MomentumCards|HomeProgressDetails|WeekRail|weekRailFrom|canDoRows|momentumFrom|DAYS_LABEL)\b|Days active|days\.count/,
        `${rel(path)} renders the retired momentum block, its details, the week rail or a days-active count`,
      );
    }
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
    assert.match(p54!, /mission hero/, 'the Pass 5 runbook does not say the mission hero is there on day one');
    // And the screen still agrees: the hero is outside every momentum gate. It
    // is drawn on its own situation and on nothing else, which is what makes a
    // first run a page with something on it rather than a blank one. The
    // next-step row became the hero with F543.
    const home = named('tabs/HomeTab.tsx');
    assert.match(home, /<NextTaskCard\b/, 'Home no longer draws the hero the runbook says a beginner meets');
    // Revamp B (F602): the page splits once on whether storage has answered
    // (sand blocks until it has), and the lead is the rule's answer for the
    // hero it read. The one condition on the hero is still having a situation
    // to offer; the brief is the lead whenever neither recall nor the plans
    // card is.
    assert.match(
      home,
      /const unowned = readOwner !== scopeGeneration\(\);/,
      'the hero is drawn behind some other condition than having a situation to offer',
    );
    assert.match(home, /\{!unowned && readFailed \? \(/, 'Home no longer separates failed reads from a fresh account');
    assert.match(home, /\) : hero === null \|\| unowned \? \(/, 'Home no longer waits on storage before it draws a lead');
    assert.match(home.replace(/\s+/g, ' '), /<NextTaskCard \/>/, 'the hero is not the lead Home falls back to');
    // The momentum gate that used to sit beside it left Home with the block
    // itself, so the half of this check that made sure the hero was not hidden
    // behind it is now made by the line above: there is one condition on the
    // hero and it is having a situation to offer.
    // 2026-09-27, Phase 3: the momentum tiles left Today, so the order now pinned is the next scene before
    // today's phrase. Both must be present, or the comparison would pass on a missing tag.
    assert.ok(home.includes('<NextTaskCard') && home.includes('<DailyCard'), 'Today no longer draws the scene brief and today\'s phrase');
    assert.ok(
      home.indexOf('<NextTaskCard') < home.indexOf('<DailyCard'),
      'the next scene must lead Today, ahead of today\'s phrase',
    );
    assert.doesNotMatch(home, /<HomeMomentum\b/, 'the four empty tiles came back to Today');
  });

  test('the device runbook carries the Pass 5 checks — F410', () => {
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    assert.match(runbook, /## Pass 5 daily home/, 'the runbook has no Pass 5 section');
    const section = runbook.slice(runbook.indexOf('## Pass 5 daily home'));
    const rows = section.split('\n').filter((l) => /\|\s*P5-\d/.test(l));
    // Eleven since the Home revision: the greeting at every reading size, and
    // a scene that changes with the day, are two more things no source walk can
    // see. The count is asserted rather than a floor so a row cannot go quietly.
    assert.equal(rows.length, 11, `the Pass 5 section names ${rows.length} rows; it should carry P5-1 through P5-11`);
    for (let i = 1; i <= 11; i += 1) {
      assert.match(section, new RegExp(`P5-${i}\\b`), `the Pass 5 runbook names no P5-${i} row`);
    }
    for (const row of rows) {
      // Every row still owes a device. One is allowed to carry evidence from the
      // web build beside that debt, because greeting timing can be measured
      // there too; what it may
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
      ['the complete greeting moving through one clipped line', /complete greeting rises through one clipped line/],
      ['the native commit staying seamless', /no blank, flash or pause at the commit/],
      ['reduce motion resting the greeting', /reduce motion on/],
      ['a screen reader hearing one greeting', /VoiceOver and TalkBack read one greeting/],
      ['a fresh account meeting four momentum cards with start lines in them', /fresh account/],
      ['the large-text greeting standing down', /At AX3–AX5 the animation stands down/],
      ['a drawing that changes with the day', /different drawing appears on a different day/],
    ] as const) {
      assert.match(section, pattern, `the Pass 5 section never asks anyone to check ${what}`);
    }
  });
});

describe('the device runbook carries revamp A — F587', () => {
  test('the device runbook carries the Pass 8 revamp checks', () => {
    // Revamp A is the largest change to the surface since the app was written,
    // and the proportion of it a source walk can see is the lowest of any pass.
    // A wash meeting a corner, five words fitting in a tab bar, an orb resting,
    // a screen reader walking past a picture and a microphone indicator NOT
    // appearing during a replay are all things somebody has to hold a phone to
    // know. The runbook is where that debt is written down rather than felt.
    const runbook = readFileSync(join(ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');
    const at = runbook.indexOf('## Pass 8 revamp');
    assert.notEqual(at, -1, 'the runbook has no Pass 8 revamp section');
    // To the next heading rather than to the end of the file, so a phrase that
    // happens to appear in a later run log cannot answer for a row that is not
    // there.
    const nextHeading = runbook.indexOf('\n## ', at + 1);
    const section = runbook.slice(at, nextHeading === -1 ? undefined : nextHeading);

    const rows = section.split('\n').filter((l) => /\|\s*P8-\d/.test(l));
    assert.equal(rows.length, 14, `the Pass 8 section names ${rows.length} rows; it should carry P8-1 through P8-14`);
    for (let i = 1; i <= 14; i += 1) {
      assert.match(section, new RegExp(`P8-${i}\\b`), `the Pass 8 runbook names no P8-${i} row`);
    }
    for (const row of rows) {
      assert.match(row, /not run/, `a Pass 8 row claims to be finished before a device walked it: ${row.trim()}`);
      const claimed = row.match(/\|\s*(pass|fail)\s*\|/g) ?? [];
      assert.equal(
        claimed.length,
        0,
        `a Pass 8 row is marked without naming the platform it was walked on: ${row.trim()}`,
      );
    }

    // The eight things this pass added that no test in this repository can see.
    // Named by the phrase the row has to carry, so a row rewritten into a
    // vaguer one fails here rather than being followed and passed.
    for (const [what, phrase] of [
      ['the header picture meeting the corner', 'bleeds off the corner'],
      ['the tab bar at the largest reading size', 'keeps every whole word'],
      ['the orb and the greeting resting', 'reduce motion on'],
      ['a screen reader ignoring the art', 'walk past every illustration'],
      ['replay saying the better line', 'speaks the better line'],
      ['an unanswered own-words attempt leaving nothing behind', 'never a grade'],
      ['the Android memory budget for the raster art', 'graphics memory'],
      ['the web column', 'clamps to the column'],
    ] as const) {
      assert.ok(section.includes(phrase), `the Pass 8 section never asks anyone to check ${what}`);
    }
  });
});

/** Parse JSX, not angle brackets in comments, strings or callback expressions. */
function notebookComposition(source: string): { highlighters: number; nestedCards: number } {
  const tree = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Map(['Card', 'Highlight', 'LevelPath'].map(name => [name, name]));
  const namespaces = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!/(?:^|\/)components(?:\.tsx)?$/.test(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) names.set(binding.name.text, binding.propertyName?.text ?? binding.name.text);
    }
  }
  const result = { highlighters: 0, nestedCards: 0 };
  function visit(node: ts.Node, cardDepth: number): void {
    let depth = cardDepth;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      const name = ts.isIdentifier(tag) ? names.get(tag.text)
        : ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && namespaces.has(tag.expression.text)
          ? tag.name.text : undefined;
      // A LevelPath owns its "here" mark, so it consumes the same budget as Highlight.
      if (name === 'Highlight' || name === 'LevelPath') result.highlighters += 1;
      if (name === 'Card') {
        if (depth > 0) result.nestedCards += 1;
        depth += 1;
      }
    }
    ts.forEachChild(node, child => visit(child, depth));
  }
  visit(tree, 0);
  return result;
}

describe('the notebook composition rules have no transitional allowances', () => {
  test('the JSX guard counts both highlighter hosts and catches nested cards through callbacks and aliases', () => {
    assert.deepEqual(notebookComposition('<><Highlight text="bonjour" /><LevelPath levels={levels} /></>'), { highlighters: 2, nestedCards: 0 });
    assert.deepEqual(notebookComposition('<Card><View>{items.map(item => <Card key={item.id} />)}</View></Card>'), { highlighters: 0, nestedCards: 1 });
    assert.deepEqual(notebookComposition("import { Card as Box, Highlight as Mark } from './components.tsx'; const view = <Box><Box /><Mark text='oui' /></Box>;"), { highlighters: 1, nestedCards: 1 });
    assert.deepEqual(notebookComposition("import * as Kit from './components.tsx'; const view = <Kit.Card><Kit.Card /><Kit.LevelPath levels={levels} /></Kit.Card>;"), { highlighters: 1, nestedCards: 1 });
    assert.deepEqual(notebookComposition('const example = "<Card><Card/><Highlight/></Card>"; const view = <><Card /><Card /></>;'), { highlighters: 0, nestedCards: 0 });
  });

  test('each screen file draws at most one Highlight or LevelPath here host', () => {
    for (const { path, body } of SOURCES) {
      assert.ok(notebookComposition(body).highlighters <= 1, `${rel(path)} draws more than one highlighter host`);
    }
  });

  test('no Card is nested inside another Card', () => {
    for (const { path, body } of SOURCES) {
      assert.equal(notebookComposition(body).nestedCards, 0, `${rel(path)} nests a Card inside a Card`);
    }
  });
});

describe('retired notebook presentation cannot return', () => {
  test('no source retains a tint token, role table or tinted primitive', () => {
    for (const { path, body } of SOURCES) {
      assert.doesNotMatch(rel(path), /Tint\.(?:ts|tsx)$/, `${rel(path)} retains a tint role table`);
      assert.doesNotMatch(body, /\b(?:tint|TintName|TintRow|TintPanel|TintDisc|MISSION_TINT|DOOR_TINT|CONTINUITY_TINT|MADE_FROM_TINT|RHYTHM_TINT|MOMENT_TINT|missionTint|doorTint|madeFromTint|momentTint)\b/, `${rel(path)} retains the old tint vocabulary`);
    }
  });
});

test('retired notebook files and artwork stay deleted', () => {
  const files = [
    'surface/IconRowCard.tsx', 'surface/HeroCard.tsx', 'nav/tabSurface.ts',
    'missions/missionTint.ts', 'tutor/doorTint.ts', 'tutor/momentTint.ts',
    'practice/madeFromTint.ts', 'profile/rhythmTint.ts', 'practice/starterRows.ts',
    'practice/PathNodeRow.tsx', 'daily/DailyCarousel.tsx', 'daily/carousel.ts',
    'progress/WordScene.tsx', 'progress/WordOfDayCard.tsx', 'progress/wordScenes.ts',
    'wall/WallMapPage.tsx', 'wall/WallFrenchPage.tsx', 'wall/wallMap.ts', 'wall/wallFrench.ts',
    'illustrations/scenes/bubbles.tsx', 'illustrations/scenes/onboarding.tsx',
    'illustrations/scenes/sprout.tsx', 'illustrations/scenes/stack.tsx',
    'illustrations/scenes/daily/kitchen.tsx', 'illustrations/scenes/daily/weather.tsx',
    'illustrations/scenes/daily/street.tsx', 'illustrations/scenes/daily/garden.tsx',
    'illustrations/useSceneMotion.ts',
  ];
  for (const file of files) assert.equal(existsSync(join(SRC, file)), false, `${file} is retired`);
  const retiredArt = ['welcome-bubbles', 'onboard-cake', 'onboard-wave', 'empty-table', 'recap-postcard', 'phrasebook', 'wall-map'];
  for (const name of retiredArt) {
    for (const density of ['', '@2x', '@3x']) {
      assert.equal(existsSync(join(APP, 'assets', 'art', `${name}${density}.png`)), false, `${name}${density} must not ship`);
    }
    // Revamp B (F599): the raster registry retired with the PNGs, and the one
    // registry left is the flat one, which must not take a retired name back.
    assert.ok(!named('art/flat/index.ts').includes(`'${name}'`), `${name} is still registered`);
  }
  for (const { path, body } of SOURCES) {
    assert.doesNotMatch(body, /\b(?:IconRowCard|HeroCard|sceneForDaily|WordScene|StillWriting|TitleSwapRow)\b/, `${rel(path)} retains retired presentation`);
    assert.doesNotMatch(body, /#(?:FEE7DB|F8D8DF|E4D3EE|CFF3EB|E8EED5|D5EFFE)\b/i, `${rel(path)} restores a retired tint as a raw hex`);
  }
});
