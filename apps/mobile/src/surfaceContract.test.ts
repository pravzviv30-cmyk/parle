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
    for (const name of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx', 'tabs/LeaderboardTab.tsx']) {
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
