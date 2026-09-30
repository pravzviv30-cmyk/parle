/**
 * The glyph set, read as source — F589, F598.
 *
 * There is no renderer in this workspace (docs/TESTING.md), so this is the
 * `motion.test.ts` idiom: walk the two files that hold the app's line-art marks,
 * strip the comments, and fail on the shapes that break the one-pen rule. The
 * ceiling is honest: it proves the marks are drawn at one weight and hidden from
 * assistive tech, never that a phone drew a cup.
 *
 * The place switch is checked against `packages/core`'s own union rather than a
 * list written here, because a seventh place added to the catalogue with no mark
 * to draw it is exactly the miss this test is for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FILES = [
  { name: 'glyphs.tsx', body: stripComments(read('./glyphs.tsx')) },
  { name: 'nav/icons.tsx', body: stripComments(read('./nav/icons.tsx')) },
];

const GLYPHS = FILES[0]!.body;

/** Every place a mission can happen in, taken from the catalogue's own union. */
const PLACES: string[] = (() => {
  const missions = read('../../../packages/core/src/missions/missions.ts');
  const at = missions.indexOf('export type MissionPlace');
  assert.notEqual(at, -1, 'MissionPlace has moved out of packages/core/src/missions/missions.ts');
  const union = missions.slice(at, missions.indexOf(';', at));
  return (union.match(/'[a-z]+'/g) ?? []).map((q) => q.slice(1, -1));
})();

describe('one pen drew every mark in the app — F589', () => {
  test('every glyph draws in the one stroke weight and hides from assistive technology', () => {
    assert.ok(PLACES.length >= 6, `the union parsed to ${PLACES.length} places, so the place check below asserts nothing`);

    for (const { name, body } of FILES) {
      const svgs = body.match(/<Svg[^>]*>/g) ?? [];
      assert.ok(svgs.length > 0, `${name} draws no Svg at all; this test is reading the wrong file`);
      for (const tag of svgs) {
        assert.ok(
          tag.includes('{...decorative}'),
          `${name} draws an Svg a screen reader will announce as an unlabelled image: ${tag}`,
        );
      }

      const weights = body.match(/strokeWidth=\{([^}]*)\}/g) ?? [];
      assert.ok(weights.length > 0, `${name} sets no stroke weight, so every mark is at the SVG default of 1`);
      for (const weight of weights) {
        assert.ok(
          weight.includes('STROKE'),
          `${name} writes its own stroke weight: ${weight}; the app has one pen and it is theme.ts's`,
        );
      }

      // A mark is a line drawing. The one solid allowed is a tiny accent inside
      // a mark that would read as a hole without it, and it takes the mark's own
      // colour rather than inventing a second one.
      const fills = (body.match(/fill=\{?"?[^\s>}]+"?\}?/g) ?? []).filter((f) => !f.startsWith('fill="none"'));
      assert.ok(
        fills.length <= 1 && fills.every((f) => f === 'fill={color}'),
        `${name} fills a glyph with something other than the mark's own colour: ${fills.join(', ')}`,
      );
    }
  });

  test('every place a conversation happens in has a mark of its own', () => {
    for (const place of PLACES) {
      assert.ok(
        GLYPHS.includes(`case '${place}':`),
        `PlaceGlyph has no case for ${place}, so that row's disc is drawn empty`,
      );
    }
    // And no stray default, which is how a missing case stops being a typecheck
    // failure and starts being a blank disc.
    assert.ok(!/default:/.test(GLYPHS), 'PlaceGlyph answers a place it does not know with a default instead of failing to compile');
  });

  test('every glyph is an ICONS.md mark at the one stroke weight or a kept drawing on the retire list, and the tab and the control share one microphone', () => {
    // Revamp B, F598. Every revamp A name survives in its file, so no caller
    // moved; where ICONS.md draws the same thing its path replaced the old one.
    // The fourteen after them are the ICONS.md marks the Round 1 boards draw
    // that no older name covered. The list is exact, so a glyph added without
    // being named here, or one lost, fails rather than drifting in.
    const PORTED = ['ClockGlyph', 'ChatGlyph', 'DocumentGlyph', 'ReplayGlyph', 'WaveformGlyph'];
    const ROUND_ONE = [
      'ChevronDownGlyph',
      'PlayGlyph',
      'SpeakerSlowGlyph',
      'MicOffGlyph',
      'KeyboardGlyph',
      'PlusGlyph',
      'SearchGlyph',
      'SettingsGlyph',
      'LockGlyph',
      'ShareGlyph',
      'CardsGlyph',
      'InfoGlyph',
      'AlertGlyph',
      'PostcardGlyph',
    ];
    // ICONS.md has no match for these, so they are kept as drawn, at the new
    // stroke, until the stage that redraws their callers retires them.
    const KEPT_UNTIL: Record<string, string> = {
      CoffeeCupGlyph: 'Stage 3, with the rows that draw a place disc',
      QuoteGlyph: 'Stage 6, with the phrase shelf row',
      PlaceGlyph: 'Stage 6, once Stage 3 draws the places with the flat illustrations',
    };
    const exported = [...GLYPHS.matchAll(/export function (\w+(?:Glyph|Icon))\b/g)].map((m) => m[1]!).sort();
    assert.deepEqual(
      exported,
      [...PORTED, ...ROUND_ONE, ...Object.keys(KEPT_UNTIL)].sort(),
      'glyphs.tsx draws a glyph that is neither an ICONS.md mark nor on the retire list, or lost one a screen needs',
    );
    assert.equal(ROUND_ONE.length, 14, 'the Round 1 set is fourteen marks; a fifteenth is a port no board asked for');

    // The ICONS.md drawings, checked by a path each draws that nothing else in
    // the file does, so a port that was quietly reverted shows up here.
    for (const [glyph, path] of [
      ['ClockGlyph', 'M12 7v5l3.5 2'],
      ['ChatGlyph', 'M14.5 9h4a2 2 0 0 1 2 2v4.5'],
      ['DocumentGlyph', 'M4.5 18.5A2.5 2.5 0 0 1 7 16h13'],
      ['ReplayGlyph', 'M10.75 10.75 12.25 9.5v5'],
      ['WaveformGlyph', 'M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3'],
    ] as const) {
      const at = GLYPHS.indexOf(`export function ${glyph}(`);
      const next = GLYPHS.indexOf('\nexport ', at + 1);
      assert.ok(GLYPHS.slice(at, next === -1 ? undefined : next).includes(path), `${glyph} is not ICONS.md's drawing`);
    }
    // The slow speaker is the speaker with its outer arc dashed, and nothing else.
    assert.match(GLYPHS, /<Path d="M19 7a7 7 0 0 1 0 10" strokeDasharray="2\.6 2\.6" \/>/, 'the slow speaker lost its dashed arc');

    assert.match(
      GLYPHS,
      /export \{ EarGlyph as SpeakerGlyph \} from '\.\/components\.tsx'/,
      'the speaker is drawn a second time instead of being the ear the tutor already speaks through',
    );
    // ICONS.md: "speak and mic are the same microphone on purpose".
    const icons = FILES[1]!.body;
    assert.match(
      icons,
      /export \{ MicGlyph as TutorIcon \} from '\.\.\/components\.tsx'/,
      'the Speak tab draws its own microphone instead of the one the control draws',
    );
    assert.doesNotMatch(icons, /export function TutorIcon\b/, 'the Speak tab is drawn a second time beside the re-export');
    // The pair of chevrons stays together in components.tsx, beside the back
    // one, and so do close and check: this file imports from that one.
    assert.ok(!/export function ChevronRight\b/.test(GLYPHS), 'glyphs.tsx draws a second right chevron away from ChevronLeft');
    assert.ok(!/export function (Close|Check)Glyph\b/.test(GLYPHS), 'close or check is drawn here, away from the parts that draw them');
  });
});
