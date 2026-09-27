/**
 * The hero card, read as source — F569, F571.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the promises this
 * card makes are held by reading it.
 *
 * 2026-09-27, notebook Phase 1: HeroCard is a deprecated wrapper that draws
 * `SceneBrief` from components.tsx with the fields it has. The tint well and
 * the watercolour leave the card (the picture stays in the registry, drawn by
 * the missions chooser), and every promise the card made is kept: it writes no
 * size and no colour of its own, the primary action and the bookmark are the
 * caller's nodes, and the time line is the clock beside the ready words.
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
  test('the hero draws the scene brief with the fields it has, and nothing else', () => {
    assert.match(FLAT, /<SceneBrief /, 'the hero no longer draws the scene brief');
    assert.match(FLAT, /label=\{label\}/, 'the hero no longer says which kind of evening it is');
    assert.match(FLAT, /title=\{title\}/, 'the hero lost its title');
    assert.match(FLAT, /summary=\{body\}/, 'the hero lost its one plain line');
    assert.match(FLAT, /reason=\{reason\}/, 'the hero lost why this scene was chosen');
    assert.match(FLAT, /minutes=\{timeLine\}/, 'the hero lost how long it takes');
    assert.match(FLAT, /minutesMark=\{<ClockGlyph size=\{18\} color=\{paper\.inkSoft\} \/>\}/, 'the time line lost the clock that says what the number is');
    // The tint and the picture are not drawn: tints retire, and the brief is words.
    assert.doesNotMatch(HERO, /TintPanel|\btint\b|<Art\b|accent\.feature/, 'the hero still draws a tint, a picture or feature paper');

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!HERO.includes(raw), `the hero writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(HERO, /#[0-9A-Fa-f]{6}/, 'the hero writes a raw colour; every hex lives in palette.ts');
    assert.doesNotMatch(HERO, /width: \d/, 'the hero writes a width');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!HERO.includes(clip), `the hero uses ${clip}, so a learner who turns the text up loses words`);
    }
  });

  test('the primary action and the bookmark arrive as the caller built them', () => {
    // The pill stays in the screen's own file so surfaceContract.test.ts can go
    // on counting one primary action per screen by reading that file.
    assert.ok(!HERO.includes('<PillButton'), 'the hero builds its own pill, so the one-pill-per-screen count stops being readable from a screen');
    assert.ok(!HERO.includes('<OutlineButton'), 'the hero builds its own second button');
    assert.match(FLAT, /action: ReactNode;/, 'the action is no longer a node the caller passes');
    assert.match(FLAT, /action=\{action\}/, 'the hero never hands on the action it was handed');
    assert.match(FLAT, /corner=\{corner\}/, 'the bookmark corner is dropped on the way to the brief');
    assert.ok(!HERO.includes("position: 'absolute'"), 'the corner is placed over the card, where a grown title will collide with it');
  });
});
