/**
 * The start sheet says when there is more below (F755; come alive, icons
 * section 3.5), and keeps its legal order (README Part 5.C row 6).
 *
 * The sheet's footer sits outside its scroll, so on a phone the consent
 * switches ran under it with nothing to say they were there. The rule is
 * `sheetRunsUnder` in components.tsx, which a Node suite cannot load (the file
 * imports the animation engine), so its source is read out and run here, the
 * way `revamp/uxControls.test.ts` runs the wall's exit. The wiring is read from
 * the source, because there is no renderer in this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { evidence } from '../../../test/evidence.ts';

const COMPONENTS = readFileSync(new URL('../../components.tsx', import.meta.url), 'utf8');

/** One exported function's source, from its signature to the brace that closes it. */
function functionSource(source: string, name: string): string {
  const at = source.indexOf(`export function ${name}(`);
  assert.notEqual(at, -1, `${name} is missing from components.tsx`);
  const open = source.indexOf('{', source.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error(`${name} never closes`);
}

const runsUnder = new Function(
  `${stripTypeScriptTypes(functionSource(COMPONENTS, 'sheetRunsUnder').replace(/^export /, ''))}\nreturn sheetRunsUnder;`,
)() as (content: number, viewport: number, offset: number) => boolean;

describe('the start sheet — F755', () => {
  test('the start sheet shows a scroll cue when its content runs under the footer', () => {
    // The rule: a cue only while content is hidden under the footer.
    assert.equal(runsUnder(900, 500, 0), true, 'a sheet taller than its view, at the top, draws no cue');
    assert.equal(runsUnder(900, 500, 200), true, 'a sheet scrolled part way, with more below, draws no cue');
    assert.equal(runsUnder(900, 500, 400), false, 'a sheet scrolled to its end still says there is more');
    assert.equal(runsUnder(900, 500, 450), false, 'an overscroll past the end still says there is more');
    assert.equal(runsUnder(480, 500, 0), false, 'a sheet whose content fits draws a cue');
    assert.equal(runsUnder(500.5, 500, 0), false, 'half a point of rounding draws a cue');
    assert.equal(runsUnder(900, 500, -40), true, 'a bounce at the top hides the cue');
    for (const [content, viewport] of [[0, 500], [900, 0], [Number.NaN, 500], [900, Number.NaN]]) {
      assert.equal(runsUnder(content!, viewport!, 0), false, `a sheet not yet measured (${content}, ${viewport}) draws a cue`);
    }

    // The sheet: it measures its scroll, draws the hairline over the footer
    // only while the rule holds, and flashes the indicator once an opening.
    const components = evidence('apps/mobile/src/components.tsx');
    const sheet = components.slice(components.indexOf('export function Sheet('), components.indexOf('export function Skeleton('));
    assert.ok(sheet.length > 0, 'the Sheet moved; this check reads nothing');
    assert.match(sheet, /setCue\(sheetRunsUnder\(measures\.current\.content, measures\.current\.viewport, measures\.current\.offset\)\)/);
    for (const feed of ['onLayout={(event) => { measures.current.viewport', 'onContentSizeChange={(_width, height) => { measures.current.content', 'onScroll={(event) => { measures.current.offset']) {
      assert.ok(sheet.includes(feed), `the sheet does not feed the cue from ${feed.slice(0, feed.indexOf('='))}`);
    }
    assert.match(sheet, /<View style=\{cue \? \{ borderTopWidth: HAIRLINE, borderTopColor: paper\.line \} : null\}>\{snapshot\.current\.footer\}<\/View>/, 'the footer hairline is drawn whether or not anything runs under it');
    assert.match(sheet, /if \(!visible \|\| !cue \|\| flashed\.current\) return undefined; flashed\.current = true;/, 'the scroll indicator can flash more than once an opening');
    assert.match(sheet, /setTimeout\(\(\) => scroller\.current\?\.flashScrollIndicators\(\), SHEET_CUE_FLASH_MS\)/);
    assert.match(sheet, /measures\.current = \{ content: 0, viewport: 0, offset: 0 \}; setCue\(false\);/, 'a closed sheet carries its last measures into the next opening');
    assert.ok(sheet.indexOf('{snapshot.current.children}') < sheet.indexOf('{snapshot.current.footer}'));
    assert.match(sheet, /reading && b\.sheetReading/, 'the first run\'s sheet is not held to the reading column on an iPad');
    assert.match(components, /sheetReading: \{ alignSelf: 'center', width: '100%', maxWidth: READING \}/);

    // C2 keeps AI and retention readable on the main page, with service
    // processing facts reachable through Privacy details before Start.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /<OnboardingLayout page="before-practice" showScrollCue/);
    const body = screen.slice(screen.indexOf('const consentBody'), screen.indexOf('return (', screen.indexOf('const consentBody')));
    const order = ['STARTER_AI', 'STARTER_LOCAL', 'label="Privacy details"', 'title="Share usage analytics"', 'title="Remember my learning"'];
    let previous = -1;
    for (const part of order) {
      const at = body.indexOf(part); assert.ok(at > previous, `the disclosure no longer reads ${part} in order`); previous = at;
    }
    assert.match(body, /selected=\{draft\.analyticsConsent\}/);
    assert.match(body, /selected=\{draft\.rememberLearning === true\}[\s\S]*onPress=\{toggleRemember\}/);
    assert.doesNotMatch(body, /STARTER_PROCESSING|LiveKit|Deepgram|ElevenLabs/);
    const privacy = screen.slice(screen.indexOf("{surface === 'privacy' &&"), screen.indexOf("{surface === 'policy' &&"));
    assert.match(privacy, /LiveKit, Deepgram for transcription, and ElevenLabs/);
    assert.match(privacy, /label="Read privacy policy"/);
    assert.doesNotMatch(body, /numberOfLines|ellipsizeMode|playSfx|celebrate\(|arrived\(/);
    const layout = evidence('apps/mobile/src/onboarding/OnboardingLayout.tsx');
    assert.match(layout, /sheetRunsUnder\(measurements\.current\.content, measurements\.current\.viewport, measurements\.current\.offset\)/);
    assert.match(layout, /showsVerticalScrollIndicator=\{showScrollCue\}/);
    assert.match(layout, /if \(more && !flashed\.current\) \{ flashed\.current = true/);
    assert.match(layout, /flashScrollIndicators\(\)/);
    assert.match(layout, /borderTopWidth: 1, borderTopColor: cue \? c\.line : 'transparent'/);
    assert.match(screen, /TermsAcceptance context="practice"/);
    assert.match(screen, /label=\{needsAccount \? 'Create account to start' : 'Start live practice'\}[^>]*disabled=\{busy \|\| previewOnly\} onPress=\{\(\) => void \(needsAccount \? continueWithAccount\(\) : start\(\)\)\}/, 'the scrollable disclosure must retain its deliberate, preview-gated start or account continuation');
  });
});
