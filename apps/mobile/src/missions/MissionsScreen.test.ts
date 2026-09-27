/**
 * The chooser, as it is drawn — F573.
 *
 * `chooserView.test.ts` holds what the screen is allowed to decide. This holds
 * what it puts on glass, which after Revamp A is a different shape: one hero
 * card with the scene's picture on it, five tinted rows, and the scripted
 * lesson at the foot. Six cards with six drawings became one card and five
 * rows, and the reason is the same one the founder gave for the tab: six equal
 * rectangles is a decision handed to somebody who has no way to make it yet.
 *
 * Read as source, because there is no renderer in this suite
 * (docs/TESTING.md). The ceiling is honest: this proves the screen asks the
 * registry for its picture and the tint table for its paper, never that a phone
 * drew either.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MISSIONS } from '@luvani/core';

import { HERO_ART } from '../art/maps.ts';
import { MISSION_TINT } from './missionTint.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./MissionsScreen.tsx'));

describe('the chooser is one card and five rows — F573', () => {
  test('the situation already picked out is the card, and the other five are rows a learner can read at a glance', () => {
    // The hero. One picture, the French title in the serif, the English line
    // that says what the learner will be able to do, and the screen's one
    // solid action.
    assert.match(SCREEN, /<Label>\{CHOOSER_START_HERE\}<\/Label>/, 'the card that was chosen for the learner never says it was');
    assert.match(SCREEN, /<Art name=\{heroArt\(first\.mission\.place\)\}/, 'the hero card lost the drawing of the place it is set in');
    assert.match(SCREEN, /type\.frenchSm[\s\S]{0,80}\{first\.mission\.title\}/, 'the hero keeps its French title in the serif');
    assert.match(SCREEN, /\{first\.mission\.goalEn\}/, 'the hero card lost the line saying what the learner will be able to do');
    assert.match(SCREEN, /<PillButton\s+label=\{typed \? 'Start typed mission' : 'Start mission'\}/, 'the primary action names the mode the learner arrived in');

    // 2026-09-27 (notebook Phase 3, B1): the Speak/Type segmented pill left.
    // Speaking is the default, "Type instead" is a quiet link under the one
    // Start, and the brief says the level and the minutes the mission derives,
    // so the opener reads about three rather than the open-mission eight.
    assert.ok(!/<TabBar\b/.test(SCREEN), 'the Speak/Type segmented pill is back on the chooser');
    assert.match(SCREEN, /const typed = route\.params\?\.textMode === true;/);
    assert.match(
      SCREEN.replace(/\s+/g, ' '),
      /\{!typed && <GhostButton label=\{TYPE_INSTEAD\} color=\{paper\.ink\} onPress=\{\(\) => open\(first, true\)\} \/>\}/,
      '"Type instead" is not a quiet link under the Start',
    );
    assert.ok(SCREEN.indexOf("'Start mission'") < SCREEN.indexOf('label={TYPE_INSTEAD}'), '"Type instead" sits above the Start');
    assert.match(SCREEN, /\{first\.mission\.cefr\} · \{first\.status\} · \{minutesLine\(missionMinutes\(first\.mission\)\)\}/, 'the brief does not say its level and derived minutes');
    assert.ok(!SCREEN.includes('estimateMinutes('), 'the chooser estimates a mission itself instead of asking missionMinutes');

    // The other five, as rows. A row is a tinted strip with the place's mark, the
    // French title, the English under it and a chevron.
    assert.match(SCREEN, /\{rest\.map\(\(card\) => \(/, 'the other situations are not drawn from the view model');
    assert.match(SCREEN, /<TintRow/, 'the other situations are still six rectangles rather than rows');
    assert.match(SCREEN, /tint=\{missionTint\(card\.mission\.place\)\}/, 'a row picks its own paper instead of reading missionTint.ts');
    assert.match(SCREEN, /glyph=\{<PlaceGlyph place=\{card\.mission\.place\}/, 'a row lost the mark that says where it is set');
    assert.match(SCREEN, /title=\{card\.mission\.titleEn\}/, 'a row names the situation in the learner’s language');
    assert.match(SCREEN, /gloss=\{`\$\{card\.mission\.goalEn\} · \$\{card\.status\}`\}/, 'each row visibly explains its goal and earned status');
    assert.match(SCREEN, /<Label>\{CHOOSER_OTHER\}<\/Label>/, 'the rest of the situations sit under no heading');

    // Where the learner stands is still said, and it is said to everybody who
    // listens to the screen rather than dropped when the status line left the
    // row. `chooserView.ts` owns the words; nothing here invents one.
    // Stage 4 review (2026-09-25): the parts are joined by the shared sentence
    // joiner, so a French title that already ends on its own mark ("Ta
    // journée, ça a été ?") is not read with a second one after it. The same
    // three parts, in the same order.
    assert.match(SCREEN, /accessibilityLabel=\{asSentences\(\[card\.mission\.title, card\.mission\.titleEn, card\.status\]\)\}/, 'a row stops saying where the learner stands with the situation behind it');
    assert.match(SCREEN, /^import \{ asSentences \} from '\.\.\/copy\/spoken\.ts';$/m, 'the row joins its label its own way rather than through the shared joiner');
    assert.ok(!/'Started'|'Ready when you are'|'Ready to come back to'/.test(SCREEN), 'the screen spells a status line that chooserView.ts already decides');

    // Every place in the catalogue has a picture and a paper, so a seventh
    // situation cannot reach this screen undrawn or untinted.
    for (const mission of MISSIONS) {
      assert.ok(HERO_ART[mission.place], `${mission.place} has no scene, so the hero card for it is blank`);
      assert.ok(MISSION_TINT[mission.place], `${mission.place} has no paper, so its row is drawn on nothing`);
    }
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
    assert.doesNotMatch(SCREEN, /<Art[^>]*width=/, 'the chooser sizes a picture itself instead of taking the size the registry gives it');

    // And no drawing on this screen moves. Six loops at the moment somebody is
    // trying to choose is six things pulling at the eye, which is why the art
    // is a still picture rather than a scene with a pause prop to forget.
    //
    // Was `<MissionArt`, the switch that drew one authored scene per place. It
    // was deleted once the chooser took `heroArt`, and a check for a name that
    // cannot exist is a check that passes for the wrong reason, so this reads
    // the two things that would actually be true again if a scene came back.
    assert.doesNotMatch(SCREEN, /from '\.\.\/illustrations/, 'the chooser reaches for an authored scene again instead of the registered picture');
    assert.doesNotMatch(SCREEN, /paused=/, 'something on the chooser takes a pause prop, which only a scene with a loop in it needs');
  });
});
