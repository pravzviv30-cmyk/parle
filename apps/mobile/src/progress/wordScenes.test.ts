/**
 * The daily scene pack: twenty keys, twenty drawings, one a day — F425.
 *
 * There is no renderer in this workspace (docs/TESTING.md), so the chooser is
 * read as source the way the tabs are. That is a blunt tool with an honest
 * ceiling: it proves every key reaches a drawing and every drawing is told to
 * stop, never that a kettle steamed on a phone. The device half belongs to
 * `docs/DEVICE_VERIFICATION.md`.
 *
 * The class of bug it is pointed at is the one that shipped the pack: nineteen
 * drawings landed in the barrel with no caller, and the only thing that noticed
 * was J14 in `surfaceContract.test.ts`. J14 is one assertion for the whole app
 * and it fails on the first name it finds, so it says "WordKettle is reached
 * from nowhere" and stops. This file says which of the twenty is missing, and
 * says it beside the pool rather than three directories away.
 *
 * The rotation itself is `dailyPick`, which is core's and is not re-tested
 * here. What is tested is that this pool is the shape `dailyPick` needs: twenty
 * distinct entries, walked one a day, in the order they are written down.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { dailyPick } from '@luvani/core';
import { WORD_SCENES, type WordSceneKey } from './wordScenes.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may name anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CHOOSER = stripComments(read('./WordScene.tsx'));
const CARD = stripComments(read('./WordOfDayCard.tsx'));
const BARREL = stripComments(read('../illustrations/index.ts'));

/**
 * The component a key names.
 *
 * The rule is the whole convention: `'sprout'` is `WordSprout`, and a
 * hyphenated key would capitalise each part. Deriving it rather than listing it
 * is what makes a key added with a mismatched drawing fail here instead of
 * quietly drawing the seedling forever.
 */
function componentFor(key: string): string {
  return `Word${key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

/**
 * Which subject each key was drawn for.
 *
 * Written down here rather than in `wordScenes.ts`, because nothing at runtime
 * picks by kind and a grouping the app could read would invite something to
 * start. It exists so the spacing of the pool is a property somebody can fail
 * rather than a claim in a comment.
 */
const SUBJECT: Readonly<Record<WordSceneKey, string>> = {
  sprout: 'garden',
  snail: 'garden',
  cat: 'garden',
  sailboat: 'garden',
  kettle: 'kitchen',
  croissant: 'kitchen',
  candle: 'kitchen',
  casserole: 'kitchen',
  teapot: 'kitchen',
  umbrella: 'weather',
  cloud: 'weather',
  kite: 'weather',
  leaves: 'weather',
  snowflake: 'weather',
  postbox: 'street',
  bicycle: 'street',
  fountain: 'street',
  pigeon: 'street',
  lantern: 'street',
  shutters: 'street',
};

/** Local midday, so a daylight saving hour cannot slide a sample into its neighbour's day. */
function middayOn(dayFromStart: number): number {
  return new Date(2026, 0, 1, 12, 0, 0).getTime() + dayFromStart * 24 * 60 * 60 * 1000;
}

describe('the word card is drawn a different way every day — F425', () => {
  test('twenty daily scenes rotate by the day, each reached from the chooser and paused from the card — F425', () => {
    // Twenty, and twenty different ones. Nineteen drawings plus the seedling,
    // which is three weeks of mornings before a learner meets one twice.
    assert.equal(WORD_SCENES.length, 20, `the pack holds ${WORD_SCENES.length} scenes; the founder settled on twenty`);
    assert.equal(new Set(WORD_SCENES).size, 20, 'two keys in the pool are the same, so one drawing gets two days and another gets none');
    for (const key of WORD_SCENES) {
      assert.match(key, /^[a-z]+(-[a-z]+)*$/, `${key} is not a kebab-case key, so the component it names cannot be derived`);
    }

    // Every key reaches a drawing. A key with no case would fall through to the
    // seedling and look like a working day rather than a missing one.
    for (const key of WORD_SCENES) {
      assert.ok(CHOOSER.includes(`case '${key}':`), `${key} has no case in WordScene.tsx, so its day silently draws the seedling`);
    }

    // And every drawing is drawn as an element. This is J14's rule, asserted
    // here on purpose rather than trusted three directories away: J14 walks the
    // whole app for `<Name` or `Name(`, so a map of bare identifiers would fail
    // it for all twenty at once and say so about only the first.
    for (const key of WORD_SCENES) {
      const name = componentFor(key);
      assert.ok(CHOOSER.includes(`<${name} `), `${name} is never drawn in WordScene.tsx, so ${key} has no picture`);
      assert.ok(BARREL.includes(name), `${name} is not exported by the illustration barrel, so ${key} names a drawing that does not ship`);
    }
    assert.match(CHOOSER, /from '\.\.\/illustrations\.tsx'/, 'the chooser reaches past the barrel into the scene files');

    // Nothing loops behind a tab nobody is looking at, and the chooser is where
    // that now has to hold: a case that forgot `paused` would animate for the
    // rest of the session, one day in twenty, which is the hardest kind of bug
    // to be told about. The default is counted too.
    const drawn = CHOOSER.match(/<Word[A-Za-z]+[^>]*\/>/g) ?? [];
    assert.equal(drawn.length, 21, `the chooser draws ${drawn.length} scenes; twenty cases and one default is twenty one`);
    for (const scene of drawn) {
      assert.ok(scene.includes('paused={paused}'), `the chooser loops a scene off screen: ${scene}`);
      assert.ok(scene.includes('width={width}'), `the chooser draws a scene at its own width rather than the card's: ${scene}`);
    }
    assert.match(CHOOSER, /default:\s*return <WordSprout /, 'a key this build does not know draws nothing at all, which strands the card');

    // The card hands the key and the pause straight through. It decides
    // neither: the day is Home's one clock reading and the pause is the tab's.
    assert.match(
      CARD,
      /<WordScene scene=\{scene\} width=\{\d+\} paused=\{paused\} \/>/,
      'the card does not draw the day through the chooser, or draws it without being told to stop',
    );
    assert.ok(!CARD.includes('WordSprout'), 'the card still reaches for one fixed drawing instead of the day it was handed');

    // Twenty consecutive days walk the pool in the order it is written, and the
    // twenty first is the first again. Position in the array is a day, which is
    // the only reason the order in that file is worth arguing about.
    const walk = Array.from({ length: 21 }, (_unused, day) => dailyPick(WORD_SCENES, middayOn(day)));
    const start = WORD_SCENES.indexOf(walk[0]!);
    assert.notEqual(start, -1, 'the first day picked something that is not in the pool');
    for (let day = 0; day < 20; day += 1) {
      assert.equal(walk[day], WORD_SCENES[(start + day) % 20], `day ${day} breaks the written order of the rotation`);
    }
    assert.equal(new Set(walk.slice(0, 20)).size, 20, 'twenty days do not reach twenty different drawings');
    assert.equal(walk[20], walk[0], 'the rotation does not come back round on the twenty first day');

    // The order is spaced by subject. Read in barrel order a learner would get
    // five kitchen mornings in a row, which is the sameness the pack was drawn
    // to end, so no two neighbours share a subject and neither do the two ends.
    assert.deepEqual(
      [...WORD_SCENES].filter((key) => SUBJECT[key] === undefined),
      [],
      'a scene in the pool belongs to no subject, so the spacing below is checking less than it looks',
    );
    for (let i = 0; i < WORD_SCENES.length; i += 1) {
      const here = WORD_SCENES[i]!;
      const next = WORD_SCENES[(i + 1) % WORD_SCENES.length]!;
      assert.notEqual(
        SUBJECT[here],
        SUBJECT[next],
        `${here} and ${next} are both ${SUBJECT[here]}, so two mornings running look like the same kind of morning`,
      );
    }
  });
});
