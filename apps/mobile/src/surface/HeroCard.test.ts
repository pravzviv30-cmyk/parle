/**
 * The hero card, read as source — F569, F571.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the promises this
 * card makes are held by reading it. Three of them matter enough to pin: it
 * writes no size of its own, its picture is silent to a screen reader, and the
 * primary action is somebody else's literal.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const HERO = stripComments(read('./HeroCard.tsx'));
const FLAT = HERO.replace(/\s+/g, ' ');

describe('the card that leads a tab — F569', () => {
  test('the hero draws its label, bold title, compact scene brief and time line from tokens alone', () => {
    // Every size and colour comes from theme.ts. A number written here is a
    // number that drifts from the card next to it one pass later.
    assert.match(FLAT, /<Label>\{label\}<\/Label>/, 'the hero no longer says which kind of evening it is');
    assert.match(FLAT, /type\.cardTitle/, 'the hero title must use the shared bold headline');
    assert.match(FLAT, /type\.small, \{ color: paper\.inkSoft \}\]\}>\{body\}/, 'the scene brief must keep readable shared type and soft ink');
    assert.match(FLAT, /<View style=\{s\.sceneCopy\}>/, 'the scene brief must sit with the illustration');
    assert.match(FLAT, /<Art name=\{art\} /, 'the hero draws no scene, or draws it outside the one art renderer');
    assert.match(FLAT, /<ClockGlyph size=\{18\} color=\{paper\.inkSoft\} \/> <Text style=\{\[type\.small, \{ color: paper\.inkSoft \}\]\}>\{timeLine\}<\/Text>/, 'the clock and the ready line are no longer one quiet row');

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!HERO.includes(raw), `the hero writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(HERO, /#[0-9A-Fa-f]{6}/, 'the hero writes a raw colour; every hex lives in palette.ts');
    assert.doesNotMatch(HERO, /width: \d/, 'the hero writes a width; a scene is sized by art/registry.ts and nowhere else');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!HERO.includes(clip), `the hero uses ${clip}, so a learner who turns the text up loses words`);
    }
  });

  test('the primary action and the bookmark arrive as the caller built them, and the corner is a full target', () => {
    // The pill stays in the screen's own file so surfaceContract.test.ts can go
    // on counting one primary action per screen by reading that file. A pill
    // built in here would move every tab's count into a shared component.
    assert.ok(!HERO.includes('<PillButton'), 'the hero builds its own pill, so the one-pill-per-screen count stops being readable from a screen');
    assert.ok(!HERO.includes('<OutlineButton'), 'the hero builds its own second button');
    assert.match(FLAT, /action: ReactNode;/, 'the action is no longer a node the caller passes');
    assert.match(FLAT, /\{action\}/, 'the hero never draws the action it was handed');

    // The bookmark's slot is a real target even when the bookmark is small, and
    // it sits in flow: absolutely placed, it would land on the title at the
    // largest reading size.
    assert.match(FLAT, /corner: \{ minWidth: HIT, minHeight: HIT/, 'the corner slot is under the touch floor, or writes its own size');
    assert.ok(!HERO.includes("position: 'absolute'"), 'the corner is placed over the card, where a grown title will collide with it');
    assert.match(FLAT, /\{corner != null \? <View style=\{s\.corner\}>\{corner\}<\/View> : null\}/, 'a hero with no bookmark still reserves the slot, or draws a corner that is not there');
  });
});
