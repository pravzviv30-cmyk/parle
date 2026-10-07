/**
 * The chooser, as it is drawn — F573.
 *
 * `chooserView.test.ts` holds what the screen is allowed to decide. This holds
 * what it puts on glass, which after Revamp A is a different shape: one hero
 * card with the scene's drawing on it, five ruled rows, and the scripted
 * lesson at the foot. Six cards with six drawings became one card and five
 * rows, and the reason is the same one the founder gave for the tab: six equal
 * rectangles is a decision handed to somebody who has no way to make it yet.
 *
 * Read as source, because there is no renderer in this suite
 * (docs/TESTING.md). The ceiling is honest: this proves the screen asks the
 * one illustration renderer for its drawing at the catalogue's size, never
 * that a phone drew it.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MISSIONS } from '@luvani/core';

import { sceneIllustration } from '../art/flat/scenes.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./MissionsScreen.tsx'));

describe('the chooser is one card and five rows — F573', () => {
  test('an unread scene history is never drawn as a fresh catalogue', () => {
    assert.match(SCREEN, /setProgress\(null\)/);
    assert.match(SCREEN, /if \(progress === null\) return <ScrollScreen/);
    assert.match(SCREEN, /Your scene history could not be read just now/);
    assert.match(SCREEN, /Try loading scenes again/);
  });
  test('the situation already picked out is the card, and the other five are rows a learner can read at a glance', () => {
    assert.match(SCREEN, /if \(focus && first\)/, 'a named scene never opens its own brief');
    assert.match(SCREEN, /\{first\.mission\.title\}/, 'the brief loses its French title');
    assert.match(SCREEN, /\{first\.mission\.canDoEn\}/, 'the brief loses its learning outcome');
    assert.match(SCREEN, /<PillButton tone="white" label=\{typed \? 'Start typing' : 'Start speaking'\}/, 'the action does not preserve the selected mode');
    assert.doesNotMatch(SCREEN, /<TabBar\b/, 'the scene brief grows a mode chooser');
    assert.match(SCREEN, /const typed = route\.params\?\.textMode === true;/);
    assert.match(SCREEN, /label=\{TYPE_INSTEAD\} ground="blue" onPress=\{\(\) => open\(first, true\)\}/, 'the brief loses its quiet typed twin');
    assert.doesNotMatch(SCREEN, /missionMinutes\(first\.mission\)/, 'an unmeasured duration dominates the brief');
    const brief = SCREEN.slice(SCREEN.indexOf('if (focus && first)'));
    assert.ok(brief.indexOf('{first.mission.title}') < brief.indexOf('<Illustration'), 'decoration precedes the actual task');
    assert.match(SCREEN, /ground=\{focus && progress !== null && first \? 'blue' : 'paper'\}/, 'the brand has no contrast on its ground');
    assert.match(SCREEN, /\['A0', 'A1'\]/, 'the list loses its level grouping');
    assert.match(SCREEN, /view\.cards\.filter\(\(card\) => card\.mission\.cefr === level\)\.map/, 'the list loses scenes from the view model');
    assert.match(SCREEN, /<LedgerRow\b/);
    assert.match(SCREEN, /glyph=\{<SceneMark state=\{earnedMissionIds/, 'the list invents earning instead of asking core');
    assert.match(SCREEN, /title=\{card\.mission\.titleEn\} gloss=\{`\$\{card\.mission\.title\}\. \$\{card\.status\}`\}/, 'the list loses its English outcome, French title or evidence state');
    assert.match(SCREEN, /nav\.setParams\(\{ focus: card\.mission\.id, textMode: typed \}\)/, 'the list starts a session before its brief');
    assert.match(SCREEN, /accessibilityLabel=\{asSentences\(\[card\.mission\.title, card\.mission\.titleEn, card\.status\]\)\}/, 'a row stops saying where the learner stands with the situation behind it');
    assert.match(SCREEN, /^import \{ asSentences \} from '\.\.\/copy\/spoken\.ts';$/m, 'the row joins its label its own way rather than through the shared joiner');
    assert.ok(!/'Started'|'Ready when you are'|'Ready to come back to'/.test(SCREEN), 'the screen spells a status line that chooserView.ts already decides');
  });

  test('the way out of the chooser still works on the first screen after signing up, and nothing on it is capped', () => {
    // A first run opens ON this screen, so its back stack is empty. This is the
    // same claim `nav/wiring.test.ts` makes; it is repeated here because the
    // rewrite moved every line around it.
    const leave = SCREEN.slice(SCREEN.indexOf('const leave'), SCREEN.indexOf('const open'));
    assert.ok(leave.includes('canGoBack()'), 'the way out assumes there is something behind this screen');
    assert.match(leave, /navigate\('Tabs'\)/, 'a chooser nobody can leave is a dead end on screen one');
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'the chooser draws a second way back beside the shared header');

    // A learner at the largest reading size reads the same words as everybody
    // else: nothing truncates, nothing caps the scale, and no picture is sized
    // at the call site.
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'ellipsizeMode', 'allowFontScaling']) {
      assert.ok(!SCREEN.includes(capped), `the chooser carries ${capped}, which clips a line rather than letting it wrap`);
    }
    assert.doesNotMatch(SCREEN, /fontSize:/, 'the chooser names a raw font size instead of a type token');
    assert.doesNotMatch(SCREEN, /\bwidth:\s*\d/, 'the chooser pins something to a fixed width, which cannot wrap at large text');
    assert.doesNotMatch(SCREEN, /<Illustration[^>]*(width|height)=/, 'the chooser sizes a drawing itself instead of taking the size the catalogue gives it');

    // And no drawing on this screen moves. Six loops at the moment somebody is
    // trying to choose is six things pulling at the eye, which is why the art
    // is a still picture rather than a scene with a pause prop to forget.
    //
    // Was `<MissionArt`, the switch that drew one authored scene per place. It
    // was deleted once the chooser took `heroArt`, and a check for a name that
    // cannot exist is a check that passes for the wrong reason, so this reads
    // the two things that would actually be true again if a scene came back.
    assert.doesNotMatch(SCREEN, /from '\.\.\/illustrations/, 'the chooser reaches for an authored scene again instead of the flat drawing');
    assert.doesNotMatch(SCREEN, /paused=/, 'something on the chooser takes a pause prop, which only a scene with a loop in it needs');
  });

  test("the chooser's first card draws its scene through the one illustration at the hero-spot size, and sizes nothing itself", () => {
    // 2026-09-30, revamp B (F599). The watercolour left with the raster art;
    // the hero card draws the scene's flat drawing instead, named by mission
    // rather than by place because the café has two scenes and two drawings.
    // `fit="small"` is the catalogue's second size, the one it gives a hero
    // spot; the renderer turns it into a width, so nothing here writes one.
    assert.match(
      SCREEN,
      /<Illustration name=\{sceneIllustration\(first\.mission\.id\)\} fit="small"/,
      'the hero card lost the drawing of the scene it is set in, or draws it at a size of its own',
    );
    assert.match(SCREEN, /^import \{ Illustration \} from '\.\.\/art\/flat\/Illustration\.tsx';$/m, 'the drawing does not come from the one illustration renderer');
    assert.match(SCREEN, /^import \{ sceneIllustration \} from '\.\.\/art\/flat\/scenes\.ts';$/m, 'the screen names a drawing for a scene itself instead of asking the scene map');
    assert.equal((SCREEN.match(/<Illustration\b/g) ?? []).length, 1, 'the chooser draws more than the one scene on its hero card');
    assert.doesNotMatch(SCREEN, /<Illustration[^>]*(width|height)=/, 'the chooser sizes a drawing itself instead of taking the size the catalogue gives it');
    assert.doesNotMatch(SCREEN, /<Art\b/, 'the chooser still draws the retired watercolour');

    // Every scene in the catalogue has a place drawing of its own, so a
    // seventh situation cannot reach this screen with a blank brief.
    for (const mission of MISSIONS) {
      assert.match(sceneIllustration(mission.id), /^place-/, `${mission.id} has no place drawing, so the hero card for it is blank`);
    }
  });
});
