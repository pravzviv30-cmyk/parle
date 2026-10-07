/**
 * A disabled Next, and a disabled pill, look disabled (F758; come alive, icons
 * section 3.4).
 *
 * The defect was a slate fill with white words: the off button read as a
 * second live one. Off is now quieter than any live control on every ground a
 * first-run page has, and its words still read. The faces are pure data
 * (`nextFace.ts`) and the palette is a leaf module, so contrast is computed
 * here; the wiring is read from the source, because there is no renderer in
 * this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { accent, colour, onColour, paper } from '../../palette.ts';
import { NEXT_LABEL, NEXT_OFF, NEXT_OFF_HINT, NEXT_ON } from './nextFace.ts';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Words on a button: the 4.5 floor. */
const WORDS = 4.5;

describe('a disabled control says it is off — F758', () => {
  test('a disabled Next looks disabled on every ground', () => {
    // The faces.
    assert.equal(NEXT_LABEL, 'Continue');
    assert.ok(NEXT_OFF_HINT.length > 0, 'a dimmed Continue does not say what turns it on');
    assert.equal(NEXT_OFF.fill, paper.skeleton, 'the off Continue is not the sand skeleton');
    assert.equal(NEXT_OFF.words, paper.inkSoft, 'the off Continue does not use soft ink words');
    assert.notEqual(NEXT_OFF.fill, paper.inkSoft, 'the off Continue is the slate fill that reads as live');
    assert.notEqual(NEXT_OFF.words, paper.onInk, 'the off Continue has the live button\'s white words');
    assert.deepEqual(NEXT_ON, { fill: paper.ink, words: paper.onInk });
    assert.ok(contrast(NEXT_OFF.words, NEXT_OFF.fill) >= WORDS, `the off Continue's words are ${contrast(NEXT_OFF.words, NEXT_OFF.fill).toFixed(2)} on its fill`);

    // Every ground a first-run pill or Continue sits on, with the tone it
    // takes there: ink on paper and sun, white on blue and coral. Off must
    // differ from the live face of that tone and from the ground itself, and
    // its words must still read.
    const PILL_OFF = { ink: paper.skeleton, white: onColour.blue } as const;
    const PILL_ON = { ink: paper.ink, white: paper.card } as const;
    const grounds: readonly { name: string; ground: string; tone: 'ink' | 'white' }[] = [
      { name: 'paper', ground: paper.ground, tone: 'ink' },
      { name: 'a white sheet', ground: paper.card, tone: 'ink' },
      { name: 'sun', ground: colour.sun, tone: 'ink' },
      { name: 'blue', ground: colour.blue, tone: 'white' },
      { name: 'coral', ground: colour.coral, tone: 'white' },
    ];
    for (const { name, ground, tone } of grounds) {
      const off = PILL_OFF[tone];
      assert.notEqual(off, PILL_ON[tone], `an off ${tone} pill on ${name} is the live fill`);
      assert.notEqual(off, ground, `an off ${tone} pill vanishes into ${name}`);
      assert.ok(contrast(paper.inkSoft, off) >= WORDS, `an off ${tone} pill's words are ${contrast(paper.inkSoft, off).toFixed(2)} on ${name}`);
      assert.ok(contrast(off, PILL_ON[tone]) > 1.05, `an off ${tone} pill on ${name} is a shade of the live one`);
    }
    // The Continue sits on paper; on paper its off face is that sand.
    assert.equal(NEXT_OFF.fill, PILL_OFF.ink);

    // The Continue draws those faces, says it is off, and fades the ink in
    // through the motion door rather than its own clock.
    const next = evidence('apps/mobile/src/onboarding/NextButton.tsx');
    assert.match(next, /from '\.\/firstRun\/nextFace\.ts'/);
    assert.match(next, /style=\{\[st\.surface, \{ backgroundColor: NEXT_OFF\.fill \}\]\}/, 'the Continue is not drawn on its off face');
    assert.match(next, /\{face\(NEXT_OFF\.words\)\}/);
    assert.match(next, /<LiveFace live=\{!disabled\} style=\{\[st\.row, \{ backgroundColor: NEXT_ON\.fill \}\]\}>/, 'the live face no longer waits for an answer');
    assert.match(next, /accessibilityState=\{\{ disabled \}\}/);
    assert.match(next, /accessibilityHint=\{disabled \? NEXT_OFF_HINT : undefined\}/);
    assert.match(next, /<Glint when=\{!disabled\}/, 'turning on no longer glints');
    assert.doesNotMatch(next, /backgroundColor: disabled \? paper\.inkSoft/, 'the slate off face is back');
    const live = evidence('apps/mobile/src/onboarding/firstRun/LiveFace.tsx');
    assert.match(live, /timing\(to, DUR\.fast, EASE\.out, reduced\)/, 'the ink fades in on its own clock rather than the motion door');
    assert.match(live, /shown\.value = reduced \? to :/, 'reduced motion does not land the face at once');

    // PillButton, which every first-run pill is.
    const components = evidence('apps/mobile/src/components.tsx');
    const pill = components.slice(components.indexOf('export function PillButton('), components.indexOf('export function OutlineButton('));
    assert.match(pill, /disabled && \(tone === 'white' \? s\.pillDisabledOnColour : s\.pillDisabled\)/, 'an off white pill takes the ink pill\'s sand on blue or coral');
    assert.match(pill, /color: disabled \? paper\.inkSoft :/, 'an off pill keeps live words');
    assert.match(components, /pillDisabled: \{ backgroundColor: paper\.skeleton \}/);
    assert.match(components, /pillDisabledOnColour: \{ backgroundColor: onColour\.blue \}/);
  });

  test('a disabled MorphButton never draws the live face', () => {
    // MorphButton is the first run's Start practice and Send reply. Read as
    // source, because it draws with Reanimated and there is no renderer here.
    const morph = evidence('apps/mobile/src/motion/MorphButton.tsx');
    // Off is decided before tone: the fill and the words both ask `disabled` first.
    assert.match(morph, /const fill = disabled \? \(tone === 'white' \? st\.offOnColour : st\.off\) : tone === 'white' \? st\.white : st\.ink;/, 'a disabled MorphButton is filled like a live one');
    assert.match(morph, /const ink = disabled \? paper\.inkSoft : tone === 'white' \? paper\.ink : paper\.onInk;/, 'a disabled MorphButton has the live button\'s words');
    // The off fills are PillButton's, which the test above holds on every ground.
    const fills = Object.fromEntries([...morph.matchAll(/(\w+): \{ backgroundColor: ([\w.]+) \}/g)].map((m) => [m[1]!, m[2]!]));
    const value = (name: string): string => {
      const [group, key] = name.split('.');
      const table = { paper, onColour, accent } as unknown as Record<string, Record<string, string>>;
      const found = table[group!]?.[key!];
      assert.ok(found, `${name} is not a colour this test knows`);
      return found;
    };
    assert.equal(value(fills.off!), paper.skeleton, 'the off ink MorphButton is not the sand skeleton');
    assert.equal(value(fills.offOnColour!), onColour.blue, 'the off white MorphButton is not blue\'s pale secondary');
    for (const [off, live] of [[fills.off!, fills.ink!], [fills.offOnColour!, fills.white!]] as const) {
      assert.notEqual(value(off), value(live), `${off} is the live fill ${live}`);
      assert.ok(contrast(value(off), value(live)) > 1.05, `${off} is a shade of the live ${live}`);
      assert.ok(contrast(paper.inkSoft, value(off)) >= WORDS, `the off words are ${contrast(paper.inkSoft, value(off)).toFixed(2)} on ${off}`);
    }
    assert.doesNotMatch(morph, /off: \{ backgroundColor: paper\.inkFaint \}/, 'the slate off face is back');
    // Off cannot be pressed, and says so.
    assert.match(morph, /const locked = disabled \|\| state === 'busy' \|\| state === 'done';/);
    assert.match(morph, /accessibilityState=\{\{ busy: state === 'busy', disabled: locked \}\}/);
  });
});
